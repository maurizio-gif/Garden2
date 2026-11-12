-- Il confronto con gli anni scorsi leggeva tutta la storia di tutte le persone per
-- calcolare nuovi/rientri/usciti: oltre 2 secondi a ogni apertura della pagina.
-- Ora conta per mese senza incrociare 24 mesi × tutti i periodi, e rilegge la
-- storia solo di chi è stato attivo negli ultimi 24 mesi. Stesso risultato.

create or replace function public.dashboard_confronto_anni(p_anni integer default 5)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with oggi as (
		select (now() at time zone 'Europe/Rome')::date as d
	),
	anni as (
		select k as anni_fa, (oggi.d - make_interval(years => k))::date as giorno,
			make_date(extract(year from oggi.d)::int - k, 1, 1) as inizio_anno
		from oggi, generate_series(0, least(greatest(p_anni, 1), 9)) k
	),
	-- prodotti con date sensate, per iscritti e movimento
	prodotti as (
		select a.persona_id, a.data_inizio, a.data_fine, a.data_vendita::date as data_vendita,
			coalesce(g.gruppo, 'Altro') as gruppo
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		where a.cancellato_il is null
			and a.persona_id is not null
			and a.data_inizio >= '2012-01-01'
			and a.data_fine >= a.data_inizio
			and a.data_fine <= (select d from oggi) + 1500
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
	),
	-- vendite non cancellate con importo, per i confronti sul venduto
	vendite as (
		select (a.data_vendita at time zone 'Europe/Rome')::date as giorno, a.persona_id, a.totale,
			coalesce(g.gruppo, 'Altro') as gruppo
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		where a.cancellato_il is null
			and a.data_vendita <= now()
			and a.data_vendita >= '2012-01-01'
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
	),
	iscritti as (
		select an.anni_fa, an.giorno, p.gruppo, count(distinct p.persona_id) as persone
		from anni an
		join prodotti p on p.data_inizio <= an.giorno and p.data_fine >= an.giorno and p.data_vendita <= an.giorno
		group by grouping sets ((an.anni_fa, an.giorno, p.gruppo), (an.anni_fa, an.giorno))
	),
	ytd as (
		select an.anni_fa, v.gruppo,
			count(*) as vendite, count(distinct v.persona_id) as persone,
			coalesce(round(sum(v.totale)), 0) as fatturato
		from anni an
		join vendite v on v.giorno >= an.inizio_anno and v.giorno <= an.giorno
		group by grouping sets ((an.anni_fa, v.gruppo), (an.anni_fa))
	),
	mensile as (
		select extract(year from v.giorno)::int as anno, extract(month from v.giorno)::int as mese,
			count(*) as vendite, coalesce(round(sum(v.totale)), 0) as fatturato
		from vendite v, oggi
		where v.giorno >= make_date(extract(year from oggi.d)::int - least(greatest(p_anni, 1), 9), 1, 1)
		group by 1, 2
	),
	-- Periodi continui per persona (tolleranza 30 giorni tra un prodotto e il
	-- successivo). Si guardano solo le persone con qualcosa che finisce dopo
	-- l'inizio della finestra dei 24 mesi: per sapere se un periodo è «nuovo» o
	-- «rientro» serve tutta la loro storia, ma non quella di chi se n'è andato
	-- anni fa. È la parte più cara del calcolo, per questo il filtro.
	finestra as (
		select (date_trunc('month', oggi.d) - interval '23 months')::date as da from oggi
	),
	attivi_nella_finestra as (
		select distinct persona_id from prodotti, finestra where data_fine >= finestra.da - 1
	),
	ordinati as (
		select p.persona_id, p.data_inizio, p.data_fine,
			max(p.data_fine) over (partition by p.persona_id order by p.data_inizio, p.data_fine
				rows between unbounded preceding and 1 preceding) as fine_prec
		from prodotti p
		where p.persona_id in (select persona_id from attivi_nella_finestra)
	),
	isole as (
		select persona_id, data_inizio, data_fine,
			sum(case when fine_prec is null or data_inizio > fine_prec + 30 then 1 else 0 end)
				over (partition by persona_id order by data_inizio, data_fine) as n
		from ordinati
	),
	periodi as (
		select persona_id, n, min(data_inizio) as inizio, max(data_fine) as fine,
			row_number() over (partition by persona_id order by min(data_inizio)) as progressivo
		from isole
		group by persona_id, n
	),
	mesi as (
		select (date_trunc('month', oggi.d) - make_interval(months => m))::date as inizio_mese
		from oggi, generate_series(0, 23) m
	),
	ingressi as (
		select date_trunc('month', inizio)::date as mese,
			count(*) filter (where progressivo = 1) as nuovi,
			count(*) filter (where progressivo > 1) as rientri
		from periodi, finestra
		where inizio >= finestra.da
		group by 1
	),
	uscite as (
		select date_trunc('month', fine)::date as mese, count(*) as usciti
		from periodi, finestra, oggi
		where fine >= finestra.da and fine < oggi.d
		group by 1
	),
	presenti as (
		select ms.inizio_mese, count(*) as attivi
		from mesi ms
		cross join oggi
		join periodi pe
			on pe.inizio <= least((ms.inizio_mese + interval '1 month' - interval '1 day')::date, oggi.d)
			and pe.fine >= least((ms.inizio_mese + interval '1 month' - interval '1 day')::date, oggi.d)
		group by ms.inizio_mese
	),
	movimento as (
		select ms.inizio_mese,
			coalesce(i.nuovi, 0) as nuovi, coalesce(i.rientri, 0) as rientri,
			coalesce(u.usciti, 0) as usciti, coalesce(pr.attivi, 0) as attivi_fine_mese
		from mesi ms
		left join ingressi i on i.mese = ms.inizio_mese
		left join uscite u on u.mese = ms.inizio_mese
		left join presenti pr on pr.inizio_mese = ms.inizio_mese
	)
	select jsonb_build_object(
		'oggi', (select d from oggi),
		'aggiornato_al', (select max(valore) from public.sync_info4u_stato where chiave = 'refresh_transazioni'),
		'iscritti', coalesce((
			select jsonb_agg(jsonb_build_object(
				'anni_fa', anni_fa, 'giorno', giorno, 'gruppo', gruppo, 'persone', persone
			) order by anni_fa, gruppo nulls first)
			from iscritti
		), '[]'::jsonb),
		'ytd', coalesce((
			select jsonb_agg(jsonb_build_object(
				'anni_fa', anni_fa, 'gruppo', gruppo, 'vendite', vendite, 'persone', persone, 'fatturato', fatturato
			) order by anni_fa, gruppo nulls first)
			from ytd
		), '[]'::jsonb),
		'anni', coalesce((
			select jsonb_agg(jsonb_build_object('anni_fa', anni_fa, 'giorno', giorno, 'inizio', inizio_anno) order by anni_fa)
			from anni
		), '[]'::jsonb),
		'mensile', coalesce((
			select jsonb_agg(jsonb_build_object('anno', anno, 'mese', mese, 'vendite', vendite, 'fatturato', fatturato) order by anno, mese)
			from mensile
		), '[]'::jsonb),
		'movimento', coalesce((
			select jsonb_agg(jsonb_build_object(
				'mese', inizio_mese, 'nuovi', nuovi, 'rientri', rientri, 'usciti', usciti, 'attivi', attivi_fine_mese
			) order by inizio_mese)
			from movimento
		), '[]'::jsonb)
	);
$$;

revoke execute on function public.dashboard_confronto_anni(integer) from public, anon, authenticated;
grant execute on function public.dashboard_confronto_anni(integer) to service_role;

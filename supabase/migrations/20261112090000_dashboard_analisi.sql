-- Analisi abbonamenti per il pannello di Garden (cartella web/): confronto con
-- gli anni precedenti, analisi personalizzata con filtri, viste salvate.
--
-- Come le funzioni di 20261107120000_dashboard_rpc.sql, le chiama solo il server
-- Next.js con la service_role (niente execute a public/anon/authenticated).
--
-- Definizioni (cambiarle qui, il pannello non le conosce):
--   · «prodotti» = abbonamenti non cancellati, esclusi QUOTA ASSOCIATIVA e
--     QUOTE EXTRA (salvo il filtro `con_quote`);
--   · «iscritto al giorno G» = prodotto venduto entro G, iniziato entro G e non
--     ancora finito a G (data_fine >= G). Conta le persone, non i contratti.
--     Come per le altre pagine, le sospensioni non sono sottratte. Le vendite
--     cancellate in Info4U non esistono più qui, quindi il passato è «com'è
--     oggi», non «com'era quel giorno»;
--   · «venduto» = somma di abbonamenti.totale, per data_vendita (non è cassa:
--     gli incassi veri sono in transazioni);
--   · «periodo continuo» di una persona = prodotti che iniziano entro 30 giorni
--     dalla fine del precedente. Il primo periodo è «nuovo», i successivi
--     «rientro»; la fine di un periodo è «uscita» (solo se già passata);
--   · prodotti con date impossibili (fine prima dell'inizio, anno 2080…) sono
--     scartati dai conteggi di iscritti e movimento;
--   · i giorni sono quelli di Europe/Rome.

-- ───────────────────────────────────────────────────────── viste salvate

create table if not exists public.dashboard_viste (
	id uuid primary key default gen_random_uuid(),
	nome text not null check (char_length(btrim(nome)) between 1 and 80),
	config jsonb not null,
	creato_il timestamptz not null default now()
);
comment on table public.dashboard_viste is
	'Analisi personalizzate salvate dal pannello (pagina Analisi): nome e filtri in config.';
alter table public.dashboard_viste enable row level security;
revoke all on public.dashboard_viste from public, anon, authenticated;
grant select, insert, delete on public.dashboard_viste to service_role;

-- ──────────────────────────────────────────────── base filtrata (interna)

create or replace function public.dashboard_base(p_filtri jsonb)
returns table (
	id uuid,
	data_vendita date,
	data_inizio date,
	data_fine date,
	abbonamento text,
	categoria text,
	gruppo text,
	totale numeric,
	operatore text,
	persona_id uuid,
	nome text,
	cognome text,
	durata_etichetta text
)
language sql
stable
set search_path to 'public'
as $$
	with f as (
		select
			nullif(p_filtri->>'da', '')::date as da,
			nullif(p_filtri->>'a', '')::date as a,
			coalesce(nullif(p_filtri->>'campo', ''), 'vendita') as campo,
			case when jsonb_typeof(p_filtri->'gruppi') = 'array' and jsonb_array_length(p_filtri->'gruppi') > 0
				then array(select jsonb_array_elements_text(p_filtri->'gruppi')) end as gruppi,
			case when jsonb_typeof(p_filtri->'categorie') = 'array' and jsonb_array_length(p_filtri->'categorie') > 0
				then array(select jsonb_array_elements_text(p_filtri->'categorie')) end as categorie,
			case when jsonb_typeof(p_filtri->'operatori') = 'array' and jsonb_array_length(p_filtri->'operatori') > 0
				then array(select jsonb_array_elements_text(p_filtri->'operatori')) end as operatori,
			nullif(lower(btrim(p_filtri->>'q')), '') as q,
			nullif(p_filtri->>'min', '')::numeric as vmin,
			nullif(p_filtri->>'max', '')::numeric as vmax,
			coalesce((p_filtri->>'con_quote')::boolean, false) as con_quote
	)
	select
		x.id, x.data_vendita, x.data_inizio, x.data_fine, x.abbonamento, x.categoria, x.gruppo,
		x.totale, x.operatore, x.persona_id, x.nome, x.cognome, x.durata_etichetta
	from (
		select
			a.id,
			(a.data_vendita at time zone 'Europe/Rome')::date as data_vendita,
			a.data_inizio,
			a.data_fine,
			a.abbonamento,
			coalesce(a.categoria, 'Senza categoria') as categoria,
			coalesce(g.gruppo, 'Altro') as gruppo,
			a.totale,
			coalesce(a.venditore_nome, a.operatore_nome) as operatore,
			a.persona_id,
			pe.nome,
			pe.cognome,
			case a.periodo
				when 'M' then a.durata::text || case when a.durata = 1 then ' mese' else ' mesi' end
				when 'G' then a.durata::text || case when a.durata = 1 then ' giorno' else ' giorni' end
				when 'P' then 'Pacchetto ' || a.durata::text
				else 'Altra durata'
			end as durata_etichetta,
			f.*,
			case f.campo
				when 'inizio' then a.data_inizio
				when 'fine' then a.data_fine
				else (a.data_vendita at time zone 'Europe/Rome')::date
			end as d_campo,
			lower(concat_ws(' ', a.abbonamento, a.variante, a.categoria, pe.nome, pe.cognome, a.venditore_nome, a.operatore_nome)) as pagliaio
		from public.abbonamenti a
		cross join f
		left join public.persone pe on pe.id = a.persona_id
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		where a.cancellato_il is null
			and a.data_vendita <= now()
	) x
	where (x.con_quote or x.categoria not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA'))
		and (x.da is null or x.d_campo >= x.da)
		and (x.a is null or x.d_campo <= x.a)
		and (x.gruppi is null or x.gruppo = any (x.gruppi))
		and (x.categorie is null or x.categoria = any (x.categorie))
		and (x.operatori is null or x.operatore = any (x.operatori))
		and (x.vmin is null or x.totale >= x.vmin)
		and (x.vmax is null or x.totale <= x.vmax)
		and (x.q is null or not exists (
			select 1 from regexp_split_to_table(x.q, '\s+') w where position(w in x.pagliaio) = 0
		));
$$;

-- ─────────────────────────────────────────────── analisi raggruppata

-- p_filtri: da, a, campo (vendita|inizio|fine), gruppi[], categorie[],
--   operatori[], q, min, max, con_quote.
-- p_raggruppa: giorno | settimana | mese | anno | gruppo | categoria |
--   abbonamento | operatore | durata | niente.
create or replace function public.dashboard_analisi(p_filtri jsonb, p_raggruppa text default 'mese')
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with b as (
		select * from public.dashboard_base(p_filtri)
	),
	campo as (
		select coalesce(nullif(p_filtri->>'campo', ''), 'vendita') as c
	),
	k as (
		select
			case p_raggruppa
				when 'giorno' then to_char(d, 'YYYY-MM-DD')
				when 'settimana' then to_char(date_trunc('week', d), 'YYYY-MM-DD')
				when 'mese' then to_char(d, 'YYYY-MM')
				when 'anno' then to_char(d, 'YYYY')
				when 'gruppo' then b.gruppo
				when 'categoria' then b.categoria
				when 'abbonamento' then coalesce(b.abbonamento, 'Senza nome')
				when 'operatore' then coalesce(b.operatore, 'Senza operatore')
				when 'durata' then b.durata_etichetta
				else 'totale'
			end as chiave,
			b.persona_id, b.totale
		from b, campo c
		cross join lateral (
			select case c.c
				when 'inizio' then b.data_inizio
				when 'fine' then b.data_fine
				else b.data_vendita
			end as d
		) dd
	),
	righe as (
		select chiave,
			count(*) as vendite,
			count(distinct persona_id) as persone,
			coalesce(round(sum(totale), 2), 0) as fatturato
		from k
		where chiave is not null
		group by chiave
	)
	select jsonb_build_object(
		'totali', (
			select jsonb_build_object(
				'vendite', count(*),
				'persone', count(distinct persona_id),
				'fatturato', coalesce(round(sum(totale), 2), 0)
			) from b
		),
		'righe', coalesce((
			select jsonb_agg(jsonb_build_object(
				'chiave', chiave, 'vendite', vendite, 'persone', persone, 'fatturato', fatturato
			) order by
				case when p_raggruppa in ('giorno', 'settimana', 'mese', 'anno') then chiave end asc,
				fatturato desc, chiave)
			from (select * from righe order by
				case when p_raggruppa in ('giorno', 'settimana', 'mese', 'anno') then chiave end asc,
				fatturato desc, chiave
				limit 400) r
		), '[]'::jsonb),
		'troncato', (select count(*) > 400 from righe)
	);
$$;

-- ───────────────────────────────────────────────── elenco delle vendite

create or replace function public.dashboard_analisi_righe(
	p_filtri jsonb,
	p_limite integer default 50,
	p_salta integer default 0,
	p_ordine text default 'data'
)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with b as (
		select * from public.dashboard_base(p_filtri)
	),
	pagina as (
		select * from b
		order by
			case when p_ordine = 'importo' then b.totale end desc nulls last,
			b.data_vendita desc nulls last,
			b.id
		limit least(greatest(coalesce(p_limite, 50), 1), 200)
		offset greatest(coalesce(p_salta, 0), 0)
	)
	select jsonb_build_object(
		'totale', (select count(*) from b),
		'righe', coalesce((
			select jsonb_agg(jsonb_build_object(
				'vendita', p.data_vendita, 'inizio', p.data_inizio, 'fine', p.data_fine,
				'nome', p.nome, 'cognome', p.cognome,
				'abbonamento', p.abbonamento, 'categoria', p.categoria, 'gruppo', p.gruppo,
				'durata', p.durata_etichetta, 'operatore', p.operatore, 'totale', p.totale
			) order by
				case when p_ordine = 'importo' then p.totale end desc nulls last,
				p.data_vendita desc nulls last, p.id)
			from pagina p
		), '[]'::jsonb)
	);
$$;

-- ───────────────────────────────────── valori per i filtri (menu a tendina)

create or replace function public.dashboard_opzioni()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with p as (
		select coalesce(g.gruppo, 'Altro') as gruppo,
			coalesce(a.categoria, 'Senza categoria') as categoria,
			coalesce(a.venditore_nome, a.operatore_nome) as operatore,
			a.data_vendita
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		where a.cancellato_il is null and a.data_vendita <= now()
	)
	select jsonb_build_object(
		'gruppi', coalesce((select jsonb_agg(gruppo order by gruppo) from (select distinct gruppo from p) s), '[]'::jsonb),
		'categorie', coalesce((
			select jsonb_agg(jsonb_build_object('categoria', categoria, 'gruppo', gruppo) order by gruppo, categoria)
			from (select distinct categoria, gruppo from p) s
		), '[]'::jsonb),
		'operatori', coalesce((
			select jsonb_agg(operatore order by operatore)
			from (
				select operatore from p
				where operatore is not null and data_vendita >= now() - interval '3 years'
				group by operatore having count(*) >= 20
			) s
		), '[]'::jsonb),
		'prima_vendita', (select (min(data_vendita) at time zone 'Europe/Rome')::date from p where data_vendita >= '2012-01-01')
	);
$$;

-- ─────────────────────────────────────────── confronto con gli anni scorsi

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
	-- periodi continui per persona (tolleranza 30 giorni tra un prodotto e il successivo)
	ordinati as (
		select persona_id, data_inizio, data_fine,
			max(data_fine) over (partition by persona_id order by data_inizio, data_fine
				rows between unbounded preceding and 1 preceding) as fine_prec
		from prodotti
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
		select (date_trunc('month', oggi.d) - make_interval(months => m))::date as inizio_mese, m
		from oggi, generate_series(0, 23) m
	),
	movimento as (
		select ms.inizio_mese,
			count(*) filter (where pe.inizio >= ms.inizio_mese and pe.inizio < ms.inizio_mese + interval '1 month' and pe.progressivo = 1) as nuovi,
			count(*) filter (where pe.inizio >= ms.inizio_mese and pe.inizio < ms.inizio_mese + interval '1 month' and pe.progressivo > 1) as rientri,
			count(*) filter (where pe.fine >= ms.inizio_mese and pe.fine < ms.inizio_mese + interval '1 month' and pe.fine < (select d from oggi)) as usciti,
			count(*) filter (where pe.inizio <= least((ms.inizio_mese + interval '1 month' - interval '1 day')::date, (select d from oggi))
				and pe.fine >= least((ms.inizio_mese + interval '1 month' - interval '1 day')::date, (select d from oggi))) as attivi_fine_mese
		from mesi ms, periodi pe
		where pe.fine >= ms.inizio_mese - 1 and pe.inizio < ms.inizio_mese + interval '1 month'
		group by ms.inizio_mese
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

revoke execute on function public.dashboard_base(jsonb) from public, anon, authenticated;
revoke execute on function public.dashboard_analisi(jsonb, text) from public, anon, authenticated;
revoke execute on function public.dashboard_analisi_righe(jsonb, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.dashboard_opzioni() from public, anon, authenticated;
revoke execute on function public.dashboard_confronto_anni(integer) from public, anon, authenticated;
grant execute on function public.dashboard_base(jsonb) to service_role;
grant execute on function public.dashboard_analisi(jsonb, text) to service_role;
grant execute on function public.dashboard_analisi_righe(jsonb, integer, integer, text) to service_role;
grant execute on function public.dashboard_opzioni() to service_role;
grant execute on function public.dashboard_confronto_anni(integer) to service_role;

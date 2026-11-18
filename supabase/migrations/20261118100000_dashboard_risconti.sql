-- Risconti passivi del pannello di Garden (pagina Finanza): la parte degli
-- abbonamenti già venduti che riguarda giorni futuri, cioè ricavi incassati o
-- fatturati in anticipo che competono ai periodi successivi.
--
-- Sostituisce dashboard_riscontri (20261118090000, nome sbagliato): stessa
-- definizione, in più i risconti al 31 dicembre di ogni anno, quelli da
-- bilancio. La vecchia funzione si toglie dopo il rilascio del pannello che usa
-- questa (20261118110000_drop_dashboard_riscontri.sql).
--
-- Come le altre funzioni del pannello, la chiama solo il server Next.js con la
-- service_role. Restituisce già aggregato (jsonb).
--
-- Definizioni (cambiarle qui, il pannello non le conosce):
--   · date di chiusura: la fine di ogni mese degli ultimi 37 mesi chiusi, il
--     31 dicembre di ogni anno dello storico (anno in corso compreso: è la stima
--     con il venduto fino a oggi), oggi e lo stesso giorno di un anno fa;
--   · contano gli abbonamenti non cancellati, con totale > 0 e date coerenti
--     (data_fine >= data_inizio), venduti entro la data e che finiscono dopo;
--   · risconto = totale × giorni del periodo dopo la data ÷ giorni totali del
--     periodo (data_inizio..data_fine compresi). Un abbonamento venduto ma non
--     ancora iniziato vale per intero ("non_iniziati");
--   · comprende le quote associative (gruppo «Quote e tessere»), come il
--     venduto della pagina Finanza. Le sospensioni non spostano la fine;
--   · per non incrociare ogni abbonamento con ogni data, ognuno genera solo le
--     date di chiusura che attraversa (fine mese e 31 dicembre).

create or replace function public.dashboard_risconti()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with oggi as (
		select (now() at time zone 'Europe/Rome')::date as d
	),
	finestra as (
		-- ultima fine mese chiusa e la prima delle 37 mostrate
		select (date_trunc('month', d))::date - 1 as ultima,
			(date_trunc('month', d) - interval '37 months')::date as primo_mese
		from oggi
	),
	ab as (
		select (a.data_vendita at time zone 'Europe/Rome')::date as venduto_il,
			a.data_inizio, a.data_fine, a.totale,
			coalesce(g.gruppo, 'Altro') as gruppo,
			(a.data_fine - a.data_inizio + 1) as giorni
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		where a.cancellato_il is null
			and a.totale > 0
			and a.data_fine >= a.data_inizio
			and a.data_vendita <= now()
	),
	-- (abbonamento, data di chiusura) solo dove l'abbonamento è venduto e non finito
	coppie as (
		select 'mese'::text as tipo, ((m + interval '1 month')::date - 1) as giorno, ab.*
		from ab, finestra f,
			generate_series(
				date_trunc('month', greatest(ab.venduto_il, f.primo_mese)),
				date_trunc('month', least(ab.data_fine - 1, f.ultima)),
				interval '1 month'
			) m
		where ab.data_fine > f.primo_mese
		union all
		select 'fine_anno', make_date(y, 12, 31), ab.*
		from ab, oggi,
			generate_series(extract(year from ab.venduto_il)::int, least(extract(year from ab.data_fine - 1)::int, extract(year from oggi.d)::int)) y
		union all
		select c.tipo, c.giorno, ab.*
		from (select 'oggi'::text as tipo, d as giorno from oggi
			union all select 'anno_fa', (d - interval '1 year')::date from oggi) c
		join ab on ab.venduto_il <= c.giorno and ab.data_fine > c.giorno
	),
	righe as (
		select tipo, giorno, gruppo,
			round(sum(totale * (data_fine - greatest(giorno, data_inizio - 1))::numeric / giorni)) as risconto,
			round(coalesce(sum(totale) filter (where data_inizio > giorno), 0)) as non_iniziati,
			count(*) as abbonamenti
		from coppie
		where data_fine > giorno and venduto_il <= giorno
		group by grouping sets ((tipo, giorno, gruppo), (tipo, giorno))
	)
	select jsonb_build_object(
		'oggi', (select d from oggi),
		'righe', coalesce((
			select jsonb_agg(jsonb_build_object(
				'giorno', giorno, 'tipo', tipo, 'gruppo', gruppo,
				'risconto', risconto, 'non_iniziati', non_iniziati, 'abbonamenti', abbonamenti
			) order by tipo, giorno, gruppo nulls first)
			from righe
		), '[]'::jsonb)
	);
$$;

revoke execute on function public.dashboard_risconti() from public, anon, authenticated;
grant execute on function public.dashboard_risconti() to service_role;

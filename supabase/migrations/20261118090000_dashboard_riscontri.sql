-- Riscontri passivi del pannello di Garden (pagina Finanza): la parte degli
-- abbonamenti già venduti che riguarda giorni futuri, cioè ricavi incassati o
-- fatturati in anticipo che competono ai mesi successivi.
--
-- Come le altre funzioni del pannello, la chiama solo il server Next.js con la
-- service_role. Restituisce già aggregato (jsonb).
--
-- Definizioni (cambiarle qui, il pannello non le conosce):
--   · si guarda la situazione alla fine di ogni mese (ultimo giorno, ore 24 di
--     Europe/Rome), per 36 mesi indietro, più oggi e lo stesso giorno di un anno
--     fa;
--   · contano gli abbonamenti non cancellati, con totale > 0 e date coerenti
--     (data_fine >= data_inizio), venduti entro quel giorno e che finiscono dopo;
--   · riscontro = totale × giorni del periodo dopo quel giorno ÷ giorni totali
--     del periodo (data_inizio..data_fine compresi). Un abbonamento venduto ma
--     non ancora iniziato vale per intero ("non_iniziati");
--   · è la stessa proporzione del «da godere» della Panoramica, ma qui contano
--     anche gli abbonamenti venduti che partono più avanti;
--   · comprende le quote associative (gruppo «Quote e tessere»), come il
--     venduto della pagina Finanza. Le sospensioni non spostano la fine.

create or replace function public.dashboard_riscontri()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with oggi as (
		select (now() at time zone 'Europe/Rome')::date as d
	),
	date_chiusura as (
		select (date_trunc('month', oggi.d) - make_interval(months => k))::date - 1 as giorno, 'mese'::text as tipo
		from oggi, generate_series(0, 36) k
		union all
		select oggi.d, 'oggi' from oggi
		union all
		select (oggi.d - interval '1 year')::date, 'anno_fa' from oggi
	),
	ab as (
		select a.data_vendita, a.data_inizio, a.data_fine, a.totale,
			coalesce(g.gruppo, 'Altro') as gruppo,
			(a.data_fine - a.data_inizio + 1) as giorni
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		where a.cancellato_il is null
			and a.totale > 0
			and a.data_fine >= a.data_inizio
			and a.data_fine > (select min(giorno) from date_chiusura)
	),
	righe as (
		select c.giorno, c.tipo, ab.gruppo,
			round(sum(ab.totale * (ab.data_fine - greatest(c.giorno, ab.data_inizio - 1))::numeric / ab.giorni)) as riscontro,
			round(coalesce(sum(ab.totale) filter (where ab.data_inizio > c.giorno), 0)) as non_iniziati,
			count(*) as abbonamenti
		from date_chiusura c
		join ab on ab.data_fine > c.giorno
			and ab.data_vendita < ((c.giorno + 1)::timestamp at time zone 'Europe/Rome')
			and ab.data_vendita <= now()
		group by grouping sets ((c.giorno, c.tipo, ab.gruppo), (c.giorno, c.tipo))
	)
	select jsonb_build_object(
		'oggi', (select d from oggi),
		'righe', coalesce((
			select jsonb_agg(jsonb_build_object(
				'giorno', giorno, 'tipo', tipo, 'gruppo', gruppo,
				'riscontro', riscontro, 'non_iniziati', non_iniziati, 'abbonamenti', abbonamenti
			) order by giorno, gruppo nulls first)
			from righe
		), '[]'::jsonb)
	);
$$;

revoke execute on function public.dashboard_riscontri() from public, anon, authenticated;
grant execute on function public.dashboard_riscontri() to service_role;

-- Funzioni di lettura per il pannello di Garden (cartella web/).
--
-- Le chiama solo il server Next.js con la service_role, quindi, come per le
-- funzioni del sync, niente execute a public/anon/authenticated. Restituiscono
-- già aggregato (jsonb), così il pannello fa una sola chiamata per pagina.
--
-- Scelte di conteggio (cambiarle qui, il pannello non le conosce):
--   · «prodotti» = abbonamenti esclusi i canoni QUOTA ASSOCIATIVA e QUOTE EXTRA,
--     che hanno quasi tutti e farebbero sembrare tutti i grafici uguali;
--   · «attivo» = non cancellato e data_inizio <= oggi <= data_fine (le
--     sospensioni non sono sottratte);
--   · «in scadenza» = l'ultimo prodotto della persona finisce nei prossimi 30
--     giorni (chi ha già rinnovato non conta);
--   · «rata scaduta» = rata non cancellata, senza data_pagato, scaduta da meno
--     di 90 giorni (le più vecchie sono quasi sempre storico mai chiuso);
--   · incassi = somma di transazioni.importo con movimenta_cassa, al netto
--     degli storni (importi negativi);
--   · le date nel futuro (in Info4U ce ne sono, es. anno 2080) sono scartate;
--   · i giorni sono quelli di Europe/Rome.

-- ───────────────────────────────────────────────────────────── home

create or replace function public.dashboard_home()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with oggi as (
		select (now() at time zone 'Europe/Rome')::date as d,
			date_trunc('month', now() at time zone 'Europe/Rome')::date as inizio_mese
	),
	prodotti as (
		select a.persona_id, a.data_inizio, a.data_fine, a.categoria
		from public.abbonamenti a
		where a.cancellato_il is null
			and a.persona_id is not null
			and a.data_fine is not null
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
	),
	ultimo_prodotto as (
		select persona_id, max(data_fine) as fine
		from prodotti
		group by persona_id
	),
	attivi as (
		select count(distinct p.persona_id) as persone
		from prodotti p, oggi
		where p.data_inizio <= oggi.d and p.data_fine >= oggi.d
	),
	in_scadenza as (
		select count(*) as persone
		from ultimo_prodotto u, oggi
		where u.fine between oggi.d and oggi.d + 30
	),
	categorie as (
		select coalesce(p.categoria, 'Senza categoria') as categoria,
			count(distinct p.persona_id) as persone
		from prodotti p, oggi
		where p.data_inizio <= oggi.d and p.data_fine >= oggi.d
		group by 1
		order by 2 desc, 1
	),
	rate_scadute as (
		select count(*) as n, coalesce(sum(r.importo), 0) as importo
		from public.abbonamenti_rate r, oggi
		where r.cancellato_il is null
			and r.data_pagato is null
			and r.data_rata < oggi.d
			and r.data_rata >= oggi.d - 90
	),
	incassi_tx as (
		select (t.data_operazione at time zone 'Europe/Rome')::date as giorno, t.importo
		from public.transazioni t, oggi
		where t.cancellato_il is null
			and t.movimenta_cassa
			and t.importo is not null
			and t.data_operazione <= now()
			and t.data_operazione >= ((oggi.inizio_mese - interval '11 months')::timestamp at time zone 'Europe/Rome')
	),
	incassi_mesi as (
		select date_trunc('month', giorno::timestamp)::date as mese, round(sum(importo)) as incassi
		from incassi_tx
		group by 1
	),
	incassi_confronto as (
		select
			coalesce(sum(x.importo) filter (where x.giorno >= oggi.inizio_mese), 0) as mese_corrente,
			coalesce(sum(x.importo) filter (
				where x.giorno >= (oggi.inizio_mese - interval '1 month')::date
					and x.giorno <= least((oggi.inizio_mese - interval '1 month')::date + (oggi.d - oggi.inizio_mese), oggi.inizio_mese - 1)
			), 0) as mese_prec_stesso_periodo
		from incassi_tx x, oggi
	),
	ultime_vendite as (
		select a.data_vendita, a.abbonamento, a.categoria, a.totale, p.nome, p.cognome
		from public.abbonamenti a
		left join public.persone p on p.id = a.persona_id
		where a.cancellato_il is null
			and a.data_vendita <= now()
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
		order by a.data_vendita desc
		limit 6
	)
	select jsonb_build_object(
		'oggi', (select d from oggi),
		'aggiornato_al', (select max(valore) from public.sync_info4u_stato where chiave = 'refresh_transazioni'),
		'attivi', (select persone from attivi),
		'in_scadenza_30g', (select persone from in_scadenza),
		'rate_scadute_90g', (select jsonb_build_object('n', n, 'importo', round(importo)) from rate_scadute),
		'incassi_mese', (select jsonb_build_object(
			'corrente', round(mese_corrente),
			'precedente_stesso_periodo', round(mese_prec_stesso_periodo)
		) from incassi_confronto),
		'incassi_mesi', coalesce((
			select jsonb_agg(jsonb_build_object('mese', mese, 'incassi', incassi) order by mese)
			from incassi_mesi
		), '[]'::jsonb),
		'categorie', coalesce((
			select jsonb_agg(jsonb_build_object('categoria', categoria, 'persone', persone))
			from categorie
		), '[]'::jsonb),
		'ultime_vendite', coalesce((
			select jsonb_agg(jsonb_build_object(
				'quando', data_vendita, 'nome', nome, 'cognome', cognome,
				'abbonamento', abbonamento, 'categoria', categoria, 'totale', totale
			) order by data_vendita desc)
			from ultime_vendite
		), '[]'::jsonb)
	);
$$;

-- ─────────────────────────────────────────────────────── abbonamenti

create or replace function public.dashboard_abbonamenti_recenti(p_limit integer default 40)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with ultimi as (
		select a.data_vendita, a.data_inizio, a.data_fine, a.abbonamento, a.categoria, a.totale, p.nome, p.cognome
		from public.abbonamenti a
		left join public.persone p on p.id = a.persona_id
		where a.cancellato_il is null
			and a.data_vendita <= now()
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
		order by a.data_vendita desc
		limit least(greatest(coalesce(p_limit, 40), 1), 200)
	)
	select jsonb_build_object(
		'aggiornato_al', (select max(valore) from public.sync_info4u_stato where chiave = 'refresh_transazioni'),
		'abbonamenti', coalesce((
			select jsonb_agg(jsonb_build_object(
				'quando', data_vendita, 'inizio', data_inizio, 'fine', data_fine,
				'nome', nome, 'cognome', cognome,
				'abbonamento', abbonamento, 'categoria', categoria, 'totale', totale
			) order by data_vendita desc)
			from ultimi
		), '[]'::jsonb)
	);
$$;

-- ─────────────────────────────────────────────────────────── accessi

create or replace function public.dashboard_accessi_recenti(p_limit integer default 40)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with ultimi as (
		select a.data_accesso, a.source_utente_id, a.tipo_servizio
		from public.accessi a
		where a.data_accesso <= now()
		order by a.data_accesso desc
		limit least(greatest(coalesce(p_limit, 40), 1), 200)
	)
	select jsonb_build_object(
		'ultimo_accesso', (select max(data_accesso) from public.accessi where data_accesso <= now()),
		'accessi', coalesce((
			select jsonb_agg(jsonb_build_object(
				'quando', u.data_accesso, 'nome', p.nome, 'cognome', p.cognome, 'servizio', u.tipo_servizio
			) order by u.data_accesso desc)
			from ultimi u
			left join public.persone p on p.source_utente_id = u.source_utente_id
		), '[]'::jsonb)
	);
$$;

revoke execute on function public.dashboard_home() from public, anon, authenticated;
revoke execute on function public.dashboard_abbonamenti_recenti(integer) from public, anon, authenticated;
revoke execute on function public.dashboard_accessi_recenti(integer) from public, anon, authenticated;
grant execute on function public.dashboard_home() to service_role;
grant execute on function public.dashboard_abbonamenti_recenti(integer) to service_role;
grant execute on function public.dashboard_accessi_recenti(integer) to service_role;

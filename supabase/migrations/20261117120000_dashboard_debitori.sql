-- Debitori: rate non pagate per anzianità e persone che le devono (pagina
-- Debitori del pannello).
--
-- Come le altre funzioni del pannello, la chiama solo il server Next.js con la
-- service_role.
--
-- Definizioni (le stesse dei crediti di dashboard_finanza, così i numeri
-- coincidono):
--   · rata aperta = rata non cancellata, non pagata (data_pagato nullo), con
--     importo positivo e data tra il 2012 e 5 anni da oggi;
--   · scaduta se la data è prima di oggi; anzianità = giorni dalla scadenza;
--   · fasce: 1-30 giorni, 31-90, 91-180, 181-365, oltre 365; «in_scadenza» =
--     da oggi a 30 giorni;
--   · la fascia di una persona è quella della sua rata scaduta più vecchia;
--   · «ancora iscritto» = ha un abbonamento (non quota) attivo oggi.

create or replace function public.dashboard_debitori(
	p_filtri jsonb,
	p_limite integer default 50,
	p_salta integer default 0,
	p_ordine text default 'importo'
)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with oggi as (
		select (now() at time zone 'Europe/Rome')::date as d
	),
	f as (
		select
			coalesce(nullif(p_filtri->>'fascia', ''), 'tutte') as fascia,
			case when jsonb_typeof(p_filtri->'gruppi') = 'array' and jsonb_array_length(p_filtri->'gruppi') > 0
				then array(select jsonb_array_elements_text(p_filtri->'gruppi')) end as gruppi,
			nullif(lower(btrim(p_filtri->>'q')), '') as q,
			coalesce((p_filtri->>'iscritti')::boolean, false) as solo_iscritti,
			nullif(p_filtri->>'min', '')::numeric as minimo
	),
	rate as (
		select r.importo, r.data_rata, r.transazione_errore,
			coalesce(r.metodo_pagamento, 'Non indicato') as metodo,
			coalesce(g.gruppo, 'Altro') as gruppo, a.persona_id, a.abbonamento,
			oggi.d - r.data_rata as giorni,
			case
				when r.data_rata < oggi.d - 365 then 'oltre'
				when r.data_rata < oggi.d - 180 then 'g365'
				when r.data_rata < oggi.d - 90 then 'g180'
				when r.data_rata < oggi.d - 30 then 'g90'
				when r.data_rata < oggi.d then 'g30'
				when r.data_rata <= oggi.d + 30 then 'in_scadenza'
				else 'futura'
			end as fascia
		from public.abbonamenti_rate r
		cross join oggi
		left join public.abbonamenti a on a.source_iscrizione_id = r.source_iscrizione_id
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		where r.cancellato_il is null
			and r.data_pagato is null
			and r.importo > 0
			and r.data_rata >= '2012-01-01'
			and r.data_rata <= oggi.d + 1825
	),
	rate_g as (
		select r.* from rate r, f where f.gruppi is null or r.gruppo = any (f.gruppi)
	),
	iscritti as (
		select distinct a.persona_id
		from public.abbonamenti a, oggi
		where a.cancellato_il is null and a.persona_id is not null
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
			and a.data_inizio <= oggi.d and a.data_fine >= oggi.d
	),
	persone as (
		select r.persona_id,
			round(sum(r.importo) filter (where r.giorni > 0), 2) as scaduto,
			count(*) filter (where r.giorni > 0) as rate_scadute,
			max(r.giorni) filter (where r.giorni > 0) as giorni_piu_vecchia,
			min(r.data_rata) filter (where r.giorni > 0) as piu_vecchia,
			round(coalesce(sum(r.importo) filter (where r.giorni <= 0), 0), 2) as da_scadere,
			(array_agg(r.metodo order by r.data_rata desc))[1] as metodo,
			(array_agg(r.transazione_errore order by r.data_rata desc) filter (where r.transazione_errore is not null and r.giorni > 0))[1] as errore,
			(array_agg(r.abbonamento order by r.data_rata desc))[1] as abbonamento,
			(array_agg(r.gruppo order by r.data_rata desc))[1] as gruppo
		from rate_g r
		where r.persona_id is not null
		group by r.persona_id
		having count(*) filter (where r.giorni > 0) > 0
	),
	persone_fascia as (
		select p.*,
			case
				when p.giorni_piu_vecchia > 365 then 'oltre'
				when p.giorni_piu_vecchia > 180 then 'g365'
				when p.giorni_piu_vecchia > 90 then 'g180'
				when p.giorni_piu_vecchia > 30 then 'g90'
				else 'g30'
			end as fascia,
			(i.persona_id is not null) as iscritto
		from persone p
		left join iscritti i on i.persona_id = p.persona_id
	),
	filtrate as (
		select pf.*, pe.nome, pe.cognome, pe.cellulare, pe.email, pe.source_utente_id
		from persone_fascia pf
		join public.persone pe on pe.id = pf.persona_id
		cross join f
		where (f.fascia = 'tutte' or pf.fascia = f.fascia or (f.fascia = 'anno' and pf.fascia <> 'oltre'))
			and (not f.solo_iscritti or pf.iscritto)
			and (f.minimo is null or pf.scaduto >= f.minimo)
			and (f.q is null
				or lower(coalesce(pe.nome, '') || ' ' || coalesce(pe.cognome, '')) like '%' || f.q || '%'
				or lower(coalesce(pe.cognome, '') || ' ' || coalesce(pe.nome, '')) like '%' || f.q || '%')
	)
	select jsonb_build_object(
		'oggi', (select d from oggi),
		'aggiornato_al', (select max(valore) from public.sync_info4u_stato where chiave in ('refresh_rate', 'refresh_transazioni')),
		-- riepilogo per anzianità della rata (tutte le rate, anche senza persona)
		'fasce', coalesce((
			select jsonb_object_agg(fascia, jsonb_build_object('rate', n, 'importo', importo, 'persone', persone))
			from (
				select fascia, count(*) as n, round(sum(importo)) as importo, count(distinct persona_id) as persone
				from rate_g where fascia <> 'futura' group by fascia
			) x
		), '{}'::jsonb),
		-- persone per fascia della loro rata più vecchia, con il totale che devono
		'fasce_persone', coalesce((
			select jsonb_object_agg(fascia, jsonb_build_object('persone', n, 'importo', importo, 'iscritti', iscritti))
			from (
				select fascia, count(*) as n, round(sum(scaduto)) as importo, count(*) filter (where iscritto) as iscritti
				from persone_fascia group by fascia
			) x
		), '{}'::jsonb),
		'totale_scaduto', (select coalesce(round(sum(importo)), 0) from rate_g where giorni > 0),
		'debitori', (select count(*) from persone_fascia),
		'debitori_iscritti', (select count(*) from persone_fascia where iscritto),
		'scaduto_iscritti', (select coalesce(round(sum(scaduto)), 0) from persone_fascia where iscritto),
		'per_gruppo', coalesce((
			select jsonb_agg(jsonb_build_object('gruppo', gruppo, 'importo', importo, 'rate', n) order by importo desc)
			from (select gruppo, round(sum(importo)) as importo, count(*) as n from rate where giorni > 0 group by gruppo) x
		), '[]'::jsonb),
		'per_metodo', coalesce((
			select jsonb_agg(jsonb_build_object('metodo', metodo, 'importo', importo, 'rate', n) order by importo desc)
			from (select metodo, round(sum(importo)) as importo, count(*) as n from rate_g where giorni > 0 group by metodo) x
		), '[]'::jsonb),
		'totale', (select count(*) from filtrate),
		'totale_importo', (select coalesce(round(sum(scaduto)), 0) from filtrate),
		'righe', coalesce((
			select jsonb_agg(jsonb_build_object(
				'persona_id', persona_id, 'nome', nome, 'cognome', cognome, 'cellulare', cellulare, 'email', email,
				'scaduto', scaduto, 'rate_scadute', rate_scadute, 'piu_vecchia', piu_vecchia, 'giorni', giorni_piu_vecchia,
				'fascia', fascia, 'da_scadere', da_scadere, 'metodo', metodo, 'errore', errore,
				'abbonamento', abbonamento, 'gruppo', gruppo, 'iscritto', iscritto, 'ultimo_accesso', ultimo_accesso
			))
			from (
				select pagina.*,
					(select max(g.giorno) from public.accessi_giorno g where g.source_utente_id = pagina.source_utente_id) as ultimo_accesso
				from (
					select * from filtrate
					order by
						case when p_ordine = 'anzianita' then giorni_piu_vecchia end desc nulls last,
						case when p_ordine = 'nome' then lower(coalesce(cognome, '') || ' ' || coalesce(nome, '')) end,
						scaduto desc, persona_id
					limit least(greatest(coalesce(p_limite, 50), 1), 20000)
					offset greatest(coalesce(p_salta, 0), 0)
				) pagina
			) x
		), '[]'::jsonb)
	);
$$;

comment on function public.dashboard_debitori(jsonb, integer, integer, text) is
	'Rate non pagate per anzianità (importi, rate, persone), per gruppo e metodo, ed elenco dei debitori con la fascia della rata più vecchia. Filtri: fascia (tutte, anno = ultimo anno, o una fascia), gruppi, q, iscritti (solo ancora iscritti), min (importo minimo).';

revoke execute on function public.dashboard_debitori(jsonb, integer, integer, text) from public, anon, authenticated;
grant execute on function public.dashboard_debitori(jsonb, integer, integer, text) to service_role;

-- Certificati medici degli iscritti attivi (pagina Certificati del pannello).
--
-- Come le altre funzioni del pannello, la chiama solo il server Next.js con la
-- service_role.
--
-- Definizioni (cambiarle qui, il pannello non le conosce):
--   · si guardano solo gli iscritti attivi oggi (un prodotto non quota
--     iniziato e non finito) che hanno compiuto 6 anni: sotto i 6 anni il
--     certificato non serve. Chi non ha la data di nascita in Info4U resta
--     dentro (non si può escludere) ed è contato a parte (senza_data_nascita);
--   · il certificato di una persona = quello con la scadenza più lontana,
--     qualunque tipo (annuale, agonistico, autocertificazione);
--   · fasce: «mai» = nessun certificato in Info4U; «scaduto» diviso per da
--     quanto: 1-30 giorni, 31-90, 91-180, 181-365, oltre 365; «in_scadenza» =
--     scade da oggi a 30 giorni; «valido» = oltre 30 giorni;
--   · respinti = passaggi al tornello rifiutati per certificato non valido
--     (tipo_accesso -6) negli ultimi 30 giorni.

create or replace function public.dashboard_certificati(
	p_filtri jsonb,
	p_limite integer default 50,
	p_salta integer default 0
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
			coalesce(nullif(p_filtri->>'fascia', ''), 'da_sistemare') as fascia,
			case when jsonb_typeof(p_filtri->'gruppi') = 'array' and jsonb_array_length(p_filtri->'gruppi') > 0
				then array(select jsonb_array_elements_text(p_filtri->'gruppi')) end as gruppi,
			nullif(lower(btrim(p_filtri->>'q')), '') as q
	),
	-- iscritti attivi, con il gruppo e l'abbonamento che finisce più tardi
	attivi as (
		select distinct on (a.persona_id) a.persona_id, a.abbonamento, coalesce(g.gruppo, 'Altro') as gruppo, a.data_fine
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		cross join oggi
		where a.cancellato_il is null
			and a.persona_id is not null
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
			and a.data_inizio <= oggi.d and a.data_fine >= oggi.d
		order by a.persona_id, a.data_fine desc
	),
	cert as (
		select distinct on (c.source_utente_id) c.source_utente_id, c.data_scadenza, c.descrizione
		from public.certificati c
		where c.data_scadenza is not null
		order by c.source_utente_id, c.data_scadenza desc
	),
	persone as (
		select pe.id, pe.nome, pe.cognome, pe.cellulare, pe.email, pe.source_utente_id,
			date_part('year', age(oggi.d, pe.data_nascita))::int as eta,
			at.abbonamento, at.gruppo, at.data_fine as fine_abbonamento,
			c.data_scadenza, c.descrizione as tipo,
			case when c.data_scadenza is null then null else oggi.d - c.data_scadenza end as giorni_scaduto,
			case
				when c.data_scadenza is null then 'mai'
				when c.data_scadenza >= oggi.d + 31 then 'valido'
				when c.data_scadenza >= oggi.d then 'in_scadenza'
				when c.data_scadenza >= oggi.d - 30 then 'scaduto_30'
				when c.data_scadenza >= oggi.d - 90 then 'scaduto_90'
				when c.data_scadenza >= oggi.d - 180 then 'scaduto_180'
				when c.data_scadenza >= oggi.d - 365 then 'scaduto_365'
				else 'scaduto_oltre'
			end as fascia
		from attivi at
		join public.persone pe on pe.id = at.persona_id
		cross join oggi
		left join cert c on c.source_utente_id = pe.source_utente_id
		where pe.data_nascita is null or pe.data_nascita <= (oggi.d - interval '6 years')::date
	),
	per_gruppo as (
		select p.*
		from persone p, f
		where (f.gruppi is null or p.gruppo = any (f.gruppi))
	),
	filtrate as (
		select p.*
		from per_gruppo p, f
		where (f.fascia = 'tutti'
				or p.fascia = f.fascia
				or (f.fascia = 'scaduti' and p.fascia like 'scaduto%')
				or (f.fascia = 'da_sistemare' and p.fascia not in ('valido')))
			and (f.q is null
				or lower(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, '')) like '%' || f.q || '%'
				or lower(coalesce(p.cognome, '') || ' ' || coalesce(p.nome, '')) like '%' || f.q || '%')
	)
	select jsonb_build_object(
		'oggi', (select d from oggi),
		'aggiornato_al', (select max(valore) from public.sync_info4u_stato where chiave like 'extra_refresh_certificati%'),
		'attivi', (select count(*) from per_gruppo),
		'senza_data_nascita', (select count(*) from per_gruppo where eta is null),
		'fasce', coalesce((select jsonb_object_agg(fascia, n) from (select fascia, count(*) as n from per_gruppo group by fascia) x), '{}'::jsonb),
		'gruppi', coalesce((
			select jsonb_agg(jsonb_build_object('gruppo', gruppo, 'fascia', fascia, 'n', n) order by gruppo, fascia)
			from (select gruppo, fascia, count(*) as n from persone group by gruppo, fascia) x
		), '[]'::jsonb),
		'tipi', coalesce((
			select jsonb_agg(jsonb_build_object('tipo', tipo, 'n', n) order by n desc)
			from (select coalesce(tipo, 'Nessuno') as tipo, count(*) as n from per_gruppo group by 1) x
		), '[]'::jsonb),
		'totale', (select count(*) from filtrate),
		'righe', coalesce((
			select jsonb_agg(jsonb_build_object(
				'persona_id', id, 'nome', nome, 'cognome', cognome, 'cellulare', cellulare, 'email', email, 'eta', eta,
				'abbonamento', abbonamento, 'gruppo', gruppo, 'fine_abbonamento', fine_abbonamento,
				'scadenza', data_scadenza, 'tipo', tipo, 'giorni_scaduto', giorni_scaduto, 'fascia', fascia,
				'respinti_30g', respinti, 'ultimo_accesso', ultimo_accesso
			))
			from (
				select pagina.*,
					(select count(*) from public.accessi x, oggi
						where x.source_utente_id = pagina.source_utente_id and x.tipo_accesso = -6
							and x.data_accesso >= (oggi.d - 30)::timestamp at time zone 'Europe/Rome') as respinti,
					(select max(g.giorno) from public.accessi_giorno g where g.source_utente_id = pagina.source_utente_id) as ultimo_accesso
				from (
					select * from filtrate
					order by
						case fascia when 'in_scadenza' then 0 else 1 end,
						case when fascia = 'in_scadenza' then data_scadenza end asc,
						data_scadenza desc nulls first,
						lower(coalesce(cognome, '')), lower(coalesce(nome, ''))
					limit least(greatest(coalesce(p_limite, 50), 1), 20000)
					offset greatest(coalesce(p_salta, 0), 0)
				) pagina
			) x
		), '[]'::jsonb)
	);
$$;

comment on function public.dashboard_certificati(jsonb, integer, integer) is
	'Certificati medici degli iscritti attivi dai 6 anni compiuti: conteggi per fascia (mai consegnato, scaduto da…, in scadenza entro 30 giorni, valido), per gruppo e per tipo, ed elenco delle persone. Filtri: fascia, gruppi, q.';

revoke execute on function public.dashboard_certificati(jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.dashboard_certificati(jsonb, integer, integer) to service_role;

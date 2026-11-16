-- Dashboard degli accessi ai tornelli per il pannello di Garden (pagina Accessi).
--
-- Come le altre funzioni del pannello, le chiama solo il server Next.js con la
-- service_role (niente execute a public/anon/authenticated).
--
-- Definizioni (cambiarle qui, il pannello non le conosce):
--   · «ingresso» = passaggio valido al tornello: tipo_accesso positivo
--     (abbonamento, prenotazione, omaggio, appuntamento, apertura forzata…),
--     esclusi lettore di uscita (1), uscita pagata (22), Gold card (100, sono
--     tessere dello staff), card gestore (999) ed eventi di erogazione (≥ 2000);
--   · «rifiutato» = tipo_accesso negativo (pagamento scaduto, iscrizione
--     scaduta, certificato non valido…), col motivo da esiti_accesso;
--   · «presenza» = una persona in un giorno: chi passa tre volte nello stesso
--     giorno conta una presenza;
--   · «frequenza settimanale» = presenze ÷ settimane in cui la persona è
--     venuta almeno una volta (settimane da lunedì). Dice quante volte a
--     settimana viene chi viene, non si abbassa per chi è in vacanza;
--   · «ora di arrivo» = l'ora del primo ingresso della giornata;
--   · varco = terminale (terminali_info4u, chiave terminale + indirizzo +
--     concentratore);
--   · abbonamento di un ingresso = la vendita (source_iscrizione_id) che l'ha
--     aperto; il gruppo da prodotti_gruppi;
--   · date oltre oggi (Info4U ne ha qualcuna nel 2055 e 2080) scartate;
--   · i giorni sono quelli di Europe/Rome.

create or replace function public.dashboard_accessi(p_da date, p_a date)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with f as (
		select least(p_da, p_a) as da, greatest(p_da, p_a) as a
	),
	base as (
		select
			(x.data_accesso at time zone 'Europe/Rome') as ts,
			(x.data_accesso at time zone 'Europe/Rome')::date as giorno,
			x.source_utente_id as u,
			x.source_terminale_id, x.indirizzo, x.source_concentratore_id,
			x.tipo_accesso, x.source_iscrizione_id
		from public.accessi x, f
		where x.data_accesso >= (f.da::timestamp at time zone 'Europe/Rome')
			and x.data_accesso < ((f.a + 1)::timestamp at time zone 'Europe/Rome')
			and x.data_accesso <= now()
	),
	validi as (
		select * from base
		where tipo_accesso > 0 and tipo_accesso < 2000 and tipo_accesso not in (1, 22, 100, 999)
			and u is not null
	),
	presenze as (
		select u, giorno, min(ts) as arrivo, date_trunc('week', giorno)::date as settimana
		from validi
		group by u, giorno
	),
	sett_persona as (
		select u, count(distinct settimana) as settimane, count(*) as presenze
		from presenze
		group by u
	),
	-- quanti lunedì, martedì… ci sono nel periodo: per la media di un giorno tipo
	calendario as (
		select extract(isodow from g)::int as dow, count(*) as giorni
		from f, generate_series(f.da, least(f.a, (now() at time zone 'Europe/Rome')::date), interval '1 day') g
		group by 1
	),
	per_dow as (
		select extract(isodow from giorno)::int as dow, count(*) as presenze
		from presenze group by 1
	),
	per_ora as (
		select extract(isodow from giorno)::int as dow, extract(hour from arrivo)::int as ora, count(*) as presenze
		from presenze group by 1, 2
	),
	per_giorno as (
		select giorno, count(*) as presenze from presenze group by 1
	),
	varchi as (
		select coalesce(t.descrizione, 'Varco ' || b.source_terminale_id || '/' || b.indirizzo) as varco,
			count(*) filter (where b.tipo_accesso > 0 and b.tipo_accesso < 2000 and b.tipo_accesso not in (1, 22, 100, 999)) as ingressi,
			count(distinct b.u) filter (where b.tipo_accesso > 0 and b.tipo_accesso < 2000 and b.tipo_accesso not in (1, 22, 100, 999)) as persone,
			count(*) filter (where b.tipo_accesso < 0) as rifiutati
		from base b
		left join public.terminali_info4u t
			on t.source_terminale_id = b.source_terminale_id
			and t.indirizzo = b.indirizzo
			and t.source_concentratore_id = b.source_concentratore_id
		group by 1
	),
	rifiuti as (
		select coalesce(e.descrizione, 'Esito ' || b.tipo_accesso) as motivo, count(*) as n, count(distinct b.u) as persone
		from base b
		left join public.esiti_accesso e on e.numero_esito = b.tipo_accesso
		where b.tipo_accesso < 0
		group by 1
	),
	-- abbonamento che ha aperto il tornello (una presenza per persona, giorno e prodotto)
	pres_abb as (
		select distinct v.u, v.giorno, date_trunc('week', v.giorno)::date as settimana,
			coalesce(a.abbonamento, 'Senza abbonamento collegato') as abbonamento,
			coalesce(g.gruppo, case when a.id is null then 'Senza abbonamento' else 'Altro' end) as gruppo
		from validi v
		left join public.abbonamenti a on a.source_iscrizione_id = v.source_iscrizione_id
		left join public.prodotti_gruppi g on g.categoria = a.categoria
	),
	per_abb as (
		select abbonamento, gruppo, count(*) as presenze, count(distinct u) as persone,
			count(distinct (u, settimana)) as settimane_persona
		from pres_abb group by abbonamento, gruppo
	),
	per_gruppo as (
		select gruppo, count(*) as presenze, count(distinct u) as persone,
			count(distinct (u, settimana)) as settimane_persona
		from pres_abb group by gruppo
	),
	top_utenti as (
		select s.u, s.presenze, s.settimane,
			(select count(*) from validi v where v.u = s.u) as ingressi
		from sett_persona s
		order by s.presenze desc, s.u
		limit 30
	)
	select jsonb_build_object(
		'da', (select da from f),
		'a', (select a from f),
		'ultimo_accesso', (select max(data_accesso) from public.accessi where data_accesso <= now()),
		'totali', jsonb_build_object(
			'ingressi', (select count(*) from validi),
			'presenze', (select count(*) from presenze),
			'persone', (select count(*) from sett_persona),
			'settimane_persona', (select coalesce(sum(settimane), 0) from sett_persona),
			'rifiutati', (select count(*) from base where tipo_accesso < 0),
			'giorni', (select coalesce(sum(giorni), 0) from calendario),
			'giorni_aperti', (select count(*) from per_giorno)
		),
		'giorni_settimana', coalesce((
			select jsonb_agg(jsonb_build_object('dow', c.dow, 'giorni', c.giorni, 'presenze', coalesce(d.presenze, 0)) order by c.dow)
			from calendario c left join per_dow d using (dow)
		), '[]'::jsonb),
		'ore', coalesce((
			select jsonb_agg(jsonb_build_object('dow', dow, 'ora', ora, 'presenze', presenze))
			from per_ora
		), '[]'::jsonb),
		'giorni', coalesce((
			select jsonb_agg(jsonb_build_object('giorno', giorno, 'presenze', presenze) order by giorno)
			from per_giorno
		), '[]'::jsonb),
		'varchi', coalesce((
			select jsonb_agg(jsonb_build_object('varco', varco, 'ingressi', ingressi, 'persone', persone, 'rifiutati', rifiutati) order by ingressi desc)
			from varchi where ingressi > 0 or rifiutati > 0
		), '[]'::jsonb),
		'rifiuti', coalesce((
			select jsonb_agg(jsonb_build_object('motivo', motivo, 'n', n, 'persone', persone) order by n desc)
			from rifiuti
		), '[]'::jsonb),
		'abbonamenti', coalesce((
			select jsonb_agg(jsonb_build_object('abbonamento', abbonamento, 'gruppo', gruppo, 'presenze', presenze, 'persone', persone, 'settimane_persona', settimane_persona) order by presenze desc)
			from (select * from per_abb order by presenze desc limit 40) x
		), '[]'::jsonb),
		'gruppi', coalesce((
			select jsonb_agg(jsonb_build_object('gruppo', gruppo, 'presenze', presenze, 'persone', persone, 'settimane_persona', settimane_persona) order by presenze desc)
			from per_gruppo
		), '[]'::jsonb),
		'utenti', coalesce((
			select jsonb_agg(jsonb_build_object(
				'nome', p.nome, 'cognome', p.cognome, 'presenze', t.presenze, 'settimane', t.settimane, 'ingressi', t.ingressi
			) order by t.presenze desc, t.u)
			from top_utenti t
			left join public.persone p on p.source_utente_id = t.u
		), '[]'::jsonb)
	);
$$;

comment on function public.dashboard_accessi(date, date) is
	'Accessi ai tornelli nel periodo: ingressi, presenze (persona-giorno), frequenza settimanale, giorni della settimana, ore di arrivo, varchi, rifiuti, abbonamenti e persone con più presenze.';

-- Mese per mese, dal gennaio di tre anni fa a oggi: per i confronti con gli anni scorsi.
create or replace function public.dashboard_accessi_mensile()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with f as (
		select make_date(extract(year from (now() at time zone 'Europe/Rome'))::int - 3, 1, 1) as da
	),
	presenze as (
		select x.source_utente_id as u,
			(x.data_accesso at time zone 'Europe/Rome')::date as giorno,
			count(*) as ingressi
		from public.accessi x, f
		where x.data_accesso >= (f.da::timestamp at time zone 'Europe/Rome')
			and x.data_accesso <= now()
			and x.tipo_accesso > 0 and x.tipo_accesso < 2000 and x.tipo_accesso not in (1, 22, 100, 999)
			and x.source_utente_id is not null
		group by 1, 2
	),
	mesi as (
		select date_trunc('month', giorno)::date as mese,
			count(*) as presenze,
			sum(ingressi) as ingressi,
			count(distinct u) as persone,
			count(distinct (u, date_trunc('week', giorno))) as settimane_persona
		from presenze
		group by 1
	)
	select jsonb_build_object(
		'mesi', coalesce((
			select jsonb_agg(jsonb_build_object(
				'mese', mese, 'presenze', presenze, 'ingressi', ingressi, 'persone', persone, 'settimane_persona', settimane_persona
			) order by mese)
			from mesi
		), '[]'::jsonb)
	);
$$;

comment on function public.dashboard_accessi_mensile() is
	'Presenze, ingressi, persone e settimane-persona mese per mese dal gennaio di tre anni fa.';

revoke execute on function public.dashboard_accessi(date, date) from public, anon, authenticated;
revoke execute on function public.dashboard_accessi_mensile() from public, anon, authenticated;
grant execute on function public.dashboard_accessi(date, date) to service_role;
grant execute on function public.dashboard_accessi_mensile() to service_role;

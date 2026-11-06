-- Correzioni alle sezioni Accessi e Soci.
--
-- Accessi: andava in timeout. Ora c'e' un indice sulla data, il calcolo guarda
-- solo gli ultimi 800 giorni (una volta sola), i confronti mensili si fanno con
-- un raggruppamento invece di un conteggio per mese, e «ultimo accesso» si
-- cerca solo negli ultimi 90 giorni: chi non compare e' «oltre 90 giorni o mai».
-- Soci: nelle fasce di eta' alcune comparivano due volte (ordinamento sbagliato).

create index if not exists accessi_data_idx on public.accessi (data_accesso);

create or replace function public.sez_accessi(p_oggi date, p_gruppi text[] default null)
returns jsonb
language sql stable
set search_path to 'public'
as $$
with
ult as (
	select least(p_oggi, coalesce((max(a.data_accesso) at time zone 'Europe/Rome')::date, p_oggi)) as fine
	from public.accessi a
	where a.data_accesso >= timestamptz '2016-01-01' and a.data_accesso < (p_oggi + 1)::timestamptz and a.tipo_accesso >= 2
),
acc as materialized (
	select
		(a.data_accesso at time zone 'Europe/Rome')::date as giorno,
		extract(hour from a.data_accesso at time zone 'Europe/Rome')::int as ora,
		a.source_utente_id
	from public.accessi a cross join ult
	where a.tipo_accesso >= 2
		and a.data_accesso >= (ult.fine - 800)::timestamptz and a.data_accesso < (ult.fine + 1)::timestamptz
),
kpi as (
	select
		count(*) filter (where giorno > ult.fine - 7) as sette,
		count(*) filter (where giorno between ult.fine - 370 and ult.fine - 364) as sette_prec,
		count(*) filter (where giorno > ult.fine - 30) as trenta,
		count(*) filter (where giorno between ult.fine - 393 and ult.fine - 364) as trenta_prec,
		count(distinct source_utente_id) filter (where giorno > ult.fine - 30) as soci_30,
		count(distinct source_utente_id) filter (where giorno between ult.fine - 393 and ult.fine - 364) as soci_30_prec
	from acc cross join ult
),
per_mese as (
	select date_trunc('month', giorno)::date as mese, count(*) as n from acc group by 1
),
mese_corrente_prec as (
	select count(*) as n from acc cross join ult
	where giorno between (date_trunc('month', ult.fine) - interval '1 year')::date and (ult.fine - interval '1 year')::date
),
mesi as (
	select (date_trunc('month', ult.fine) - make_interval(months => n))::date as mese_da, n as indietro
	from generate_series(0, 11) n cross join ult
),
mensile as (
	select m.mese_da,
		coalesce((select pm.n from per_mese pm where pm.mese = m.mese_da), 0) as n,
		case when m.indietro = 0 then (select n from mese_corrente_prec)
			else coalesce((select pm.n from per_mese pm where pm.mese = (m.mese_da - interval '1 year')::date), 0) end as n_prec
	from mesi m
),
ora as (
	select a.ora, count(*) as n
	from acc a cross join ult where a.giorno > ult.fine - 91 and a.ora between 5 and 23 group by a.ora
),
settimana as (
	select extract(isodow from a.giorno)::int as giorno_sett, count(*) as n
	from acc a cross join ult where a.giorno > ult.fine - 91 group by 1
),
attivi as (
	select a.source_utente_id, coalesce(g.gruppo, 'Altro') as gruppo
	from public.abbonamenti a
	cross join ult
	left join public.prodotti_gruppi g on g.categoria = a.categoria
	where a.cancellato_il is null and a.source_utente_id is not null
		and a.data_inizio <= ult.fine and a.data_fine >= ult.fine
		and coalesce(g.gruppo, 'Altro') <> 'Quote e tessere'
),
ultimo as (
	select source_utente_id, max(giorno) as ultimo
	from acc cross join ult where giorno > ult.fine - 91 group by source_utente_id
),
soci as (
	select distinct s.source_utente_id, (select fine from ult) - u.ultimo as giorni
	from attivi s left join ultimo u on u.source_utente_id = s.source_utente_id
),
fasce as (
	select
		count(*) as attivi,
		count(*) filter (where giorni <= 30) as entrati_30,
		count(*) filter (where giorni between 31 and 60) as da_31_60,
		count(*) filter (where giorni between 61 and 90) as da_61_90,
		count(*) filter (where giorni is null) as oltre_90
	from soci
),
per_gruppo as (
	select s.gruppo, count(distinct s.source_utente_id) as attivi,
		count(distinct s.source_utente_id) filter (where u.ultimo is null or (select fine from ult) - u.ultimo > 30) as inattivi
	from attivi s left join ultimo u on u.source_utente_id = s.source_utente_id
	group by s.gruppo
)
select jsonb_build_object(
	'oggi', p_oggi,
	'fine', (select fine from ult),
	'kpi', (select to_jsonb(kpi) from kpi),
	'mensile', coalesce((select jsonb_agg(jsonb_build_object('mese_da', mese_da, 'n', n, 'n_prec', n_prec) order by mese_da) from mensile), '[]'::jsonb),
	'ore', coalesce((select jsonb_agg(jsonb_build_object('ora', ora, 'n', n) order by ora) from ora), '[]'::jsonb),
	'settimana', coalesce((select jsonb_agg(jsonb_build_object('giorno', giorno_sett, 'n', n) order by giorno_sett) from settimana), '[]'::jsonb),
	'inattivi', (select to_jsonb(fasce) from fasce),
	'inattivi_gruppi', coalesce((select jsonb_agg(jsonb_build_object('gruppo', gruppo, 'attivi', attivi, 'inattivi', inattivi) order by attivi desc) from per_gruppo), '[]'::jsonb)
);
$$;

create or replace function public.sez_soci(p_oggi date, p_gruppi text[] default null)
returns jsonb
language sql stable
set search_path to 'public'
as $$
with
nonquote as (
	select a.persona_id, a.data_inizio, a.data_fine, a.data_vendita
	from public.abbonamenti a
	left join public.prodotti_gruppi g on g.categoria = a.categoria
	where a.cancellato_il is null and a.persona_id is not null
		and coalesce(g.gruppo, 'Altro') <> 'Quote e tessere'
		and a.data_inizio is not null and a.data_fine is not null
),
attivi as (select distinct persona_id from nonquote where data_inizio <= p_oggi and data_fine >= p_oggi),
prima as (
	select persona_id, min((data_vendita at time zone 'Europe/Rome')::date) as primo
	from nonquote where data_vendita >= timestamptz '2016-01-01' and data_vendita < (p_oggi + 1)::timestamptz
	group by persona_id
),
pers as (
	select p.id,
		case when p.data_nascita between date '1920-01-01' and p_oggi then date_part('year', age(p_oggi, p.data_nascita))::int end as eta,
		case p.sesso when 'M' then 'Uomini' when 'F' then 'Donne' else 'Non indicato' end as sesso,
		coalesce(nullif(replace(upper(btrim(p.indirizzo_citta)), 'SANTARCANGELO DI ROMAGNA', 'SANTARCANGELO'), ''), 'Non indicata') as zona,
		pr.primo
	from attivi a
	join public.persone p on p.id = a.persona_id
	left join prima pr on pr.persona_id = a.persona_id
),
eta_fascia as (
	select
		case when eta is null then 10 when eta < 6 then 0 when eta < 12 then 1 when eta < 18 then 2 when eta < 25 then 3
			when eta < 35 then 4 when eta < 45 then 5 when eta < 55 then 6 when eta < 65 then 7 else 8 end as ordine
	from pers
),
fasce_eta as (
	select ordine, count(*) as n from eta_fascia group by ordine
),
sesso as (select sesso, count(*) as n from pers group by 1),
zone as (
	select zona, count(*) as n from pers group by 1
),
zone_top as (
	select case when rn <= 8 or zona = 'Non indicata' then zona else 'Altre zone' end as zona, sum(n) as n
	from (select zona, n, row_number() over (order by (zona = 'Non indicata'), n desc) as rn from zone) z
	group by 1
),
anzianita as (
	select
		case when primo is null then 3
			when p_oggi - primo < 365 then 0 when p_oggi - primo < 3 * 365 then 1
			when p_oggi - primo < 6 * 365 then 2 else 3 end as ordine,
		count(*) as n
	from pers group by 1
),
mesi as (
	select (date_trunc('month', p_oggi) - make_interval(months => n))::date as mese_da,
		least(((date_trunc('month', p_oggi) - make_interval(months => n)) + interval '1 month - 1 day')::date, p_oggi) as fine
	from generate_series(0, 11) n
),
nuovi as (
	select m.mese_da,
		(select count(*) from prima x where x.primo between m.mese_da and m.fine) as n,
		(select count(*) from prima x where x.primo between (m.mese_da - interval '1 year')::date and (m.fine - interval '1 year')::date) as n_prec
	from mesi m
)
select jsonb_build_object(
	'oggi', p_oggi,
	'totale', (select count(*) from pers),
	'eta_media', (select round(avg(eta), 1) from pers where eta is not null),
	'eta_nota', (select count(*) from pers where eta is null),
	'fasce_eta', coalesce((select jsonb_agg(jsonb_build_object('fascia',
		(array['0-5', '6-11', '12-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+', '', 'Non indicata'])[ordine + 1], 'n', n) order by ordine) from fasce_eta), '[]'::jsonb),
	'sesso', coalesce((select jsonb_agg(jsonb_build_object('sesso', sesso, 'n', n) order by n desc) from sesso), '[]'::jsonb),
	'zone', coalesce((select jsonb_agg(jsonb_build_object('zona', zona, 'n', n) order by (zona in ('Altre zone', 'Non indicata')), n desc) from zone_top), '[]'::jsonb),
	'anzianita', coalesce((select jsonb_agg(jsonb_build_object('fascia',
		(array['Meno di 1 anno', '1-3 anni', '3-6 anni', 'Oltre 6 anni'])[ordine + 1], 'n', n) order by ordine) from anzianita), '[]'::jsonb),
	'nuovi', coalesce((select jsonb_agg(jsonb_build_object('mese_da', mese_da, 'n', n, 'n_prec', n_prec) order by mese_da) from nuovi), '[]'::jsonb)
);
$$;

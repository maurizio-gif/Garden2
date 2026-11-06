-- Cruscotto: sezioni Accessi, Soci e Operatori, e le sospensioni al posto delle
-- disdette nelle Vendite.
--
-- Le disdette non sono registrate nel Info4U di Garden (data_disdetta e' vuota:
-- una in tutto il 2025), quindi la sezione Vendite mostra le sospensioni degli
-- abbonamenti, che invece ci sono.

-- ───────────────────────────────────────────────────── Vendite (sostituisce la precedente)
create or replace function public.sez_vendite(p_oggi date, p_gruppi text[] default null)
returns jsonb
language sql stable
set search_path to 'public'
as $$
with
base as (
	select
		a.abbonamento, a.totale, a.importo_listino, a.data_disdetta,
		(a.data_vendita at time zone 'Europe/Rome')::date as giorno,
		coalesce(g.gruppo, 'Altro') as gruppo
	from public.abbonamenti a
	left join public.prodotti_gruppi g on g.categoria = a.categoria
	where a.cancellato_il is null
		and a.data_vendita >= timestamptz '2016-01-01' and a.data_vendita < (p_oggi + 1)::timestamptz
),
v as (select * from base where p_gruppi is null or gruppo = any (p_gruppi)),
p as (
	select
		date_trunc('month', p_oggi)::date as mese_da,
		date_trunc('month', p_oggi - interval '1 year')::date as mese_da_prec,
		(p_oggi - interval '1 year')::date as oggi_prec,
		date_trunc('year', p_oggi)::date as anno_da,
		date_trunc('year', p_oggi - interval '1 year')::date as anno_da_prec
),
scontato as (
	select *, greatest(coalesce(importo_listino, 0) - totale, 0) as sconto,
		(coalesce(importo_listino, 0) > totale) as e_scontata
	from v
),
kpi as (
	select
		count(*) filter (where giorno >= p.anno_da) as vendite_anno,
		count(*) filter (where giorno between p.anno_da_prec and p.oggi_prec) as vendite_anno_prec,
		coalesce(sum(totale) filter (where giorno >= p.anno_da), 0) as fatturato_anno,
		coalesce(sum(totale) filter (where giorno between p.anno_da_prec and p.oggi_prec), 0) as fatturato_anno_prec,
		count(*) filter (where giorno >= p.anno_da and e_scontata) as scontate_anno,
		count(*) filter (where giorno between p.anno_da_prec and p.oggi_prec and e_scontata) as scontate_anno_prec,
		coalesce(sum(sconto) filter (where giorno >= p.anno_da), 0) as sconto_anno,
		coalesce(sum(sconto) filter (where giorno between p.anno_da_prec and p.oggi_prec), 0) as sconto_anno_prec
	from scontato cross join p
	group by p.anno_da, p.anno_da_prec, p.oggi_prec
),
sosp as (
	select s.data_inizio
	from public.abbonamenti_sospensioni s
	join public.abbonamenti a on a.source_iscrizione_id = s.source_iscrizione_id
	left join public.prodotti_gruppi g on g.categoria = a.categoria
	where s.cancellato_il is null and s.data_inizio between date '2016-01-01' and p_oggi
		and (p_gruppi is null or coalesce(g.gruppo, 'Altro') = any (p_gruppi))
),
sospensioni as (
	select
		count(*) filter (where data_inizio >= p.mese_da) as sospensioni_mese,
		count(*) filter (where data_inizio between p.mese_da_prec and p.oggi_prec) as sospensioni_mese_prec,
		count(*) filter (where data_inizio >= p.anno_da) as sospensioni_anno,
		count(*) filter (where data_inizio between p.anno_da_prec and p.oggi_prec) as sospensioni_anno_prec
	from sosp cross join p
),
mesi as (
	select (date_trunc('month', p_oggi) - make_interval(months => n))::date as mese_da,
		least(((date_trunc('month', p_oggi) - make_interval(months => n)) + interval '1 month - 1 day')::date, p_oggi) as fine
	from generate_series(0, 11) n
),
sospensioni_mensili as (
	select m.mese_da, count(s.data_inizio) as n
	from mesi m left join sosp s on s.data_inizio between m.mese_da and m.fine
	group by 1
),
prodotti as (
	select abbonamento, gruppo,
		count(*) filter (where giorno >= p.anno_da) as vendite,
		coalesce(sum(totale) filter (where giorno >= p.anno_da), 0) as fatturato,
		coalesce(sum(totale) filter (where giorno between p.anno_da_prec and p.oggi_prec), 0) as fatturato_prec
	from v cross join p
	group by abbonamento, gruppo
	having count(*) filter (where giorno >= p.anno_da) > 0
	order by 4 desc
	limit 12
),
gruppi as (
	select gruppo,
		count(*) filter (where giorno >= p.anno_da) as vendite,
		coalesce(sum(totale) filter (where giorno >= p.anno_da), 0) as fatturato,
		coalesce(sum(totale) filter (where giorno between p.anno_da_prec and p.oggi_prec), 0) as fatturato_prec
	from v cross join p
	group by gruppo
)
select jsonb_build_object(
	'oggi', p_oggi,
	'kpi', (select to_jsonb(kpi) from kpi) || (select to_jsonb(sospensioni) from sospensioni),
	'prodotti', coalesce((select jsonb_agg(to_jsonb(x)) from prodotti x), '[]'::jsonb),
	'gruppi', coalesce((select jsonb_agg(to_jsonb(g) order by g.fatturato desc) from gruppi g), '[]'::jsonb),
	'sospensioni_mensili', coalesce((select jsonb_agg(jsonb_build_object('mese_da', mese_da, 'n', n) order by mese_da) from sospensioni_mensili), '[]'::jsonb)
);
$$;


-- ───────────────────────────────────────────────────────────── Accessi
-- Affluenza per giorno e fascia oraria e soci attivi che hanno smesso di venire.
-- Conta gli ingressi consentiti (tipo_accesso >= 2: abbonamento, prenotazione,
-- omaggio, gold card...); i rifiuti (negativi) e il lettore di uscita (1) no.
-- Il riferimento e' l'ultimo giorno con accessi caricati (non oltre oggi): cosi'
-- la sezione e' leggibile anche mentre lo storico si sta ancora caricando.
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
acc as (
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
mesi as (
	select (date_trunc('month', ult.fine) - make_interval(months => n))::date as mese_da,
		least(((date_trunc('month', ult.fine) - make_interval(months => n)) + interval '1 month - 1 day')::date, ult.fine) as fine
	from generate_series(0, 11) n cross join ult
),
mensile as (
	select m.mese_da, count(a.giorno) as n,
		(select count(*) from acc b where b.giorno between (m.mese_da - interval '1 year')::date and (m.fine - interval '1 year')::date) as n_prec
	from mesi m left join acc a on a.giorno between m.mese_da and m.fine
	group by m.mese_da, m.fine
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
	select a.source_utente_id, max((a.data_accesso at time zone 'Europe/Rome')::date) as ultimo
	from public.accessi a cross join ult
	where a.tipo_accesso >= 2 and a.data_accesso >= timestamptz '2016-01-01' and a.data_accesso < (ult.fine + 1)::timestamptz
	group by a.source_utente_id
),
soci as (
	select distinct s.source_utente_id, u.ultimo, (select fine from ult) - u.ultimo as giorni
	from attivi s left join ultimo u on u.source_utente_id = s.source_utente_id
),
fasce as (
	select
		count(*) as attivi,
		count(*) filter (where giorni <= 30) as entrati_30,
		count(*) filter (where giorni between 31 and 60) as da_31_60,
		count(*) filter (where giorni between 61 and 90) as da_61_90,
		count(*) filter (where giorni > 90) as oltre_90,
		count(*) filter (where giorni is null) as mai
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

-- ───────────────────────────────────────────────────────────── Soci
-- Chi sono i soci attivi, in forma anonima: eta', sesso e zona, mai nomi ne'
-- recapiti. «Attivo» come nella Direzione: abbonamento in corso, escluse le
-- quote associative. L'anzianita' parte dal primo abbonamento caricato (dal 2016).
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
fasce_eta as (
	select
		case when eta is null then 'Non indicata' when eta < 6 then '0-5' when eta < 12 then '6-11' when eta < 18 then '12-17'
			when eta < 25 then '18-24' when eta < 35 then '25-34' when eta < 45 then '35-44'
			when eta < 55 then '45-54' when eta < 65 then '55-64' else '65+' end as fascia,
		case when eta is null then 99 else least(eta / 10, 8) end as ordine,
		count(*) as n
	from pers group by 1, 2
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
		case when primo is null then 'Non disponibile'
			when p_oggi - primo < 365 then 'Meno di 1 anno' when p_oggi - primo < 3 * 365 then '1-3 anni'
			when p_oggi - primo < 6 * 365 then '3-6 anni' else 'Oltre 6 anni' end as fascia,
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
	'fasce_eta', coalesce((select jsonb_agg(jsonb_build_object('fascia', fascia, 'n', n) order by ordine) from fasce_eta), '[]'::jsonb),
	'sesso', coalesce((select jsonb_agg(jsonb_build_object('sesso', sesso, 'n', n) order by n desc) from sesso), '[]'::jsonb),
	'zone', coalesce((select jsonb_agg(jsonb_build_object('zona', zona, 'n', n) order by (zona in ('Altre zone', 'Non indicata')), n desc) from zone_top), '[]'::jsonb),
	'anzianita', coalesce((select jsonb_agg(jsonb_build_object('fascia', fascia, 'n', n) order by fascia) from anzianita), '[]'::jsonb),
	'nuovi', coalesce((select jsonb_agg(jsonb_build_object('mese_da', mese_da, 'n', n, 'n_prec', n_prec) order by mese_da) from nuovi), '[]'::jsonb)
);
$$;

-- ───────────────────────────────────────────────────────────── Operatori
-- Il carico di lavoro della segreteria: vendite per venditore, operazioni di
-- cassa e azioni CRM per operatore.
create or replace function public.sez_operatori(p_oggi date, p_gruppi text[] default null)
returns jsonb
language sql stable
set search_path to 'public'
as $$
with
p as (
	select date_trunc('year', p_oggi)::date as anno_da,
		date_trunc('year', p_oggi - interval '1 year')::date as anno_da_prec,
		(p_oggi - interval '1 year')::date as oggi_prec
),
vend as (
	select coalesce(nullif(btrim(a.venditore_nome), ''), 'Non indicato') as operatore,
		(a.data_vendita at time zone 'Europe/Rome')::date as giorno, a.totale
	from public.abbonamenti a
	where a.cancellato_il is null and a.data_vendita >= timestamptz '2016-01-01' and a.data_vendita < (p_oggi + 1)::timestamptz
),
vend_op as (
	select operatore,
		count(*) filter (where giorno >= p.anno_da) as vendite,
		coalesce(sum(totale) filter (where giorno >= p.anno_da), 0) as fatturato,
		count(*) filter (where giorno between p.anno_da_prec and p.oggi_prec) as vendite_prec
	from vend cross join p group by operatore
	having count(*) filter (where giorno >= p.anno_da) > 0
),
top6 as (select operatore from vend_op order by vendite desc limit 6),
mesi as (
	select (date_trunc('month', p_oggi) - make_interval(months => n))::date as mese_da,
		least(((date_trunc('month', p_oggi) - make_interval(months => n)) + interval '1 month - 1 day')::date, p_oggi) as fine
	from generate_series(0, 11) n
),
mensile as (
	select m.mese_da, case when t.operatore is not null then v.operatore else 'Altri' end as operatore, count(*) as n
	from mesi m
	join vend v on v.giorno between m.mese_da and m.fine
	left join top6 t on t.operatore = v.operatore
	group by 1, 2
),
cassa as (
	select coalesce(nullif(btrim(t.operatore_nome), ''), 'Non indicato') as operatore, count(*) as operazioni,
		coalesce(sum(t.importo), 0) as importo
	from public.transazioni t cross join p
	where t.cancellato_il is null and t.data_operazione >= p.anno_da::timestamptz and t.data_operazione < (p_oggi + 1)::timestamptz
	group by 1
),
crm as (
	select coalesce(o.nome, 'Non indicato') as operatore, count(*) as azioni,
		count(*) filter (where z.data_evasione is not null) as evase
	from public.crm_azioni z cross join p
	left join public.operatori_info4u o on o.source_operatore_id = z.operatore_autore_id
	where z.data_appuntamento >= p.anno_da::timestamptz and z.data_appuntamento < (p_oggi + 1)::timestamptz
	group by 1
)
select jsonb_build_object(
	'oggi', p_oggi,
	'vendite', coalesce((select jsonb_agg(to_jsonb(x) order by x.vendite desc) from (select * from vend_op order by vendite desc limit 12) x), '[]'::jsonb),
	'ordine', coalesce((select jsonb_agg(operatore order by vendite desc) from (select operatore, vendite from vend_op order by vendite desc limit 6) y), '[]'::jsonb),
	'mensile', coalesce((select jsonb_agg(jsonb_build_object('mese_da', mese_da, 'gruppo', operatore, 'valore', n) order by mese_da, operatore) from mensile), '[]'::jsonb),
	'cassa', coalesce((select jsonb_agg(to_jsonb(x) order by x.operazioni desc) from (select * from cassa order by operazioni desc limit 12) x), '[]'::jsonb),
	'crm', coalesce((select jsonb_agg(to_jsonb(x) order by x.azioni desc) from (select * from crm order by azioni desc limit 12) x), '[]'::jsonb)
);
$$;

revoke execute on function public.sez_vendite(date, text[]), public.sez_accessi(date, text[]), public.sez_soci(date, text[]), public.sez_operatori(date, text[])
	from public, anon, authenticated;
grant execute on function public.sez_vendite(date, text[]), public.sez_accessi(date, text[]), public.sez_soci(date, text[]), public.sez_operatori(date, text[])
	to service_role;

-- Rinfresco in anticipo. Le sezioni leggere ogni mezz'ora; gli accessi, che
-- leggono milioni di righe, una volta l'ora e sfalsati.
select cron.schedule('cruscotto-30-minuti', '9,39 * * * *',
	$cron$ select public.cruscotto_aggiorna(array['abbonamenti', 'incassato', 'vendite', 'soci', 'operatori']) $cron$);
select cron.schedule('cruscotto-accessi', '24 * * * *', $cron$ select public.cruscotto_aggiorna(array['accessi']) $cron$);

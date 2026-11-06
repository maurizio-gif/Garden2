-- Vendite: gli sconti, calcolati correttamente.
--
-- Nei corsi il listino e' il prezzo dell'intero corso e il totale la quota della
-- singola lezione: la differenza (circa 860.000 euro l'anno solo per il nuoto
-- «planning») non e' uno sconto. Ora uno sconto e' uno sconto applicato
-- (sconto_id) su un prodotto che non e' un corso, e la quota di vendite
-- scontate si calcola sulle sole vendite non-corso.

create or replace function public.sez_vendite(p_oggi date, p_gruppi text[] default null)
returns jsonb
language sql stable
set search_path to 'public'
as $$
with
base as (
	select
		a.abbonamento, a.totale, a.importo_listino, a.sconto_id,
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
-- Sconto = sconto applicato (sconto_id) su un prodotto che non e' un corso: nei
-- corsi il listino e' il prezzo dell'intero corso e il totale la quota della
-- singola lezione, quindi la differenza non e' uno sconto.
scontato as (
	select *,
		(sconto_id is not null and coalesce(importo_listino, 0) > totale and gruppo <> 'Corsi') as e_scontata,
		case when sconto_id is not null and gruppo <> 'Corsi' then greatest(coalesce(importo_listino, 0) - totale, 0) else 0 end as sconto
	from v
),
kpi as (
	select
		count(*) filter (where giorno >= p.anno_da) as vendite_anno,
		count(*) filter (where giorno between p.anno_da_prec and p.oggi_prec) as vendite_anno_prec,
		coalesce(sum(totale) filter (where giorno >= p.anno_da), 0) as fatturato_anno,
		coalesce(sum(totale) filter (where giorno between p.anno_da_prec and p.oggi_prec), 0) as fatturato_anno_prec,
		count(*) filter (where giorno >= p.anno_da and gruppo <> 'Corsi') as vendite_sc_anno,
		count(*) filter (where giorno between p.anno_da_prec and p.oggi_prec and gruppo <> 'Corsi') as vendite_sc_anno_prec,
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

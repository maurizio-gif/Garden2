-- Cruscotto: sezioni Incassato e Vendite.

-- ───────────────────────────────────────────────────────────── Incassato
-- La cassa (transazioni che movimentano cassa) per metodo e per servizio,
-- confrontata con il venduto, e le rate non pagate.
create or replace function public.sez_incassato(p_oggi date, p_gruppi text[] default null)
returns jsonb
language sql stable
set search_path to 'public'
as $$
with
cassa as (
	select
		(t.data_operazione at time zone 'Europe/Rome')::date as giorno,
		t.importo,
		case
			when t.metodo_pagamento = 'Contanti' then 'Contanti'
			when t.metodo_pagamento in ('Bancomat', 'carta di credito', 'TSPay Carta di credito', 'SmallPay') then 'Carte e bancomat'
			when t.metodo_pagamento in ('RID', 'Bonifico', 'Banca', 'Incassato Gymgest') then 'RID e bonifici'
			when t.metodo_pagamento in ('Assegno', 'Assegni/bancari') then 'Assegni'
			else 'Altro'
		end as metodo,
		case t.tipo_servizio
			when 'A' then 'Abbonamenti' when 'O' then 'Corsi' when 'Z' then 'Campi e prenotazioni'
			when 'V' then 'Shop' when 'B' then 'Bar e borsellino' else 'Altro'
		end as servizio
	from public.transazioni t
	where t.cancellato_il is null and t.movimenta_cassa
		and t.data_operazione >= timestamptz '2016-01-01'
		and t.data_operazione < (p_oggi + 1)::timestamptz
),
venduto as (
	select (a.data_vendita at time zone 'Europe/Rome')::date as giorno, a.totale
	from public.abbonamenti a
	where a.cancellato_il is null and a.data_vendita >= timestamptz '2016-01-01' and a.data_vendita < (p_oggi + 1)::timestamptz
),
p as (
	select
		date_trunc('month', p_oggi)::date as mese_da,
		date_trunc('month', p_oggi - interval '1 year')::date as mese_da_prec,
		(p_oggi - interval '1 year')::date as oggi_prec,
		date_trunc('year', p_oggi)::date as anno_da,
		date_trunc('year', p_oggi - interval '1 year')::date as anno_da_prec
),
kpi_cassa as (
	select
		coalesce(sum(importo) filter (where giorno >= p.mese_da), 0) as incassato_mese,
		coalesce(sum(importo) filter (where giorno between p.mese_da_prec and p.oggi_prec), 0) as incassato_mese_prec,
		coalesce(sum(importo) filter (where giorno >= p.anno_da), 0) as incassato_anno,
		coalesce(sum(importo) filter (where giorno between p.anno_da_prec and p.oggi_prec), 0) as incassato_anno_prec,
		coalesce(sum(importo) filter (where giorno >= p.anno_da and servizio = 'Abbonamenti'), 0) as incassato_abb_anno,
		coalesce(sum(importo) filter (where giorno between p.anno_da_prec and p.oggi_prec and servizio = 'Abbonamenti'), 0) as incassato_abb_anno_prec
	from cassa cross join p
	group by p.mese_da, p.mese_da_prec, p.oggi_prec, p.anno_da, p.anno_da_prec
),
kpi_venduto as (
	select
		coalesce(sum(totale) filter (where giorno >= p.anno_da), 0) as venduto_anno,
		coalesce(sum(totale) filter (where giorno between p.anno_da_prec and p.oggi_prec), 0) as venduto_anno_prec
	from venduto cross join p
	group by p.anno_da, p.anno_da_prec, p.oggi_prec
),
mesi as (
	select (date_trunc('month', p_oggi) - make_interval(months => n))::date as mese_da,
		least(((date_trunc('month', p_oggi) - make_interval(months => n)) + interval '1 month - 1 day')::date, p_oggi) as fine
	from generate_series(0, 11) n
),
per_metodo as (
	select m.mese_da, c.metodo, sum(c.importo) as importo
	from mesi m join cassa c on c.giorno between m.mese_da and m.fine group by 1, 2
),
per_servizio as (
	select m.mese_da, c.servizio, sum(c.importo) as importo
	from mesi m join cassa c on c.giorno between m.mese_da and m.fine group by 1, 2
),
prec as (
	select m.mese_da, coalesce(sum(c.importo), 0) as importo
	from mesi m left join cassa c on c.giorno between (m.mese_da - interval '1 year')::date and (m.fine - interval '1 year')::date
	group by 1
),
giorni as (
	select c.giorno, c.metodo, sum(c.importo) as importo
	from cassa c where c.giorno > p_oggi - 30 group by 1, 2
),
rate as (
	select r.importo, r.data_rata, r.transazione_errore
	from public.abbonamenti_rate r
	where r.cancellato_il is null and r.data_pagato is null and r.importo > 0
		and r.data_rata >= date '2016-01-01' and r.data_rata < p_oggi + 31
),
rate_fasce as (
	select
		case when data_rata >= p_oggi then 'Prossimi 30 giorni'
			when p_oggi - data_rata <= 30 then 'Scadute da 1-30 giorni'
			when p_oggi - data_rata <= 90 then 'Scadute da 31-90 giorni'
			when p_oggi - data_rata <= 365 then 'Scadute da 91-365 giorni'
			else 'Scadute da oltre un anno' end as fascia,
		count(*) as n, coalesce(sum(importo), 0) as importo,
		count(*) filter (where transazione_errore is not null) as con_errore
	from rate group by 1
)
select jsonb_build_object(
	'oggi', p_oggi,
	'kpi', (select to_jsonb(kpi_cassa) from kpi_cassa) || (select to_jsonb(kpi_venduto) from kpi_venduto),
	'metodi', coalesce((select jsonb_agg(jsonb_build_object('mese_da', mese_da, 'gruppo', metodo, 'valore', importo) order by mese_da, metodo) from per_metodo), '[]'::jsonb),
	'servizi', coalesce((select jsonb_agg(jsonb_build_object('mese_da', mese_da, 'gruppo', servizio, 'valore', importo) order by mese_da, servizio) from per_servizio), '[]'::jsonb),
	'mensile_prec', coalesce((select jsonb_agg(jsonb_build_object('mese_da', mese_da, 'valore', importo) order by mese_da) from prec), '[]'::jsonb),
	'giornaliero', coalesce((select jsonb_agg(jsonb_build_object('mese_da', giorno, 'gruppo', metodo, 'valore', importo) order by giorno, metodo) from giorni), '[]'::jsonb),
	'rate', coalesce((select jsonb_agg(jsonb_build_object('fascia', fascia, 'n', n, 'importo', importo, 'con_errore', con_errore) order by fascia) from rate_fasce), '[]'::jsonb)
);
$$;

-- ───────────────────────────────────────────────────────────── Vendite
-- Prodotti, gruppi, sconti e disdette. Il fatturato e' il totale degli
-- abbonamenti venduti; uno sconto e' la differenza tra il listino e il totale.
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
disdette as (
	select
		count(*) filter (where data_disdetta >= p.mese_da and data_disdetta <= p_oggi) as disdette_mese,
		count(*) filter (where data_disdetta between p.mese_da_prec and p.oggi_prec) as disdette_mese_prec,
		count(*) filter (where data_disdetta >= p.anno_da and data_disdetta <= p_oggi) as disdette_anno,
		count(*) filter (where data_disdetta between p.anno_da_prec and p.oggi_prec) as disdette_anno_prec
	from base cross join p
	where p_gruppi is null or gruppo = any (p_gruppi)
),
mesi as (
	select (date_trunc('month', p_oggi) - make_interval(months => n))::date as mese_da,
		least(((date_trunc('month', p_oggi) - make_interval(months => n)) + interval '1 month - 1 day')::date, p_oggi) as fine
	from generate_series(0, 11) n
),
disdette_mensili as (
	select m.mese_da, count(b.*) as n
	from mesi m
	left join base b on b.data_disdetta between m.mese_da and m.fine and (p_gruppi is null or b.gruppo = any (p_gruppi))
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
	'kpi', (select to_jsonb(kpi) from kpi) || (select to_jsonb(disdette) from disdette),
	'prodotti', coalesce((select jsonb_agg(to_jsonb(x)) from prodotti x), '[]'::jsonb),
	'gruppi', coalesce((select jsonb_agg(to_jsonb(g) order by g.fatturato desc) from gruppi g), '[]'::jsonb),
	'disdette_mensili', coalesce((select jsonb_agg(jsonb_build_object('mese_da', mese_da, 'n', n) order by mese_da) from disdette_mensili), '[]'::jsonb)
);
$$;

revoke execute on function public.sez_incassato(date, text[]), public.sez_vendite(date, text[]) from public, anon, authenticated;
grant execute on function public.sez_incassato(date, text[]), public.sez_vendite(date, text[]) to service_role;

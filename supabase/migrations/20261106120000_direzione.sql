-- Garden, cruscotto «Direzione»: raggruppamento dei prodotti e numeri aggregati
-- della prima schermata (vendite e fatturato a pari giorni, soci attivi,
-- serie degli ultimi 12 mesi). Le funzioni restituiscono solo totali, mai
-- nomi o recapiti.

-- Categoria di Info4U -> gruppo mostrato nel cruscotto. Una categoria non
-- elencata finisce in «Altro». Si corregge qui, senza toccare il codice.
create table public.prodotti_gruppi (
	categoria text primary key,
	gruppo text not null,
	ordine integer not null
);
alter table public.prodotti_gruppi enable row level security;

insert into public.prodotti_gruppi (categoria, gruppo, ordine) values
	('GARDEN', 'Fitness e wellness', 1),
	('GARDEN+STEVEN', 'Fitness e wellness', 1),
	('GARDEN+STEVEN ONLINE', 'Fitness e wellness', 1),
	('GARDEN CLUB', 'Fitness e wellness', 1),
	('STEVEN', 'Fitness e wellness', 1),
	('STEVEN PASS', 'Fitness e wellness', 1),
	('EVOLNESS', 'Fitness e wellness', 1),
	('SUPER OPEN', 'Fitness e wellness', 1),
	('FAMILY FRIENDS 2 ADULTI', 'Fitness e wellness', 1),
	('LOW PRICE CARD', 'Fitness e wellness', 1),
	('ESCULAPIO', 'Fitness e wellness', 1),
	('NUTRIZIONE', 'Fitness e wellness', 1),
	('SOLARIUM', 'Fitness e wellness', 1),
	('PRE PARTO STEVEN', 'Fitness e wellness', 1),
	('INDOOR CYCLING', 'Fitness e wellness', 1),
	('FAMILY NUOTO', 'Nuoto', 2),
	('FAMILY NUOTO ONLINE', 'Nuoto', 2),
	('NUOTO ASSISTITO', 'Nuoto', 2),
	('CORSI NUOTO PLANNING', 'Nuoto', 2),
	('EXTRA NUOTO', 'Nuoto', 2),
	('AGONISTICA  NUOTO', 'Nuoto', 2),
	('MASTERS NUOTO', 'Nuoto', 2),
	('CORSI INTENSIVI NUOTO', 'Nuoto', 2),
	('CORSI ABBONAMENTO', 'Corsi', 3),
	('CORSI DANZA PLANNING', 'Corsi', 3),
	('CORSI SPORT CLUB PLANNING', 'Corsi', 3),
	('SPORT ADULTI', 'Corsi', 3),
	('JUNIOR CLUB A', 'Junior e camp', 4),
	('JUNIOR CLUB B', 'Junior e camp', 4),
	('JUNIOR CLUB', 'Junior e camp', 4),
	('KSCHOOL', 'Junior e camp', 4),
	('CAMP CALCIO', 'Junior e camp', 4),
	('GRUPPO SPORTIVO', 'Junior e camp', 4),
	('PERSONAL TRAINER', 'Personal training', 5),
	('PERSONAL GYM', 'Personal training', 5),
	('FAMILY PT EXPERIENCE', 'Personal training', 5),
	('LEZIONI INDIVIDUALI', 'Personal training', 5),
	('QUOTA ASSOCIATIVA', 'Quote e tessere', 6),
	('QUOTE EXTRA', 'Quote e tessere', 6);

-- Servono alla sovrapposizione «in corso alla data» dei soci attivi e al
-- confronto per data di vendita.
create index if not exists abbonamenti_validita_idx
	on public.abbonamenti (data_inizio, data_fine) where cancellato_il is null;
create index if not exists abbonamenti_data_vendita_idx
	on public.abbonamenti (data_vendita) where cancellato_il is null;

-- Gruppi disponibili, nell'ordine in cui compaiono nel cruscotto.
create or replace function public.direzione_gruppi()
returns text[]
language sql stable
set search_path to 'public'
as $$
	select array_agg(gruppo order by ordine, gruppo) from (
		select gruppo, min(ordine) as ordine from public.prodotti_gruppi group by gruppo
		union all select 'Altro', 99
	) x;
$$;

-- p_gruppi null = tutti i gruppi. I soci attivi, se non si sceglie un gruppo,
-- non contano «Quote e tessere»: altrimenti ogni socio con la quota risulterebbe
-- attivo.
create or replace function public.direzione_riepilogo(
	p_oggi date default (now() at time zone 'Europe/Rome')::date,
	p_gruppi text[] default null
)
returns jsonb
language sql stable
set search_path to 'public'
as $$
with
base as (
	select
		a.persona_id, a.totale, a.data_inizio, a.data_fine, a.abbonamento, a.data_vendita,
		(a.data_vendita at time zone 'Europe/Rome')::date as giorno,
		coalesce(g.gruppo, 'Altro') as gruppo
	from public.abbonamenti a
	left join public.prodotti_gruppi g on g.categoria = a.categoria
	where a.cancellato_il is null
		and a.data_vendita >= timestamptz '2016-01-01'
		and a.data_vendita < (p_oggi + 1)::timestamptz
),
-- le vendite scelte e il loro periodo
v as (
	select * from base where p_gruppi is null or gruppo = any (p_gruppi)
),
p as (
	select
		date_trunc('month', p_oggi)::date as mese_da,
		date_trunc('month', p_oggi - interval '1 year')::date as mese_da_prec,
		(p_oggi - interval '1 year')::date as oggi_prec,
		date_trunc('year', p_oggi)::date as anno_da,
		date_trunc('year', p_oggi - interval '1 year')::date as anno_da_prec
),
kpi as (
	select
		count(*) filter (where v.giorno >= p.mese_da) as vendite_mese,
		coalesce(sum(v.totale) filter (where v.giorno >= p.mese_da), 0) as fatturato_mese,
		count(*) filter (where v.giorno between p.mese_da_prec and p.oggi_prec) as vendite_mese_prec,
		coalesce(sum(v.totale) filter (where v.giorno between p.mese_da_prec and p.oggi_prec), 0) as fatturato_mese_prec,
		count(*) filter (where v.giorno >= p.anno_da) as vendite_anno,
		coalesce(sum(v.totale) filter (where v.giorno >= p.anno_da), 0) as fatturato_anno,
		count(*) filter (where v.giorno between p.anno_da_prec and p.oggi_prec) as vendite_anno_prec,
		coalesce(sum(v.totale) filter (where v.giorno between p.anno_da_prec and p.oggi_prec), 0) as fatturato_anno_prec
	from v cross join p
	group by p.mese_da, p.mese_da_prec, p.oggi_prec, p.anno_da, p.anno_da_prec
),
-- gli abbonamenti che servono ai soci attivi: anche quelli venduti prima del
-- 2016 e ancora in corso (la sincronizzazione li carica per questo)
att as (
	select a.persona_id, a.data_inizio, a.data_fine, coalesce(g.gruppo, 'Altro') as gruppo
	from public.abbonamenti a
	left join public.prodotti_gruppi g on g.categoria = a.categoria
	where a.cancellato_il is null and a.persona_id is not null
		and a.data_inizio is not null and a.data_fine is not null
),
att_scelti as (
	select * from att
	where case when p_gruppi is null then gruppo <> 'Quote e tessere' else gruppo = any (p_gruppi) end
),
giorni as (
	select 'oggi' as chiave, p_oggi as giorno
	union all select 'mese_fa', (p_oggi - interval '1 month')::date
	union all select 'anno_fa', (p_oggi - interval '1 year')::date
),
soci as (
	select gi.chiave, count(distinct s.persona_id) as soci
	from giorni gi
	left join att_scelti s on s.data_inizio <= gi.giorno and s.data_fine >= gi.giorno
	group by gi.chiave
),
mesi as (
	select
		(date_trunc('month', p_oggi) - make_interval(months => n))::date as mese_da,
		least(
			((date_trunc('month', p_oggi) - make_interval(months => n)) + interval '1 month - 1 day')::date,
			p_oggi
		) as fine
	from generate_series(0, 11) n
),
fatt_mensile as (
	select m.mese_da, v.gruppo, sum(v.totale) as fatturato
	from mesi m join v on v.giorno between m.mese_da and m.fine
	group by m.mese_da, v.gruppo
),
soci_mensili as (
	select m.mese_da, s.gruppo, count(distinct s.persona_id) as soci
	from mesi m
	join att s on s.data_inizio <= m.fine and s.data_fine >= m.fine
		and (p_gruppi is null and s.gruppo <> 'Quote e tessere' or s.gruppo = any (p_gruppi))
	group by m.mese_da, s.gruppo
),
ultime as (
	select data_vendita, abbonamento, totale, gruppo
	from v order by data_vendita desc limit 4
)
select jsonb_build_object(
	'oggi', p_oggi,
	'kpi', (select to_jsonb(kpi) from kpi),
	'soci', (select jsonb_object_agg(chiave, soci) from soci),
	'fatturato_mensile', coalesce((select jsonb_agg(to_jsonb(f) order by f.mese_da, f.gruppo) from fatt_mensile f), '[]'::jsonb),
	'soci_mensili', coalesce((select jsonb_agg(to_jsonb(s) order by s.mese_da, s.gruppo) from soci_mensili s), '[]'::jsonb),
	'ultime_vendite', coalesce((select jsonb_agg(to_jsonb(u) order by u.data_vendita desc) from ultime u), '[]'::jsonb)
);
$$;

revoke execute on function public.direzione_gruppi() from public, anon, authenticated;
revoke execute on function public.direzione_riepilogo(date, text[]) from public, anon, authenticated;
grant execute on function public.direzione_gruppi() to service_role;
grant execute on function public.direzione_riepilogo(date, text[]) to service_role;

-- Cruscotto Direzione piu' veloce: i numeri si calcolano in anticipo.
--
-- direzione_riepilogo costa circa 1,6 secondi: troppo per ogni apertura della
-- pagina. Come nel cruscotto di Athlon, il risultato si tiene in una tabella e
-- si rinfresca ogni dieci minuti; la pagina legge una riga. Chi apre dopo un
-- cambio di giorno, o con una combinazione di gruppi mai calcolata, ricalcola
-- da se' una volta sola e lascia il risultato per gli altri.

-- Aggiunge al riepilogo le vendite per mese e i totali degli stessi mesi
-- dell'anno prima, per i grafici.
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
	select m.mese_da, v.gruppo, sum(v.totale) as fatturato, count(*) as vendite
	from mesi m join v on v.giorno between m.mese_da and m.fine
	group by m.mese_da, v.gruppo
),
-- gli stessi mesi un anno prima (il mese in corso, solo fino allo stesso giorno)
mensile_prec as (
	select m.mese_da, coalesce(sum(v.totale), 0) as fatturato, count(v.giorno) as vendite
	from mesi m
	left join v on v.giorno between (m.mese_da - interval '1 year')::date and (m.fine - interval '1 year')::date
	group by m.mese_da
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
	'mensile_prec', coalesce((select jsonb_agg(to_jsonb(x) order by x.mese_da) from mensile_prec x), '[]'::jsonb),
	'soci_mensili', coalesce((select jsonb_agg(to_jsonb(s) order by s.mese_da, s.gruppo) from soci_mensili s), '[]'::jsonb),
	'ultime_vendite', coalesce((select jsonb_agg(to_jsonb(u) order by u.data_vendita desc) from ultime u), '[]'::jsonb)
);
$$;


revoke execute on function public.direzione_riepilogo(date, text[]) from public, anon, authenticated;
grant execute on function public.direzione_riepilogo(date, text[]) to service_role;

create table public.direzione_cache (
	chiave text primary key,
	dati jsonb not null,
	calcolato_il timestamptz not null default now()
);
alter table public.direzione_cache enable row level security;

create or replace function public.direzione_oggi() returns date
language sql stable
as $$ select (now() at time zone 'Europe/Rome')::date $$;

-- «tutti» oppure i gruppi in ordine alfabetico, separati da |.
create or replace function public.direzione_chiave(p_gruppi text[]) returns text
language sql immutable
as $$
	select case when p_gruppi is null then 'tutti'
		else (select string_agg(g, '|' order by g) from unnest(p_gruppi) g) end
$$;

-- Ricalcola e salva una combinazione di gruppi.
create or replace function public.direzione_calcola(p_gruppi text[] default null)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
	d jsonb;
begin
	d := public.direzione_riepilogo(public.direzione_oggi(), p_gruppi);
	insert into public.direzione_cache (chiave, dati, calcolato_il)
	values (public.direzione_chiave(p_gruppi), d, now())
	on conflict (chiave) do update set dati = excluded.dati, calcolato_il = excluded.calcolato_il;
	return d;
end;
$$;

-- Quello che legge la pagina: la cache se e' di oggi e recente, altrimenti la ricalcola.
create or replace function public.direzione_leggi(p_gruppi text[] default null)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
	r public.direzione_cache;
	d jsonb;
	calcolato timestamptz;
begin
	select * into r from public.direzione_cache where chiave = public.direzione_chiave(p_gruppi);
	if found and r.calcolato_il > now() - interval '15 minutes' and (r.dati->>'oggi')::date = public.direzione_oggi() then
		d := r.dati;
		calcolato := r.calcolato_il;
	else
		d := public.direzione_calcola(p_gruppi);
		calcolato := now();
	end if;
	return d || jsonb_build_object(
		'calcolato_il', calcolato,
		'sincronizzato_il', (select max(aggiornato_il) from public.sync_info4u_stato)
	);
end;
$$;

-- Rinfresca «tutti» e ogni gruppo da solo: sono le viste che la pagina apre di piu'.
create or replace function public.direzione_aggiorna_cache() returns void
language plpgsql
set search_path to 'public'
as $$
declare
	g text;
begin
	perform public.direzione_calcola(null);
	foreach g in array public.direzione_gruppi() loop
		perform public.direzione_calcola(array[g]);
	end loop;
end;
$$;

revoke execute on function public.direzione_leggi(text[]), public.direzione_calcola(text[]), public.direzione_aggiorna_cache()
	from public, anon, authenticated;
grant execute on function public.direzione_leggi(text[]), public.direzione_calcola(text[]), public.direzione_aggiorna_cache() to service_role;

-- Ogni dieci minuti, sfalsato dal minuto tondo dove partono gia' altre cose.
create extension if not exists pg_cron;
select cron.schedule('direzione-10-minuti', '4,14,24,34,44,54 * * * *', $cron$ select public.direzione_aggiorna_cache() $cron$);

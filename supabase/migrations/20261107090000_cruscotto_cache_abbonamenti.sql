-- Cruscotto, altre sezioni: cache comune e sezione Abbonamenti.
--
-- Stessa idea della Direzione: ogni sezione e' una funzione sez_<nome>(oggi,
-- gruppi) che calcola un json, e cruscotto_leggi() lo tiene in cruscotto_cache
-- e lo rinfresca da solo quando e' vecchio o cambia il giorno. Un cron lo
-- ricalcola in anticipo (vedi la migrazione che chiude le sezioni).

create table if not exists public.cruscotto_cache (
	sezione text not null,
	chiave text not null,
	dati jsonb not null,
	calcolato_il timestamptz not null default now(),
	primary key (sezione, chiave)
);
alter table public.cruscotto_cache enable row level security;

-- Le sezioni che hanno il filtro per gruppo di prodotto; le altre lo ignorano.
create or replace function public.cruscotto_con_gruppi(p_sezione text) returns boolean
language sql immutable
as $$ select p_sezione in ('abbonamenti', 'vendite') $$;

create or replace function public.cruscotto_calcola(p_sezione text, p_gruppi text[] default null)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
	g text[] := case when public.cruscotto_con_gruppi(p_sezione) then p_gruppi else null end;
	d jsonb;
begin
	if p_sezione not in ('abbonamenti', 'incassato', 'vendite', 'accessi', 'soci', 'operatori') then
		raise exception 'Sezione sconosciuta: %', p_sezione;
	end if;
	execute format('select public.%I($1, $2)', 'sez_' || p_sezione) into d using public.direzione_oggi(), g;
	insert into public.cruscotto_cache (sezione, chiave, dati, calcolato_il)
	values (p_sezione, public.direzione_chiave(g), d, now())
	on conflict (sezione, chiave) do update set dati = excluded.dati, calcolato_il = excluded.calcolato_il;
	return d;
end;
$$;

create or replace function public.cruscotto_leggi(p_sezione text, p_gruppi text[] default null, p_max_minuti integer default 20)
returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
	g text[] := case when public.cruscotto_con_gruppi(p_sezione) then p_gruppi else null end;
	r public.cruscotto_cache;
	d jsonb;
	calcolato timestamptz;
begin
	select * into r from public.cruscotto_cache where sezione = p_sezione and chiave = public.direzione_chiave(g);
	if found and r.calcolato_il > now() - make_interval(mins => p_max_minuti) and (r.dati->>'oggi')::date = public.direzione_oggi() then
		d := r.dati;
		calcolato := r.calcolato_il;
	else
		d := public.cruscotto_calcola(p_sezione, g);
		calcolato := now();
	end if;
	return d || jsonb_build_object('calcolato_il', calcolato, 'sincronizzato_il', (select max(aggiornato_il) from public.sync_info4u_stato));
end;
$$;

create or replace function public.cruscotto_aggiorna(p_sezioni text[]) returns void
language plpgsql
set search_path to 'public'
as $$
declare
	s text;
	g text;
begin
	foreach s in array p_sezioni loop
		perform public.cruscotto_calcola(s, null);
		if public.cruscotto_con_gruppi(s) then
			foreach g in array public.direzione_gruppi() loop
				perform public.cruscotto_calcola(s, array[g]);
			end loop;
		end if;
	end loop;
end;
$$;

-- ───────────────────────────────────────────────────────────── Abbonamenti
-- Nuovi, rinnovi e ritorni; scadenze dei prossimi 30 giorni; tasso di rinnovo.
-- «Rinnovo»: la persona aveva un abbonamento dello stesso gruppo che finiva al
-- massimo 30 giorni prima dell'inizio del nuovo. «Ritorno»: ne aveva uno, ma
-- finito da piu' di 30 giorni. «Nuovo»: nessuno prima. Le quote associative non
-- contano (si rinnovano per tutti ogni anno).
create or replace function public.sez_abbonamenti(p_oggi date, p_gruppi text[] default null)
returns jsonb
language sql stable
set search_path to 'public'
as $$
with
ab as (
	select
		a.persona_id, a.data_inizio, a.data_fine,
		(a.data_vendita at time zone 'Europe/Rome')::date as giorno,
		coalesce(g.gruppo, 'Altro') as gruppo,
		max(a.data_fine) over w_prima as prev_fine,
		min(a.data_inizio) over w_dopo as next_inizio
	from public.abbonamenti a
	left join public.prodotti_gruppi g on g.categoria = a.categoria
	where a.cancellato_il is null and a.persona_id is not null
		and a.data_inizio is not null and a.data_fine is not null and a.data_fine >= a.data_inizio
		and a.data_vendita < (p_oggi + 1)::timestamptz
		and coalesce(g.gruppo, 'Altro') <> 'Quote e tessere'
	window
		w_prima as (partition by a.persona_id, coalesce(g.gruppo, 'Altro') order by a.data_inizio, a.data_vendita rows between unbounded preceding and 1 preceding),
		w_dopo as (partition by a.persona_id, coalesce(g.gruppo, 'Altro') order by a.data_inizio, a.data_vendita rows between 1 following and unbounded following)
),
v as (
	select *,
		case when prev_fine is null then 'Nuovi' when data_inizio <= prev_fine + 30 then 'Rinnovi' else 'Ritorni' end as tipo
	from ab
	where p_gruppi is null or gruppo = any (p_gruppi)
),
p as (
	select
		date_trunc('month', p_oggi)::date as mese_da,
		date_trunc('month', p_oggi - interval '1 year')::date as mese_da_prec,
		(p_oggi - interval '1 year')::date as oggi_prec
),
kpi as (
	select
		count(*) filter (where tipo = 'Nuovi' and giorno >= p.mese_da) as nuovi_mese,
		count(*) filter (where tipo = 'Nuovi' and giorno between p.mese_da_prec and p.oggi_prec) as nuovi_mese_prec,
		count(*) filter (where tipo = 'Rinnovi' and giorno >= p.mese_da) as rinnovi_mese,
		count(*) filter (where tipo = 'Rinnovi' and giorno between p.mese_da_prec and p.oggi_prec) as rinnovi_mese_prec,
		count(*) filter (where tipo = 'Ritorni' and giorno >= p.mese_da) as ritorni_mese,
		count(*) filter (where tipo = 'Ritorni' and giorno between p.mese_da_prec and p.oggi_prec) as ritorni_mese_prec
	from v cross join p
	group by p.mese_da, p.mese_da_prec, p.oggi_prec
),
mesi as (
	select (date_trunc('month', p_oggi) - make_interval(months => n))::date as mese_da,
		least(((date_trunc('month', p_oggi) - make_interval(months => n)) + interval '1 month - 1 day')::date, p_oggi) as fine
	from generate_series(0, 11) n
),
mensile as (
	select m.mese_da, v.tipo, count(*) as n
	from mesi m join v on v.giorno between m.mese_da and m.fine
	group by m.mese_da, v.tipo
),
-- scadenze dei prossimi 30 giorni, divise per settimana e per gruppo
scad as (
	select v.*, (v.data_fine - p_oggi) / 7 as settimana
	from v where v.data_fine between p_oggi and p_oggi + 30
),
scad_tot as (
	select count(*) as totale, count(*) filter (where next_inizio is not null) as gia_rinnovati from scad
),
scad_sett as (
	select settimana, count(*) as totale, count(*) filter (where next_inizio is not null) as rinnovati
	from scad group by settimana
),
scad_gruppo as (
	select gruppo, count(*) as totale, count(*) filter (where next_inizio is not null) as rinnovati
	from scad group by gruppo
),
-- scaduti negli ultimi 30 giorni e non ancora tornati
recuperare as (
	select gruppo, count(*) as n
	from v where data_fine between p_oggi - 30 and p_oggi - 1 and next_inizio is null
	group by gruppo
),
-- tasso di rinnovo per mese di scadenza: rinnovato = nuovo abbonamento entro 30 giorni dalla fine
tasso as (
	select
		(date_trunc('month', p_oggi) - make_interval(months => n))::date as mese_da,
		count(v.data_fine) as scadenze,
		count(v.data_fine) filter (where v.next_inizio is not null and v.next_inizio <= v.data_fine + 30) as rinnovati
	from generate_series(1, 14) n
	left join v on v.data_fine >= (date_trunc('month', p_oggi) - make_interval(months => n))::date
		and v.data_fine < (date_trunc('month', p_oggi) - make_interval(months => n - 1))::date
	group by 1
)
select jsonb_build_object(
	'oggi', p_oggi,
	'kpi', (select to_jsonb(kpi) from kpi),
	'mensile', coalesce((select jsonb_agg(jsonb_build_object('mese_da', mese_da, 'tipo', tipo, 'n', n) order by mese_da, tipo) from mensile), '[]'::jsonb),
	'scadenze', jsonb_build_object(
		'totale', (select totale from scad_tot),
		'gia_rinnovati', (select gia_rinnovati from scad_tot),
		'settimane', coalesce((select jsonb_agg(jsonb_build_object('settimana', settimana, 'totale', totale, 'rinnovati', rinnovati) order by settimana) from scad_sett), '[]'::jsonb),
		'gruppi', coalesce((select jsonb_agg(jsonb_build_object('gruppo', gruppo, 'totale', totale, 'rinnovati', rinnovati) order by totale desc) from scad_gruppo), '[]'::jsonb),
		'da_recuperare', coalesce((select jsonb_agg(jsonb_build_object('gruppo', gruppo, 'n', n) order by n desc) from recuperare), '[]'::jsonb)
	),
	'tasso', coalesce((select jsonb_agg(jsonb_build_object('mese_da', mese_da, 'scadenze', scadenze, 'rinnovati', rinnovati) order by mese_da) from tasso), '[]'::jsonb)
);
$$;

revoke execute on function
	public.cruscotto_calcola(text, text[]), public.cruscotto_leggi(text, text[], integer), public.cruscotto_aggiorna(text[]),
	public.sez_abbonamenti(date, text[])
	from public, anon, authenticated;
grant execute on function
	public.cruscotto_calcola(text, text[]), public.cruscotto_leggi(text, text[], integer), public.cruscotto_aggiorna(text[]),
	public.sez_abbonamenti(date, text[])
	to service_role;

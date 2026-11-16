-- Riassunti giornalieri degli accessi, per la dashboard Accessi.
--
-- I passaggi grezzi sono ~3,7 milioni: rifare ogni volta conversioni di fuso,
-- raggruppamenti e conteggi distinti costava 9 secondi per un anno e 18 per
-- il confronto mese per mese. Qui si tengono:
--   · accessi_giorno: una riga per persona e giorno con almeno un ingresso
--     valido (definizione in 20261116190000_dashboard_accessi.sql): ora del
--     primo ingresso, quanti passaggi, la vendita che ha aperto il primo;
--   · accessi_giorno_varchi: per giorno, varco ed esito (anche i rifiutati),
--     quanti passaggi.
-- aggiorna_accessi_giorno() ricalcola solo i giorni toccati dai passaggi
-- arrivati dopo l'ultima volta (cursore su source_accesso_id in
-- sync_info4u_stato, chiave «accessi_giorno»); la prima volta li costruisce a
-- tappe di 6 mesi dal 2016, una tappa per chiamata (tutto insieme supera il
-- tempo massimo delle query).
-- pg_cron la chiama ogni 5 minuti, come il sync.

create table if not exists public.accessi_giorno (
	giorno date not null,
	source_utente_id integer not null,
	settimana date not null,
	arrivo timestamp not null,
	ingressi integer not null,
	source_iscrizione_id integer,
	primary key (giorno, source_utente_id)
);
create index if not exists accessi_giorno_utente_idx on public.accessi_giorno (source_utente_id, giorno);
comment on table public.accessi_giorno is
	'Presenze: una riga per persona e giorno con almeno un ingresso valido ai tornelli. Riempita da aggiorna_accessi_giorno().';

create table if not exists public.accessi_giorno_varchi (
	giorno date not null,
	source_terminale_id integer not null,
	indirizzo integer not null,
	source_concentratore_id integer not null,
	tipo_accesso integer not null,
	n integer not null,
	primary key (giorno, source_terminale_id, indirizzo, source_concentratore_id, tipo_accesso)
);
comment on table public.accessi_giorno_varchi is
	'Passaggi per giorno, varco ed esito (tipo_accesso), validi e rifiutati. Riempita da aggiorna_accessi_giorno().';

alter table public.accessi_giorno enable row level security;
alter table public.accessi_giorno_varchi enable row level security;
revoke all on public.accessi_giorno, public.accessi_giorno_varchi from public, anon, authenticated;
grant select on public.accessi_giorno, public.accessi_giorno_varchi to service_role;

create or replace function public.aggiorna_accessi_giorno()
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
	v_ultimo bigint;
	v_massimo bigint;
	v_giorni date[];
	v_da date;
	v_a date;
	v_oggi date := (now() at time zone 'Europe/Rome')::date;
	v_costruzione boolean;
begin
	select cursore into v_ultimo from public.sync_info4u_stato where chiave = 'accessi_giorno';
	select max(source_accesso_id) into v_massimo from public.accessi;
	if v_massimo is null or (v_ultimo is not null and v_massimo <= v_ultimo) then
		return 0;
	end if;

	v_costruzione := v_ultimo is null;
	if v_costruzione then
		-- Prima costruzione a tappe di 6 mesi (tutto insieme supera il tempo massimo
		-- delle query): si riparte dal giorno dopo l'ultimo gia' fatto.
		select coalesce((select (valore at time zone 'Europe/Rome')::date from public.sync_info4u_stato
			where chiave = 'accessi_giorno_costruzione'), date '2016-01-01') into v_da;
		v_a := least(v_da + 183, v_oggi + 1);
	else
		select array_agg(distinct (data_accesso at time zone 'Europe/Rome')::date)
		into v_giorni
		from public.accessi
		where source_accesso_id > v_ultimo;
		v_da := (select min(g) from unnest(v_giorni) g);
		v_a := (select max(g) from unnest(v_giorni) g) + 1;
	end if;

	delete from public.accessi_giorno
	where giorno >= v_da and giorno < v_a and (v_costruzione or giorno = any (v_giorni));
	delete from public.accessi_giorno_varchi
	where giorno >= v_da and giorno < v_a and (v_costruzione or giorno = any (v_giorni));

	insert into public.accessi_giorno (giorno, source_utente_id, settimana, arrivo, ingressi, source_iscrizione_id)
	select giorno, u, date_trunc('week', giorno)::date, min(ts), count(*),
		(array_agg(source_iscrizione_id order by ts) filter (where source_iscrizione_id is not null))[1]
	from (
		select (x.data_accesso at time zone 'Europe/Rome') as ts,
			(x.data_accesso at time zone 'Europe/Rome')::date as giorno,
			x.source_utente_id as u, x.source_iscrizione_id
		from public.accessi x
		where x.data_accesso >= (v_da::timestamp at time zone 'Europe/Rome')
			and x.data_accesso < (v_a::timestamp at time zone 'Europe/Rome')
			and x.data_accesso <= now()
			and x.tipo_accesso > 0 and x.tipo_accesso < 2000 and x.tipo_accesso not in (1, 22, 100, 999)
			and x.source_utente_id is not null
	) v
	where v_costruzione or giorno = any (v_giorni)
	group by giorno, u;

	insert into public.accessi_giorno_varchi (giorno, source_terminale_id, indirizzo, source_concentratore_id, tipo_accesso, n)
	select giorno, t, i, c, tipo, count(*)
	from (
		select (x.data_accesso at time zone 'Europe/Rome')::date as giorno, coalesce(x.source_terminale_id, 0) as t,
			coalesce(x.indirizzo, 0) as i, coalesce(x.source_concentratore_id, 0) as c, x.tipo_accesso as tipo
		from public.accessi x
		where x.data_accesso >= (v_da::timestamp at time zone 'Europe/Rome')
			and x.data_accesso < (v_a::timestamp at time zone 'Europe/Rome')
			and x.data_accesso <= now()
			and x.tipo_accesso is not null
	) v
	where v_costruzione or giorno = any (v_giorni)
	group by 1, 2, 3, 4, 5;

	if v_costruzione then
		insert into public.sync_info4u_stato (chiave, valore, aggiornato_il)
		values ('accessi_giorno_costruzione', (v_a::timestamp at time zone 'Europe/Rome'), now())
		on conflict (chiave) do update set valore = excluded.valore, aggiornato_il = excluded.aggiornato_il;
	end if;

	-- Il cursore si scrive solo a costruzione finita (o a ogni aggiornamento normale).
	if not v_costruzione or v_a > v_oggi then
		insert into public.sync_info4u_stato (chiave, valore, cursore, aggiornato_il)
		values ('accessi_giorno', now(), v_massimo, now())
		on conflict (chiave) do update set valore = excluded.valore, cursore = excluded.cursore, aggiornato_il = excluded.aggiornato_il;
	end if;

	return v_a - v_da;
end;
$$;

comment on function public.aggiorna_accessi_giorno() is
	'Ricalcola accessi_giorno e accessi_giorno_varchi per i giorni con passaggi nuovi; la prima volta li costruisce a tappe di 6 mesi. Restituisce l''ampiezza in giorni dell''intervallo trattato.';

revoke execute on function public.aggiorna_accessi_giorno() from public, anon, authenticated;

-- ogni 5 minuti
select cron.schedule('aggiorna-accessi-giorno', '*/5 * * * *', 'select public.aggiorna_accessi_giorno()');

-- ───────────────────────────────────── dashboard sui riassunti

create or replace function public.dashboard_accessi(p_da date, p_a date)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with f as (
		select least(p_da, p_a) as da,
			least(greatest(p_da, p_a), (now() at time zone 'Europe/Rome')::date) as a
	),
	pres as (
		select g.* from public.accessi_giorno g, f where g.giorno between f.da and f.a
	),
	sett_persona as (
		select source_utente_id as u, count(*) as presenze, count(distinct settimana) as settimane, sum(ingressi) as ingressi
		from pres group by 1
	),
	calendario as (
		select extract(isodow from g)::int as dow, count(*) as giorni
		from f, generate_series(f.da, f.a, interval '1 day') g
		group by 1
	),
	per_dow as (
		select extract(isodow from giorno)::int as dow, count(*) as presenze from pres group by 1
	),
	per_ora as (
		select extract(isodow from giorno)::int as dow, extract(hour from arrivo)::int as ora, count(*) as presenze
		from pres group by 1, 2
	),
	per_giorno as (
		select giorno, count(*) as presenze from pres group by 1
	),
	pv as (
		select v.* from public.accessi_giorno_varchi v, f where v.giorno between f.da and f.a
	),
	varchi as (
		select coalesce(t.descrizione, 'Varco ' || pv.source_terminale_id || '/' || pv.indirizzo) as varco,
			coalesce(sum(pv.n) filter (where pv.tipo_accesso > 0 and pv.tipo_accesso < 2000 and pv.tipo_accesso not in (1, 22, 100, 999)), 0) as ingressi,
			coalesce(sum(pv.n) filter (where pv.tipo_accesso < 0), 0) as rifiutati
		from pv
		left join public.terminali_info4u t
			on t.source_terminale_id = pv.source_terminale_id
			and t.indirizzo = pv.indirizzo
			and t.source_concentratore_id = pv.source_concentratore_id
		group by 1
	),
	rifiuti as (
		select coalesce(e.descrizione, 'Esito ' || pv.tipo_accesso) as motivo, sum(pv.n) as n
		from pv
		left join public.esiti_accesso e on e.numero_esito = pv.tipo_accesso
		where pv.tipo_accesso < 0
		group by 1
	),
	pres_abb as (
		select p.source_utente_id as u, p.settimana,
			coalesce(a.abbonamento, 'Senza abbonamento collegato') as abbonamento,
			coalesce(g.gruppo, case when a.id is null then 'Senza abbonamento' else 'Altro' end) as gruppo
		from pres p
		left join public.abbonamenti a on a.source_iscrizione_id = p.source_iscrizione_id
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
		select * from sett_persona order by presenze desc, ingressi desc, u limit 30
	)
	select jsonb_build_object(
		'da', (select da from f),
		'a', (select a from f),
		'ultimo_accesso', (select max(data_accesso) from public.accessi where data_accesso <= now()),
		'aggiornato_al', (select valore from public.sync_info4u_stato where chiave = 'accessi_giorno'),
		'totali', jsonb_build_object(
			'ingressi', (select coalesce(sum(ingressi), 0) from sett_persona),
			'presenze', (select coalesce(sum(presenze), 0) from sett_persona),
			'persone', (select count(*) from sett_persona),
			'settimane_persona', (select coalesce(sum(settimane), 0) from sett_persona),
			'rifiutati', (select coalesce(sum(n), 0) from rifiuti),
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
			select jsonb_agg(jsonb_build_object('varco', varco, 'ingressi', ingressi, 'rifiutati', rifiutati) order by ingressi desc)
			from varchi where ingressi > 0 or rifiutati > 0
		), '[]'::jsonb),
		'rifiuti', coalesce((
			select jsonb_agg(jsonb_build_object('motivo', motivo, 'n', n) order by n desc)
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
			) order by t.presenze desc, t.ingressi desc, t.u)
			from top_utenti t
			left join public.persone p on p.source_utente_id = t.u
		), '[]'::jsonb)
	);
$$;

create or replace function public.dashboard_accessi_mensile()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with f as (
		select make_date(extract(year from (now() at time zone 'Europe/Rome'))::int - 3, 1, 1) as da
	),
	mesi as (
		select date_trunc('month', g.giorno)::date as mese,
			count(*) as presenze,
			sum(g.ingressi) as ingressi,
			count(distinct g.source_utente_id) as persone,
			count(distinct (g.source_utente_id, g.settimana)) as settimane_persona
		from public.accessi_giorno g, f
		where g.giorno >= f.da
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

revoke execute on function public.dashboard_accessi(date, date) from public, anon, authenticated;
revoke execute on function public.dashboard_accessi_mensile() from public, anon, authenticated;
grant execute on function public.dashboard_accessi(date, date) to service_role;
grant execute on function public.dashboard_accessi_mensile() to service_role;

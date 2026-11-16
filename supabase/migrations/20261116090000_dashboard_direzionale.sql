-- Dashboard direzionale, scadenze e rinnovi, valorizzazione e ricerca sugli
-- incassi per il pannello di Garden (cartella web/). Le regole su rinnovi e
-- scadenze sono quelle del pannello di Ronchi Verdi, così i due numeri si
-- possono confrontare.
--
-- Come le altre funzioni del pannello, le chiama solo il server Next.js con la
-- service_role (niente execute a public/anon/authenticated).
--
-- Definizioni (cambiarle qui, il pannello non le conosce):
--   · «prodotti» = abbonamenti non cancellati, esclusi QUOTA ASSOCIATIVA e
--     QUOTE EXTRA; il gruppo viene da prodotti_gruppi (senza gruppo: «Altro»);
--   · «iscritti» a un giorno = persone diverse con un prodotto venduto entro
--     quel giorno, iniziato e non ancora finito (fine del mese, oppure oggi
--     per il mese in corso). Date impossibili scartate;
--   · «rinnovo» (sulle vendite) = la stessa persona aveva un altro prodotto
--     dello stesso gruppo finito tra 30 giorni prima dell'inizio e l'inizio di
--     questo; il resto è «nuovo»;
--   · «scadenza» = ogni prodotto con data_fine (una riga per vendita, come in
--     Ronchi Verdi); è «rinnovato» se la stessa persona ha un prodotto dello
--     stesso gruppo che parte tra la fine e 30 giorni dopo. Tasso di rinnovo =
--     rinnovati ÷ scadenze del mese;
--   · «valore in scadenza» = somma di totale dei prodotti che scadono;
--   · «valorizzazione» dei prodotti attivi oggi: valore = somma di totale;
--     residuo = la parte non ancora goduta, in proporzione ai giorni che
--     mancano alla fine (rateo); mensile = valore ÷ durata in mesi;
--   · «incassato» = transazioni non cancellate che movimentano cassa, al netto
--     degli storni, per data_operazione (come nella pagina Finanza);
--   · i giorni sono quelli di Europe/Rome.

-- ─────────────────────────────────────────────── direzionale (panoramica)

create or replace function public.dashboard_direzionale()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with oggi as (
		select (now() at time zone 'Europe/Rome')::date as d
	),
	mesi as (
		select (date_trunc('month', oggi.d) - make_interval(months => k))::date as m,
			least((date_trunc('month', oggi.d) - make_interval(months => k) + interval '1 month - 1 day')::date, oggi.d) as g
		from oggi, generate_series(0, 35) k
	),
	da as (select min(m) as d from mesi),
	-- ───── incassato per mese
	incassi as (
		select date_trunc('month', t.data_operazione at time zone 'Europe/Rome')::date as m,
			round(sum(t.importo)) as incassato,
			round(coalesce(sum(t.importo) filter (where t.tipo_servizio = 'A'), 0)) as incassato_abbonamenti
		from public.transazioni t
		where t.cancellato_il is null
			and t.movimenta_cassa
			and t.importo is not null
			and t.data_operazione >= ((select d from da)::timestamp at time zone 'Europe/Rome')
			and t.data_operazione <= now()
		group by 1
	),
	-- ───── venduto per mese, con nuovi e rinnovi
	vendite as (
		select date_trunc('month', a.data_vendita at time zone 'Europe/Rome')::date as m,
			a.totale,
			exists (
				select 1
				from public.abbonamenti b
				left join public.prodotti_gruppi gb on gb.categoria = b.categoria
				where b.cancellato_il is null
					and b.persona_id = a.persona_id
					and b.id <> a.id
					and b.data_fine >= a.data_inizio - 30
					and b.data_fine <= a.data_inizio
					and coalesce(gb.gruppo, 'Altro') = coalesce(g.gruppo, 'Altro')
			) as rinnovo
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		where a.cancellato_il is null
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
			and a.data_vendita >= ((select d from da)::timestamp at time zone 'Europe/Rome')
			and a.data_vendita <= now()
	),
	vendite_mese as (
		select m,
			count(*) as vendite,
			round(coalesce(sum(totale), 0)) as venduto,
			count(*) filter (where rinnovo) as vendite_rinnovi,
			round(coalesce(sum(totale) filter (where rinnovo), 0)) as venduto_rinnovi
		from vendite
		group by m
	),
	-- ───── iscritti a fine mese (oggi per il mese in corso)
	prodotti as (
		select a.persona_id, a.data_inizio, a.data_fine,
			(a.data_vendita at time zone 'Europe/Rome')::date as dv
		from public.abbonamenti a, oggi
		where a.cancellato_il is null
			and a.persona_id is not null
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
			and a.data_fine >= a.data_inizio
			and a.data_fine <= oggi.d + 1500
			and a.data_fine >= (select d from da)
			and a.data_inizio <= oggi.d
	),
	iscritti as (
		select mm.m, count(distinct p.persona_id) as iscritti
		from mesi mm
		join prodotti p on p.data_inizio <= mm.g and p.data_fine >= mm.g and p.dv <= mm.g
		group by mm.m
	),
	-- ───── iscritti oggi, un mese fa, un anno fa (stesso giorno)
	giorni as (
		select 'oggi'::text as quando, oggi.d as g from oggi
		union all select 'mese_fa', (oggi.d - interval '1 month')::date from oggi
		union all select 'anno_fa', (oggi.d - interval '1 year')::date from oggi
	),
	iscritti_giorni as (
		select gg.quando, gg.g, count(distinct p.persona_id) as persone
		from giorni gg
		join prodotti p on p.data_inizio <= gg.g and p.data_fine >= gg.g and p.dv <= gg.g
		group by gg.quando, gg.g
	),
	-- ───── valorizzazione dei prodotti attivi oggi
	attivi as (
		select coalesce(g.gruppo, 'Altro') as gruppo, a.persona_id, coalesce(a.totale, 0) as totale,
			(a.data_fine - a.data_inizio + 1) as giorni,
			greatest(a.data_fine - oggi.d, 0) as restano
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		cross join oggi
		where a.cancellato_il is null
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
			and a.data_inizio <= oggi.d
			and a.data_fine >= oggi.d
			and a.data_fine >= a.data_inizio
			and a.data_fine <= oggi.d + 1500
			and (a.data_vendita at time zone 'Europe/Rome')::date <= oggi.d
	),
	valorizzazione as (
		select gruppo,
			count(*) as prodotti,
			count(distinct persona_id) as persone,
			round(sum(totale)) as valore,
			round(sum(totale * restano::numeric / giorni)) as residuo,
			round(sum(totale / greatest(giorni / 30.4375, 1))) as mensile
		from attivi
		group by grouping sets ((gruppo), ())
	),
	-- ───── mese e anno in corso contro gli stessi giorni dell'anno scorso
	tagli as (
		select k as anni_fa,
			make_date(extract(year from oggi.d)::int - k, extract(month from oggi.d)::int, 1) as inizio_mese,
			make_date(extract(year from oggi.d)::int - k, 1, 1) as inizio_anno,
			(oggi.d - make_interval(years => k))::date as fino_a
		from oggi, generate_series(0, 1) k
	),
	periodi as (
		select 'mtd'::text as periodo, anni_fa, inizio_mese as da, fino_a as a from tagli
		union all
		select 'ytd', anni_fa, inizio_anno, fino_a from tagli
	),
	periodi_vendite as (
		select p.periodo, p.anni_fa, count(a.id) as vendite, round(coalesce(sum(a.totale), 0)) as venduto
		from periodi p
		left join public.abbonamenti a
			on a.cancellato_il is null
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
			and a.data_vendita >= (p.da::timestamp at time zone 'Europe/Rome')
			and a.data_vendita < ((p.a + 1)::timestamp at time zone 'Europe/Rome')
			and a.data_vendita <= now()
		group by p.periodo, p.anni_fa
	),
	periodi_incassi as (
		select p.periodo, p.anni_fa, round(coalesce(sum(t.importo), 0)) as incassato
		from periodi p
		left join public.transazioni t
			on t.cancellato_il is null
			and t.movimenta_cassa
			and t.importo is not null
			and t.data_operazione >= (p.da::timestamp at time zone 'Europe/Rome')
			and t.data_operazione < ((p.a + 1)::timestamp at time zone 'Europe/Rome')
			and t.data_operazione <= now()
		group by p.periodo, p.anni_fa
	)
	select jsonb_build_object(
		'oggi', (select d from oggi),
		'aggiornato_al', (select max(valore) from public.sync_info4u_stato where chiave = 'refresh_transazioni'),
		'mesi', (
			select jsonb_agg(jsonb_build_object(
				'mese', mm.m,
				'incassato', coalesce(i.incassato, 0),
				'incassato_abbonamenti', coalesce(i.incassato_abbonamenti, 0),
				'vendite', coalesce(v.vendite, 0),
				'venduto', coalesce(v.venduto, 0),
				'vendite_rinnovi', coalesce(v.vendite_rinnovi, 0),
				'venduto_rinnovi', coalesce(v.venduto_rinnovi, 0),
				'iscritti', coalesce(s.iscritti, 0)
			) order by mm.m)
			from mesi mm
			left join incassi i on i.m = mm.m
			left join vendite_mese v on v.m = mm.m
			left join iscritti s on s.m = mm.m
		),
		'iscritti', coalesce((
			select jsonb_agg(jsonb_build_object('quando', quando, 'giorno', g, 'persone', persone))
			from iscritti_giorni
		), '[]'::jsonb),
		'valorizzazione', coalesce((
			select jsonb_agg(jsonb_build_object(
				'gruppo', gruppo, 'prodotti', prodotti, 'persone', persone,
				'valore', valore, 'residuo', residuo, 'mensile', mensile
			) order by gruppo is not null, valore desc)
			from valorizzazione
		), '[]'::jsonb),
		'periodi', coalesce((
			select jsonb_agg(jsonb_build_object(
				'periodo', p.periodo, 'anni_fa', p.anni_fa, 'da', p.da, 'a', p.a,
				'vendite', coalesce(v.vendite, 0), 'venduto', coalesce(v.venduto, 0),
				'incassato', coalesce(i.incassato, 0)
			))
			from periodi p
			left join periodi_vendite v using (periodo, anni_fa)
			left join periodi_incassi i using (periodo, anni_fa)
		), '[]'::jsonb)
	);
$$;

comment on function public.dashboard_direzionale() is
	'Panoramica del pannello: 36 mesi di incassato, venduto (nuovi/rinnovi) e iscritti, valorizzazione dei prodotti attivi, mese e anno in corso contro l''anno scorso.';

-- ──────────────────────────────────────────── scadenze e rinnovi (riepilogo)

create or replace function public.dashboard_scadenze()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with oggi as (
		select (now() at time zone 'Europe/Rome')::date as d
	),
	finestra as (
		select (date_trunc('month', oggi.d) - interval '35 months')::date as da,
			(date_trunc('month', oggi.d) + interval '4 months')::date as a
		from oggi
	),
	sc as (
		select a.id, a.persona_id, a.data_fine, coalesce(a.totale, 0) as totale,
			coalesce(g.gruppo, 'Altro') as gruppo
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		cross join finestra f
		where a.cancellato_il is null
			and a.persona_id is not null
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
			and a.data_fine >= f.da
			and a.data_fine < f.a
			and a.data_fine >= a.data_inizio
	),
	esito as (
		select sc.*, r.totale as totale_rinnovo
		from sc
		left join lateral (
			select coalesce(b.totale, 0) as totale
			from public.abbonamenti b
			left join public.prodotti_gruppi gb on gb.categoria = b.categoria
			where b.cancellato_il is null
				and b.persona_id = sc.persona_id
				and b.id <> sc.id
				and b.data_inizio >= sc.data_fine
				and b.data_inizio <= sc.data_fine + 30
				and coalesce(gb.gruppo, 'Altro') = sc.gruppo
			order by b.data_inizio
			limit 1
		) r on true
	),
	mesi as (
		select date_trunc('month', data_fine)::date as mese, gruppo,
			count(*) as scadenze,
			count(totale_rinnovo) as rinnovati,
			round(sum(totale)) as valore,
			round(coalesce(sum(totale) filter (where totale_rinnovo is not null), 0)) as valore_rinnovati,
			round(coalesce(sum(totale_rinnovo), 0)) as valore_rinnovi
		from esito
		group by 1, 2
	)
	select jsonb_build_object(
		'oggi', (select d from oggi),
		'aggiornato_al', (select max(valore) from public.sync_info4u_stato where chiave = 'refresh_transazioni'),
		'mesi', coalesce((
			select jsonb_agg(jsonb_build_object(
				'mese', mese, 'gruppo', gruppo, 'scadenze', scadenze, 'rinnovati', rinnovati,
				'valore', valore, 'valore_rinnovati', valore_rinnovati, 'valore_rinnovi', valore_rinnovi
			) order by mese, gruppo)
			from mesi
		), '[]'::jsonb)
	);
$$;

comment on function public.dashboard_scadenze() is
	'Scadenze per mese di fine e gruppo (35 mesi indietro, 3 avanti): quante, quante rinnovate entro 30 giorni nello stesso gruppo, e i valori.';

-- ──────────────────────────────────────────── scadenze, una per una

create or replace function public.dashboard_scadenze_elenco(
	p_filtri jsonb,
	p_limite integer default 50,
	p_salta integer default 0,
	p_ordine text default 'fine'
)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with f as (
		select
			coalesce(nullif(p_filtri->>'da', '')::date, date_trunc('month', (now() at time zone 'Europe/Rome'))::date) as da,
			coalesce(nullif(p_filtri->>'a', '')::date, (date_trunc('month', (now() at time zone 'Europe/Rome')) + interval '1 month - 1 day')::date) as a,
			case when jsonb_typeof(p_filtri->'gruppi') = 'array' and jsonb_array_length(p_filtri->'gruppi') > 0
				then array(select jsonb_array_elements_text(p_filtri->'gruppi')) end as gruppi,
			coalesce(nullif(p_filtri->>'stato', ''), 'tutti') as stato,
			nullif(lower(btrim(p_filtri->>'q')), '') as q
	),
	sc as (
		select a.id, a.persona_id, a.abbonamento, a.data_inizio, a.data_fine, a.totale,
			coalesce(a.venditore_nome, a.operatore_nome) as venditore,
			coalesce(g.gruppo, 'Altro') as gruppo,
			p.nome, p.cognome, p.cellulare, p.email
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		left join public.persone p on p.id = a.persona_id
		cross join f
		where a.cancellato_il is null
			and a.persona_id is not null
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
			and a.data_fine >= f.da
			and a.data_fine <= f.a
			and a.data_fine >= a.data_inizio
			and (f.gruppi is null or coalesce(g.gruppo, 'Altro') = any (f.gruppi))
			and (f.q is null
				or lower(coalesce(p.nome, '') || ' ' || coalesce(p.cognome, '')) like '%' || f.q || '%'
				or lower(coalesce(p.cognome, '') || ' ' || coalesce(p.nome, '')) like '%' || f.q || '%'
				or lower(coalesce(a.abbonamento, '')) like '%' || f.q || '%'
				or regexp_replace(coalesce(p.cellulare, ''), '\D', '', 'g') like '%' || nullif(regexp_replace(f.q, '\D', '', 'g'), '') || '%')
	),
	esito as (
		select sc.*, r.abbonamento as rinnovo_abbonamento, r.data_inizio as rinnovo_inizio,
			r.data_fine as rinnovo_fine, r.totale as rinnovo_totale
		from sc
		left join lateral (
			select b.abbonamento, b.data_inizio, b.data_fine, b.totale
			from public.abbonamenti b
			left join public.prodotti_gruppi gb on gb.categoria = b.categoria
			where b.cancellato_il is null
				and b.persona_id = sc.persona_id
				and b.id <> sc.id
				and b.data_inizio >= sc.data_fine
				and b.data_inizio <= sc.data_fine + 30
				and coalesce(gb.gruppo, 'Altro') = sc.gruppo
			order by b.data_inizio
			limit 1
		) r on true
	),
	filtrate as (
		select e.*
		from esito e, f
		where f.stato = 'tutti'
			or (f.stato = 'rinnovati' and e.rinnovo_inizio is not null)
			or (f.stato = 'da_rinnovare' and e.rinnovo_inizio is null)
	)
	select jsonb_build_object(
		'totale', (select count(*) from filtrate),
		'rinnovati', (select count(*) from filtrate where rinnovo_inizio is not null),
		'valore', (select coalesce(round(sum(totale)), 0) from filtrate),
		'valore_da_rinnovare', (select coalesce(round(sum(totale) filter (where rinnovo_inizio is null)), 0) from filtrate),
		'righe', coalesce((
			select jsonb_agg(to_jsonb(x) - 'persona_id' - 'id')
			from (
				select *
				from filtrate
				order by
					case when p_ordine = 'importo' then totale end desc nulls last,
					case when p_ordine = 'nome' then lower(coalesce(cognome, '') || ' ' || coalesce(nome, '')) end,
					data_fine, cognome, nome
				limit least(greatest(coalesce(p_limite, 50), 1), 20000)
				offset greatest(coalesce(p_salta, 0), 0)
			) x
		), '[]'::jsonb)
	);
$$;

comment on function public.dashboard_scadenze_elenco(jsonb, integer, integer, text) is
	'Prodotti che scadono nel periodo, con persona, contatti e l''eventuale rinnovo (stesso gruppo, entro 30 giorni). Filtri: da, a, gruppi, stato (tutti/rinnovati/da_rinnovare), q.';

-- ──────────────────────────────────────────── incassi: base filtrata (interna)

create or replace function public.dashboard_incassi_base(p_filtri jsonb)
returns table (
	giorno date,
	quando timestamptz,
	importo numeric,
	tipologia text,
	metodo text,
	operatore text,
	gruppo text,
	descrizione text,
	causale text,
	persona_id uuid,
	nome text,
	cognome text,
	abbonamento text
)
language sql
stable
set search_path to 'public'
as $$
	with f as (
		select
			coalesce(nullif(p_filtri->>'da', '')::date, make_date(extract(year from now())::int, 1, 1)) as da,
			coalesce(nullif(p_filtri->>'a', '')::date, (now() at time zone 'Europe/Rome')::date) as a,
			case when jsonb_typeof(p_filtri->'tipologie') = 'array' and jsonb_array_length(p_filtri->'tipologie') > 0
				then array(select jsonb_array_elements_text(p_filtri->'tipologie')) end as tipologie,
			case when jsonb_typeof(p_filtri->'metodi') = 'array' and jsonb_array_length(p_filtri->'metodi') > 0
				then array(select jsonb_array_elements_text(p_filtri->'metodi')) end as metodi,
			case when jsonb_typeof(p_filtri->'operatori') = 'array' and jsonb_array_length(p_filtri->'operatori') > 0
				then array(select jsonb_array_elements_text(p_filtri->'operatori')) end as operatori,
			nullif(lower(btrim(p_filtri->>'q')), '') as q,
			coalesce(nullif(p_filtri->>'segno', ''), 'tutti') as segno,
			nullif(p_filtri->>'min', '')::numeric as vmin,
			nullif(p_filtri->>'max', '')::numeric as vmax
	),
	t as (
		select
			(t.data_operazione at time zone 'Europe/Rome')::date as giorno,
			t.data_operazione as quando,
			t.importo,
			case t.tipo_servizio
				when 'A' then coalesce(g.gruppo, 'Abbonamenti non attribuiti')
				when 'V' then 'Ingressi e vendite singole'
				when 'O' then 'Iscrizioni a corsi'
				when 'Z' then 'Agenda (appuntamenti)'
				when 'C' then 'Cauzioni tessere'
				when 'I' then 'Tesseramenti'
				when 'B' then 'Borsellino'
				else 'Altro'
			end as tipologia,
			case
				when t.metodo_pagamento is null then 'Non indicato'
				when lower(t.metodo_pagamento) in ('carta di credito', 'tspay carta di credito') then 'Carta di credito'
				when lower(t.metodo_pagamento) in ('assegno', 'assegni/bancari') then 'Assegni'
				when lower(t.metodo_pagamento) = 'rid' then 'RID (addebito)'
				when lower(t.metodo_pagamento) in ('contanti', 'bancomat', 'bonifico', 'finanziamento') then initcap(t.metodo_pagamento)
				else 'Altro'
			end as metodo,
			coalesce(t.operatore_nome, 'Senza operatore') as operatore,
			case when t.tipo_servizio = 'A' then coalesce(g.gruppo, 'Altro') end as gruppo,
			t.descrizione_servizio as descrizione,
			t.causale,
			t.persona_id,
			p.nome,
			p.cognome,
			a.abbonamento
		from public.transazioni t
		cross join f
		left join public.abbonamenti a on t.tipo_servizio = 'A' and a.source_iscrizione_id = t.source_iscrizione_id
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		left join public.persone p on p.id = t.persona_id
		where t.cancellato_il is null
			and t.movimenta_cassa
			and t.importo is not null
			and t.data_operazione >= (f.da::timestamp at time zone 'Europe/Rome')
			and t.data_operazione < ((f.a + 1)::timestamp at time zone 'Europe/Rome')
			and t.data_operazione <= now()
	)
	select t.*
	from t, f
	where (f.tipologie is null or t.tipologia = any (f.tipologie))
		and (f.metodi is null or t.metodo = any (f.metodi))
		and (f.operatori is null or t.operatore = any (f.operatori))
		and (f.segno = 'tutti' or (f.segno = 'entrate' and t.importo > 0) or (f.segno = 'uscite' and t.importo < 0))
		and (f.vmin is null or t.importo >= f.vmin)
		and (f.vmax is null or t.importo <= f.vmax)
		and (f.q is null
			or lower(coalesce(t.nome, '') || ' ' || coalesce(t.cognome, '')) like '%' || f.q || '%'
			or lower(coalesce(t.cognome, '') || ' ' || coalesce(t.nome, '')) like '%' || f.q || '%'
			or lower(coalesce(t.descrizione, '')) like '%' || f.q || '%'
			or lower(coalesce(t.causale, '')) like '%' || f.q || '%'
			or lower(coalesce(t.abbonamento, '')) like '%' || f.q || '%');
$$;

-- ──────────────────────────────────────────── incassi: totali raggruppati

create or replace function public.dashboard_incassi(p_filtri jsonb, p_raggruppa text default 'mese')
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with b as (
		select * from public.dashboard_incassi_base(p_filtri)
	),
	k as (
		select
			case p_raggruppa
				when 'giorno' then to_char(b.giorno, 'YYYY-MM-DD')
				when 'settimana' then to_char(date_trunc('week', b.giorno), 'YYYY-MM-DD')
				when 'mese' then to_char(b.giorno, 'YYYY-MM')
				when 'anno' then to_char(b.giorno, 'YYYY')
				when 'tipologia' then b.tipologia
				when 'metodo' then b.metodo
				when 'operatore' then b.operatore
				when 'gruppo' then coalesce(b.gruppo, 'Non abbonamenti')
				else 'totale'
			end as chiave,
			b.importo, b.persona_id
		from b
	),
	righe as (
		select chiave,
			round(sum(importo)) as importo,
			count(*) as movimenti,
			count(distinct persona_id) as persone
		from k
		group by chiave
	)
	select jsonb_build_object(
		'totali', (
			select jsonb_build_object(
				'importo', coalesce(round(sum(importo)), 0),
				'entrate', coalesce(round(sum(importo) filter (where importo > 0)), 0),
				'uscite', coalesce(round(sum(importo) filter (where importo < 0)), 0),
				'movimenti', count(*),
				'persone', count(distinct persona_id)
			)
			from b
		),
		'righe', coalesce((
			select jsonb_agg(jsonb_build_object('chiave', chiave, 'importo', importo, 'movimenti', movimenti, 'persone', persone)
				order by importo desc)
			from (select * from righe order by importo desc limit 400) r
		), '[]'::jsonb),
		'troncato', (select count(*) > 400 from righe)
	);
$$;

-- ──────────────────────────────────────────── incassi: movimenti uno per uno

create or replace function public.dashboard_incassi_righe(
	p_filtri jsonb,
	p_limite integer default 50,
	p_salta integer default 0,
	p_ordine text default 'data'
)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with b as (
		select * from public.dashboard_incassi_base(p_filtri)
	)
	select jsonb_build_object(
		'totale', (select count(*) from b),
		'righe', coalesce((
			select jsonb_agg(to_jsonb(x) - 'persona_id' - 'giorno')
			from (
				select *
				from b
				order by
					case when p_ordine = 'importo' then abs(importo) end desc nulls last,
					quando desc
				limit least(greatest(coalesce(p_limite, 50), 1), 20000)
				offset greatest(coalesce(p_salta, 0), 0)
			) x
		), '[]'::jsonb)
	);
$$;

-- ──────────────────────────────────────────── incassi: valori per i menu

create or replace function public.dashboard_incassi_opzioni()
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	select jsonb_build_object(
		'tipologie', (
			select jsonb_agg(x order by x)
			from (
				select distinct coalesce(g.gruppo, 'Abbonamenti non attribuiti') as x
				from public.prodotti_gruppi g
				union select 'Abbonamenti non attribuiti'
				union select 'Ingressi e vendite singole'
				union select 'Iscrizioni a corsi'
				union select 'Agenda (appuntamenti)'
				union select 'Cauzioni tessere'
				union select 'Tesseramenti'
				union select 'Borsellino'
				union select 'Altro'
			) t
		),
		'metodi', jsonb_build_array('Bancomat', 'Bonifico', 'Carta di credito', 'Contanti', 'Assegni', 'Finanziamento', 'RID (addebito)', 'Non indicato', 'Altro'),
		'operatori', coalesce((
			select jsonb_agg(operatore_nome order by operatore_nome)
			from (
				select distinct operatore_nome
				from public.transazioni
				where operatore_nome is not null
					and cancellato_il is null
					and data_operazione >= now() - interval '3 years'
			) o
		), '[]'::jsonb),
		'gruppi', coalesce((
			select jsonb_agg(gruppo order by min_ordine)
			from (select gruppo, min(ordine) as min_ordine from public.prodotti_gruppi group by gruppo) g
		), '[]'::jsonb)
	);
$$;

-- ──────────────────────────────────────────── permessi

revoke execute on function public.dashboard_direzionale() from public, anon, authenticated;
revoke execute on function public.dashboard_scadenze() from public, anon, authenticated;
revoke execute on function public.dashboard_scadenze_elenco(jsonb, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.dashboard_incassi_base(jsonb) from public, anon, authenticated;
revoke execute on function public.dashboard_incassi(jsonb, text) from public, anon, authenticated;
revoke execute on function public.dashboard_incassi_righe(jsonb, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.dashboard_incassi_opzioni() from public, anon, authenticated;
grant execute on function public.dashboard_direzionale() to service_role;
grant execute on function public.dashboard_scadenze() to service_role;
grant execute on function public.dashboard_scadenze_elenco(jsonb, integer, integer, text) to service_role;
grant execute on function public.dashboard_incassi_base(jsonb) to service_role;
grant execute on function public.dashboard_incassi(jsonb, text) to service_role;
grant execute on function public.dashboard_incassi_righe(jsonb, integer, integer, text) to service_role;
grant execute on function public.dashboard_incassi_opzioni() to service_role;

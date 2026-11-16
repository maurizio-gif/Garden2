-- Contatti e scheda cliente del pannello di Garden.
--
-- Come le altre funzioni del pannello, le chiama solo il server Next.js con la
-- service_role (niente execute a public/anon/authenticated).
--
-- Definizioni (cambiarle qui, il pannello non le conosce):
--   · «prodotti» = abbonamenti non cancellati, esclusi QUOTA ASSOCIATIVA e
--     QUOTE EXTRA, con date sensate;
--   · stato di una persona, oggi:
--       attivo         ha un prodotto iniziato e non finito;
--       in_scadenza    attivo, ma tutti i suoi prodotti finiscono entro 30 giorni;
--       in_partenza    non attivo, ma ha un prodotto che deve ancora iniziare;
--       scaduto        l'ultimo prodotto è finito negli ultimi 90 giorni;
--       ex             l'ultimo prodotto è finito da più di 90 giorni;
--       mai            nessun prodotto (contatti, prove, lead);
--   · «ultimo abbonamento» = il prodotto con la data di fine più lontana;
--   · rate scadute = rate non pagate con scadenza passata (meno di un anno);
--   · presenze e ultimo accesso dai riassunti accessi_giorno.

create or replace function public.dashboard_contatti(
	p_filtri jsonb,
	p_limite integer default 50,
	p_salta integer default 0,
	p_ordine text default 'nome'
)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with oggi as (
		select (now() at time zone 'Europe/Rome')::date as d
	),
	f as (
		select
			nullif(lower(btrim(p_filtri->>'q')), '') as q,
			coalesce(nullif(p_filtri->>'stato', ''), 'tutti') as stato,
			case when jsonb_typeof(p_filtri->'gruppi') = 'array' and jsonb_array_length(p_filtri->'gruppi') > 0
				then array(select jsonb_array_elements_text(p_filtri->'gruppi')) end as gruppi,
			nullif(lower(btrim(p_filtri->>'abbonamento')), '') as abbonamento,
			coalesce((p_filtri->>'rate_scadute')::boolean, false) as rate_scadute,
			nullif(p_filtri->>'assenti', '')::int as assenti,
			nullif(p_filtri->>'sesso', '') as sesso,
			nullif(p_filtri->>'eta_min', '')::int as eta_min,
			nullif(p_filtri->>'eta_max', '')::int as eta_max,
			coalesce((p_filtri->>'certificato_scaduto')::boolean, false) as certificato_scaduto
	),
	prodotti as (
		select a.persona_id, a.abbonamento, a.data_inizio, a.data_fine, a.totale, coalesce(g.gruppo, 'Altro') as gruppo
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		cross join oggi
		where a.cancellato_il is null
			and a.persona_id is not null
			and coalesce(a.categoria, '') not in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA')
			and a.data_fine >= a.data_inizio
			and a.data_fine <= oggi.d + 1500
	),
	per_persona as (
		select p.persona_id,
			bool_or(p.data_inizio <= oggi.d and p.data_fine >= oggi.d) as attivo,
			bool_or(p.data_inizio > oggi.d) as futuro,
			max(p.data_fine) as ultima_fine,
			min(p.data_inizio) as cliente_dal,
			count(*) as prodotti
		from prodotti p, oggi
		group by p.persona_id
	),
	ultimo as (
		select distinct on (persona_id) persona_id, abbonamento, gruppo, data_inizio, data_fine
		from prodotti
		order by persona_id, data_fine desc, data_inizio desc
	),
	rate as (
		select distinct a.persona_id
		from public.abbonamenti_rate r
		join public.abbonamenti a on a.source_iscrizione_id = r.source_iscrizione_id and a.cancellato_il is null
		cross join oggi
		where r.cancellato_il is null and r.data_pagato is null
			and r.data_rata < oggi.d and r.data_rata >= oggi.d - 365
	),
	base as (
		select pe.id, pe.nome, pe.cognome, pe.cellulare, pe.email, pe.sesso, pe.data_nascita, pe.source_utente_id,
			pe.codice_fiscale,
			case
				when pp.persona_id is null then 'mai'
				when pp.attivo and pp.ultima_fine <= oggi.d + 30 then 'in_scadenza'
				when pp.attivo then 'attivo'
				when pp.futuro then 'in_partenza'
				when pp.ultima_fine >= oggi.d - 90 then 'scaduto'
				else 'ex'
			end as stato,
			pp.cliente_dal, pp.ultima_fine, coalesce(pp.prodotti, 0) as prodotti,
			u.abbonamento, u.gruppo,
			(r.persona_id is not null) as ha_rate_scadute,
			date_part('year', age(oggi.d, pe.data_nascita))::int as eta
		from public.persone pe
		cross join oggi
		left join per_persona pp on pp.persona_id = pe.id
		left join ultimo u on u.persona_id = pe.id
		left join rate r on r.persona_id = pe.id
		where coalesce(pe.storico, false) = false
	),
	-- filtri tranne lo stato (servono anche per i conteggi per stato)
	filtrate as (
		select b.*
		from base b, f
		where (f.q is null
				or lower(coalesce(b.nome, '') || ' ' || coalesce(b.cognome, '')) like '%' || f.q || '%'
				or lower(coalesce(b.cognome, '') || ' ' || coalesce(b.nome, '')) like '%' || f.q || '%'
				or lower(coalesce(b.email, '')) like '%' || f.q || '%'
				or lower(coalesce(b.codice_fiscale, '')) = f.q
				or (length(regexp_replace(f.q, '\D', '', 'g')) >= 4
					and regexp_replace(coalesce(b.cellulare, ''), '\D', '', 'g') like '%' || regexp_replace(f.q, '\D', '', 'g') || '%'))
			and (f.gruppi is null or b.gruppo = any (f.gruppi))
			and (f.abbonamento is null or lower(coalesce(b.abbonamento, '')) like '%' || f.abbonamento || '%')
			and (not f.rate_scadute or b.ha_rate_scadute)
			and (f.sesso is null or upper(b.sesso) = upper(f.sesso))
			and (f.eta_min is null or b.eta >= f.eta_min)
			and (f.eta_max is null or b.eta <= f.eta_max)
	),
	-- assenti e certificato scaduto: solo dove servono (costano una ricerca per persona)
	con_stato as (
		select x.*
		from filtrate x, f
		where (f.stato = 'tutti' and x.stato <> 'mai')
			or f.stato = 'tutti_compresi_mai'
			or x.stato = f.stato
			or (f.stato = 'attivi' and x.stato in ('attivo', 'in_scadenza'))
	),
	-- assenti e certificato scaduto: una ricerca per persona, solo se il filtro c'è
	finali as (
		select c.*
		from con_stato c
		cross join f
		cross join oggi
		where (f.assenti is null or not exists (
				select 1 from public.accessi_giorno g
				where g.source_utente_id = c.source_utente_id and g.giorno >= oggi.d - f.assenti
			))
			and (not f.certificato_scaduto or not exists (
				select 1 from public.certificati ce
				where ce.source_utente_id = c.source_utente_id and ce.data_scadenza >= oggi.d
			))
	)
	select jsonb_build_object(
		'totale', (select count(*) from finali),
		'per_stato', (
			select jsonb_object_agg(stato, n)
			from (select stato, count(*) as n from filtrate group by stato) s
		),
		'righe', coalesce((
			select jsonb_agg(jsonb_build_object(
				'id', id, 'nome', nome, 'cognome', cognome, 'cellulare', cellulare, 'email', email,
				'eta', eta, 'stato', stato, 'abbonamento', abbonamento, 'gruppo', gruppo,
				'cliente_dal', cliente_dal, 'ultima_fine', ultima_fine, 'prodotti', prodotti,
				'rate_scadute', ha_rate_scadute, 'ultimo_accesso', ultimo_accesso
			))
			from (
				-- l'ultimo accesso si cerca solo per le righe della pagina (o per tutte se si ordina per quello)
				select pagina.*, (select max(g.giorno) from public.accessi_giorno g where g.source_utente_id = pagina.source_utente_id) as ultimo_accesso
				from (
					select * from finali
					order by
						case when p_ordine = 'scadenza' then ultima_fine end asc nulls last,
						case when p_ordine = 'accesso' then (select max(g.giorno) from public.accessi_giorno g where g.source_utente_id = finali.source_utente_id) end desc nulls last,
						case when p_ordine = 'cliente' then cliente_dal end asc nulls last,
						lower(coalesce(cognome, '')), lower(coalesce(nome, ''))
					limit least(greatest(coalesce(p_limite, 50), 1), 20000)
					offset greatest(coalesce(p_salta, 0), 0)
				) pagina
			) x
		), '[]'::jsonb)
	);
$$;

comment on function public.dashboard_contatti(jsonb, integer, integer, text) is
	'Elenco delle persone con stato (attivo, in scadenza, scaduto, ex, mai), ultimo abbonamento, rate scadute e ultimo accesso. Filtri: q, stato, gruppi, abbonamento, rate_scadute, assenti (giorni), sesso, eta_min, eta_max, certificato_scaduto.';

-- ───────────────────────────────────────────────────── scheda di una persona

create or replace function public.dashboard_persona(p_id uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with oggi as (
		select (now() at time zone 'Europe/Rome')::date as d
	),
	pe as (
		select * from public.persone where id = p_id
	),
	abb as (
		select a.*, coalesce(g.gruppo, 'Altro') as gruppo,
			coalesce(a.categoria, '') in ('QUOTA ASSOCIATIVA', 'QUOTE EXTRA') as quota
		from public.abbonamenti a
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		where a.persona_id = p_id and a.cancellato_il is null
	),
	rate as (
		select r.*, a.abbonamento
		from public.abbonamenti_rate r
		join abb a on a.source_iscrizione_id = r.source_iscrizione_id
		where r.cancellato_il is null
	),
	sosp as (
		select s.*, a.abbonamento
		from public.abbonamenti_sospensioni s
		join abb a on a.source_iscrizione_id = s.source_iscrizione_id
		where s.cancellato_il is null
	),
	mov as (
		select t.* from public.transazioni t
		where t.persona_id = p_id and t.cancellato_il is null and t.movimenta_cassa and t.data_operazione <= now()
	),
	pres as (
		select g.* from public.accessi_giorno g, pe where g.source_utente_id = pe.source_utente_id
	)
	select case when not exists (select 1 from pe) then null else jsonb_build_object(
		'oggi', (select d from oggi),
		'persona', (
			select jsonb_build_object(
				'id', id, 'nome', nome, 'cognome', cognome, 'email', email, 'cellulare', cellulare,
				'telefono_1', telefono_1, 'telefono_2', telefono_2, 'codice_fiscale', codice_fiscale,
				'data_nascita', data_nascita, 'sesso', sesso, 'luogo_nascita', luogo_nascita,
				'indirizzo', nullif(concat_ws(' ', indirizzo_via, indirizzo_civico), ''),
				'cap', indirizzo_cap, 'citta', indirizzo_citta, 'provincia', indirizzo_provincia,
				'note', note, 'creato_il', creato_il, 'source_utente_id', source_utente_id,
				'conflitto_con', conflitto_con_persona_id
			) from pe
		),
		'riepilogo', jsonb_build_object(
			'venduto', (select coalesce(round(sum(totale)), 0) from abb),
			'incassato', (select coalesce(round(sum(importo)), 0) from mov),
			'da_pagare_scaduto', (select coalesce(round(sum(r.importo)), 0) from rate r, oggi where r.data_pagato is null and r.data_rata < oggi.d),
			'da_pagare_futuro', (select coalesce(round(sum(r.importo)), 0) from rate r, oggi where r.data_pagato is null and r.data_rata >= oggi.d),
			'presenze', (select count(*) from pres),
			'presenze_12m', (select count(*) from pres, oggi where pres.giorno > oggi.d - 365),
			'settimane_12m', (select count(distinct settimana) from pres, oggi where pres.giorno > oggi.d - 365),
			'prima_presenza', (select min(giorno) from pres),
			'ultima_presenza', (select max(giorno) from pres)
		),
		'abbonamenti', coalesce((
			select jsonb_agg(jsonb_build_object(
				'source_iscrizione_id', source_iscrizione_id, 'abbonamento', abbonamento, 'gruppo', gruppo, 'categoria', categoria,
				'quota', quota, 'venduto_il', data_vendita, 'inizio', data_inizio, 'fine', data_fine, 'totale', totale,
				'listino', importo_listino, 'venditore', coalesce(venditore_nome, operatore_nome),
				'disdetta', data_disdetta, 'motivo_disdetta', motivo_disdetta, 'giorni_sospensione', gg_sospensione,
				'rinnovo_automatico', rinnovo_automatico, 'note', note
			) order by data_inizio desc nulls last, data_vendita desc)
			from abb
		), '[]'::jsonb),
		'rate', coalesce((
			select jsonb_agg(jsonb_build_object(
				'scadenza', data_rata, 'importo', importo, 'pagata_il', data_pagato, 'metodo', metodo_pagamento,
				'abbonamento', abbonamento, 'errore', transazione_errore
			) order by data_rata desc)
			from rate
		), '[]'::jsonb),
		'sospensioni', coalesce((
			select jsonb_agg(jsonb_build_object(
				'inizio', data_inizio, 'fine', data_fine, 'giorni', giorni_netti,
				'causale', coalesce(causale_descrizione, causale), 'abbonamento', abbonamento
			) order by data_inizio desc)
			from sosp
		), '[]'::jsonb),
		'pagamenti', coalesce((
			select jsonb_agg(jsonb_build_object(
				'quando', data_operazione, 'importo', importo, 'metodo', metodo_pagamento,
				'descrizione', descrizione_servizio, 'causale', causale, 'operatore', operatore_nome, 'tipo', tipo_servizio
			) order by data_operazione desc)
			from (select * from mov order by data_operazione desc limit 300) m
		), '[]'::jsonb),
		'pagamenti_totale', (select count(*) from mov),
		'presenze_mesi', coalesce((
			select jsonb_agg(jsonb_build_object('mese', mese, 'presenze', n) order by mese)
			from (
				select date_trunc('month', giorno)::date as mese, count(*) as n
				from pres, oggi where pres.giorno >= (date_trunc('month', oggi.d) - interval '23 months')::date
				group by 1
			) x
		), '[]'::jsonb),
		'presenze_dow', coalesce((
			select jsonb_agg(jsonb_build_object('dow', dow, 'presenze', n) order by dow)
			from (select extract(isodow from giorno)::int as dow, count(*) as n from pres, oggi where pres.giorno > oggi.d - 365 group by 1) x
		), '[]'::jsonb),
		'accessi', coalesce((
			select jsonb_agg(jsonb_build_object(
				'quando', x.data_accesso, 'varco', t.descrizione, 'esito', e.descrizione, 'tipo', x.tipo_accesso
			) order by x.data_accesso desc)
			from (
				select a.* from public.accessi a, pe
				where a.source_utente_id = pe.source_utente_id and a.data_accesso <= now()
				order by a.data_accesso desc limit 100
			) x
			left join public.terminali_info4u t
				on t.source_terminale_id = x.source_terminale_id and t.indirizzo = x.indirizzo and t.source_concentratore_id = x.source_concentratore_id
			left join public.esiti_accesso e on e.numero_esito = x.tipo_accesso
		), '[]'::jsonb),
		'certificati', coalesce((
			select jsonb_agg(jsonb_build_object('descrizione', c.descrizione, 'emesso', c.data_emissione, 'scadenza', c.data_scadenza) order by c.data_scadenza desc)
			from public.certificati c, pe where c.source_utente_id = pe.source_utente_id
		), '[]'::jsonb),
		'quote', coalesce((
			select jsonb_agg(jsonb_build_object('inizio', q.data_inizio, 'fine', q.data_fine, 'importo', q.importo) order by q.data_fine desc)
			from public.quote_associative q, pe where q.source_utente_id = pe.source_utente_id
		), '[]'::jsonb),
		'prenotazioni', coalesce((
			select jsonb_agg(jsonb_build_object('quando', x.data_inizio, 'cosa', c.descrizione, 'totale', x.totale, 'operatore', x.operatore_nome) order by x.data_inizio desc)
			from (
				select p.* from public.prenotazioni_iscrizioni p, pe
				where p.source_utente_id = pe.source_utente_id
				order by p.data_inizio desc limit 100
			) x
			left join public.prenotazioni_catalogo c on c.source_prenotazione_id = x.source_prenotazione_id
		), '[]'::jsonb),
		'prenotazioni_totale', (select count(*) from public.prenotazioni_iscrizioni p, pe where p.source_utente_id = pe.source_utente_id),
		'corsi', coalesce((
			select jsonb_agg(jsonb_build_object('inizio', c.data_inizio, 'fine', c.data_fine, 'importo', c.importo, 'lezioni', c.nr_lezioni, 'terminato', c.terminato) order by c.data_inizio desc)
			from public.corsi_iscrizioni c, pe where c.source_utente_id = pe.source_utente_id
		), '[]'::jsonb),
		'omaggi', coalesce((
			select jsonb_agg(jsonb_build_object('inizio', o.data_inizio, 'fine', o.data_fine, 'totali', o.omaggi_totali, 'usati', o.omaggi_usati) order by o.data_fine desc)
			from public.omaggi_iscrizioni o, pe where o.source_utente_id = pe.source_utente_id
		), '[]'::jsonb),
		'pratiche', coalesce((
			select jsonb_agg(jsonb_build_object(
				'creata', x.data_creazione, 'descrizione', x.descrizione, 'stato', s.nome, 'cambio_stato', x.data_stato,
				'chiusa', x.data_chiusura, 'valore', x.valore
			) order by x.data_creazione desc)
			from (
				select c.* from public.crm_pratiche c where c.persona_id = p_id order by c.data_creazione desc limit 50
			) x
			left join public.crm_stati_commerciali s on s.source_stato_id = x.source_stato_id
		), '[]'::jsonb),
		'memo', coalesce((
			select jsonb_agg(jsonb_build_object('quando', m.data_operazione, 'oggetto', m.oggetto, 'testo', m.descrizione) order by m.data_operazione desc)
			from public.crm_memo m, pe where m.source_utente_id = pe.source_utente_id
		), '[]'::jsonb),
		'email', coalesce((
			select jsonb_agg(jsonb_build_object('quando', x.data_creazione, 'oggetto', x.oggetto, 'inviata', x.data_invio, 'errore', x.errore) order by x.data_creazione desc)
			from (
				select e.* from public.email_info4u e, pe where e.source_utente_id = pe.source_utente_id
				order by e.data_creazione desc limit 50
			) x
		), '[]'::jsonb)
	) end;
$$;

comment on function public.dashboard_persona(uuid) is
	'Scheda cliente: anagrafica, riepilogo, abbonamenti, rate, sospensioni, pagamenti, presenze e accessi, certificati, quote, prenotazioni, corsi, omaggi, pratiche CRM, memo, email.';

revoke execute on function public.dashboard_contatti(jsonb, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.dashboard_persona(uuid) from public, anon, authenticated;
grant execute on function public.dashboard_contatti(jsonb, integer, integer, text) to service_role;
grant execute on function public.dashboard_persona(uuid) to service_role;

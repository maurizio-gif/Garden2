-- Dashboard finanziaria del pannello di Garden (pagina Finanza): venduto,
-- incassato, differenza tra i due e crediti verso i clienti, mese e anno in
-- corso contro gli stessi periodi degli anni scorsi.
--
-- Come le altre funzioni del pannello, la chiama solo il server Next.js con la
-- service_role. Restituisce già aggregato (jsonb).
--
-- Definizioni (cambiarle qui, il pannello non le conosce):
--   · MTD = dal 1 del mese di oggi a oggi; YTD = dal 1 gennaio a oggi; per gli
--     anni scorsi lo stesso giorno di calendario (il 29 febbraio diventa 28);
--   · «venduto» = somma di abbonamenti.totale per data_vendita, vendite non
--     cancellate. A differenza della pagina Abbonamenti QUI SONO INCLUSE le quote
--     associative: portano incassi veri e senza di loro venduto e incassato non
--     si possono confrontare;
--   · «incassato» = somma di transazioni.importo che movimentano cassa, al netto
--     degli storni, per data_operazione. È cassa: comprende anche ingressi
--     singoli, tesseramenti, agenda e le rate di vendite fatte mesi prima;
--   · tipologia dell'incassato: per i pagamenti di abbonamenti (tipo_servizio A)
--     è il gruppo di prodotti dell'abbonamento; per gli altri, la descrizione del
--     tipo. Le lettere sono dedotte dalle descrizioni delle transazioni di Info4U
--     (V ingressi e vendite singole, O iscrizioni a corsi, Z appuntamenti
--     dell'agenda, C cauzioni tessere, I tesseramenti, B borsellino);
--   · «differenza» = venduto − incassato sugli abbonamenti (tipo A). Positiva:
--     si è venduto più di quanto si è incassato (rate da riscuotere); negativa:
--     si sta incassando anche il venduto dei mesi scorsi;
--   · «crediti» = rate di abbonamento non cancellate e non pagate (data_pagato
--     nullo; in Info4U le rate aperte non hanno mai un movimento). Sono scadute
--     se data_rata è prima di oggi. Le date impossibili (prima del 2012, oltre
--     5 anni) sono scartate. Qui non ci sono i debiti verso i fornitori: Info4U
--     non li tiene;
--   · il credito scaduto agli anni scorsi si ricostruisce con data_rata e
--     data_pagato: «scaduta da meno di 90 giorni e non ancora pagata a quel
--     giorno». Le rate cancellate dopo non ci sono più;
--   · i giorni sono quelli di Europe/Rome.

create or replace function public.dashboard_finanza(p_anni integer default 3)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with oggi as (
		select (now() at time zone 'Europe/Rome')::date as d,
			least(greatest(coalesce(p_anni, 3), 1), 5) as n
	),
	anni as (
		select k as anni_fa,
			extract(year from oggi.d)::int - k as anno,
			extract(month from oggi.d)::int as mese,
			extract(day from oggi.d)::int as giorno
		from oggi, generate_series(0, (select n from oggi)) k
	),
	-- stesso giorno di calendario, con il 29 febbraio che diventa 28
	giorni as (
		select anni_fa, anno, mese,
			case when mese = 2 and giorno = 29 and not ((anno % 4 = 0 and anno % 100 <> 0) or anno % 400 = 0)
				then make_date(anno, 2, 28) else make_date(anno, mese, giorno) end as fino_a
		from anni
	),
	periodi as (
		select 'mtd'::text as periodo, g.anni_fa, make_date(g.anno, g.mese, 1) as da, g.fino_a as a
		from giorni g
		union all
		select 'ytd', g.anni_fa, make_date(g.anno, 1, 1), g.fino_a
		from giorni g
	),
	-- ───────────── venduto
	venduto as (
		select p.periodo, p.anni_fa, coalesce(g.gruppo, 'Altro') as gruppo,
			count(*) as vendite, round(sum(a.totale)) as fatturato
		from periodi p
		join public.abbonamenti a
			on a.cancellato_il is null
			and a.data_vendita >= (p.da::timestamp at time zone 'Europe/Rome')
			and a.data_vendita < ((p.a + 1)::timestamp at time zone 'Europe/Rome')
			and a.data_vendita <= now()
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		group by grouping sets ((p.periodo, p.anni_fa, coalesce(g.gruppo, 'Altro')), (p.periodo, p.anni_fa))
	),
	-- ───────────── incassato (una riga per transazione nei periodi)
	incassi as (
		select p.periodo, p.anni_fa,
			(t.tipo_servizio = 'A') as da_abbonamento,
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
			t.importo
		from periodi p
		join public.transazioni t
			on t.cancellato_il is null
			and t.movimenta_cassa
			and t.importo is not null
			and t.data_operazione >= (p.da::timestamp at time zone 'Europe/Rome')
			and t.data_operazione < ((p.a + 1)::timestamp at time zone 'Europe/Rome')
			and t.data_operazione <= now()
		left join public.abbonamenti a on t.tipo_servizio = 'A' and a.source_iscrizione_id = t.source_iscrizione_id
		left join public.prodotti_gruppi g on g.categoria = a.categoria
	),
	incassato_tipologia as (
		select periodo, anni_fa, tipologia, da_abbonamento, round(sum(importo)) as importo, count(*) as n
		from incassi
		group by periodo, anni_fa, tipologia, da_abbonamento
	),
	incassato_metodo as (
		select periodo, anni_fa, metodo, round(sum(importo)) as importo, count(*) as n
		from incassi
		group by periodo, anni_fa, metodo
	),
	-- ───────────── mese per mese (anno in corso e precedenti)
	inizio as (
		select make_date(extract(year from oggi.d)::int - oggi.n, 1, 1) as d from oggi
	),
	venduto_mese as (
		select extract(year from (a.data_vendita at time zone 'Europe/Rome'))::int as anno,
			extract(month from (a.data_vendita at time zone 'Europe/Rome'))::int as mese,
			round(sum(a.totale)) as venduto
		from public.abbonamenti a, inizio
		where a.cancellato_il is null
			and a.data_vendita >= (inizio.d::timestamp at time zone 'Europe/Rome')
			and a.data_vendita <= now()
		group by 1, 2
	),
	incassato_mese as (
		select extract(year from (t.data_operazione at time zone 'Europe/Rome'))::int as anno,
			extract(month from (t.data_operazione at time zone 'Europe/Rome'))::int as mese,
			round(sum(t.importo)) as incassato,
			round(sum(t.importo) filter (where t.tipo_servizio = 'A')) as incassato_abbonamenti
		from public.transazioni t, inizio
		where t.cancellato_il is null
			and t.movimenta_cassa
			and t.importo is not null
			and t.data_operazione >= (inizio.d::timestamp at time zone 'Europe/Rome')
			and t.data_operazione <= now()
		group by 1, 2
	),
	mesi as (
		select coalesce(v.anno, i.anno) as anno, coalesce(v.mese, i.mese) as mese,
			coalesce(v.venduto, 0) as venduto,
			coalesce(i.incassato, 0) as incassato,
			coalesce(i.incassato_abbonamenti, 0) as incassato_abbonamenti
		from venduto_mese v
		full join incassato_mese i on i.anno = v.anno and i.mese = v.mese
	),
	-- ───────────── crediti verso i clienti: rate non pagate
	rate_aperte as (
		select r.importo, r.data_rata, coalesce(r.metodo_pagamento, 'Non indicato') as metodo,
			coalesce(g.gruppo, 'Altro') as gruppo, a.persona_id
		from public.abbonamenti_rate r
		cross join oggi
		left join public.abbonamenti a on a.source_iscrizione_id = r.source_iscrizione_id
		left join public.prodotti_gruppi g on g.categoria = a.categoria
		where r.cancellato_il is null
			and r.data_pagato is null
			and r.importo > 0
			and r.data_rata >= '2012-01-01'
			and r.data_rata <= oggi.d + 1825
	),
	fasce as (
		select
			case
				when ra.data_rata < oggi.d - 365 then 's5'
				when ra.data_rata < oggi.d - 180 then 's4'
				when ra.data_rata < oggi.d - 90 then 's3'
				when ra.data_rata < oggi.d - 30 then 's2'
				when ra.data_rata < oggi.d then 's1'
				when ra.data_rata <= oggi.d + 30 then 'f1'
				when ra.data_rata <= oggi.d + 90 then 'f2'
				else 'f3'
			end as fascia,
			ra.importo
		from rate_aperte ra, oggi
	),
	fasce_somma as (
		select fascia, count(*) as n, round(sum(importo)) as importo from fasce group by fascia
	),
	scaduti_gruppo as (
		select ra.gruppo, count(*) as n, round(sum(ra.importo)) as importo
		from rate_aperte ra, oggi
		where ra.data_rata < oggi.d and ra.data_rata >= oggi.d - 365
		group by ra.gruppo
	),
	scaduti_metodo as (
		select ra.metodo, count(*) as n, round(sum(ra.importo)) as importo
		from rate_aperte ra, oggi
		where ra.data_rata < oggi.d and ra.data_rata >= oggi.d - 365
		group by ra.metodo
	),
	debitori as (
		select pe.nome, pe.cognome, round(sum(ra.importo)) as importo, count(*) as rate,
			min(ra.data_rata) as piu_vecchia
		from rate_aperte ra
		cross join oggi
		join public.persone pe on pe.id = ra.persona_id
		where ra.data_rata < oggi.d and ra.data_rata >= oggi.d - 365
		group by pe.id, pe.nome, pe.cognome
		order by sum(ra.importo) desc
		limit 15
	),
	-- credito scaduto da meno di 90 giorni, com'era nello stesso giorno degli anni scorsi
	scaduti_storici as (
		select g.anni_fa, g.fino_a as giorno, count(r.importo) as n, round(coalesce(sum(r.importo), 0)) as importo
		from giorni g
		left join public.abbonamenti_rate r
			on r.cancellato_il is null
			and r.importo > 0
			and r.data_rata >= g.fino_a - 90
			and r.data_rata < g.fino_a
			and (r.data_pagato is null or (r.data_pagato at time zone 'Europe/Rome')::date > g.fino_a)
		group by g.anni_fa, g.fino_a
	)
	select jsonb_build_object(
		'oggi', (select d from oggi),
		'aggiornato_al', (select max(valore) from public.sync_info4u_stato where chiave = 'refresh_transazioni'),
		'periodi', coalesce((
			select jsonb_agg(jsonb_build_object('periodo', periodo, 'anni_fa', anni_fa, 'da', da, 'a', a) order by periodo, anni_fa)
			from periodi
		), '[]'::jsonb),
		'venduto', coalesce((
			select jsonb_agg(jsonb_build_object(
				'periodo', periodo, 'anni_fa', anni_fa, 'gruppo', gruppo, 'vendite', vendite, 'fatturato', fatturato
			) order by periodo, anni_fa, gruppo nulls first)
			from venduto
		), '[]'::jsonb),
		'incassato_tipologia', coalesce((
			select jsonb_agg(jsonb_build_object(
				'periodo', periodo, 'anni_fa', anni_fa, 'tipologia', tipologia,
				'da_abbonamento', da_abbonamento, 'importo', importo, 'n', n
			) order by periodo, anni_fa, tipologia)
			from incassato_tipologia
		), '[]'::jsonb),
		'incassato_metodo', coalesce((
			select jsonb_agg(jsonb_build_object(
				'periodo', periodo, 'anni_fa', anni_fa, 'metodo', metodo, 'importo', importo, 'n', n
			) order by periodo, anni_fa, metodo)
			from incassato_metodo
		), '[]'::jsonb),
		'mesi', coalesce((
			select jsonb_agg(jsonb_build_object(
				'anno', anno, 'mese', mese, 'venduto', venduto, 'incassato', incassato,
				'incassato_abbonamenti', incassato_abbonamenti
			) order by anno, mese)
			from mesi
		), '[]'::jsonb),
		'crediti', jsonb_build_object(
			'fasce', coalesce((select jsonb_object_agg(fascia, jsonb_build_object('n', n, 'importo', importo)) from fasce_somma), '{}'::jsonb),
			'per_gruppo', coalesce((
				select jsonb_agg(jsonb_build_object('gruppo', gruppo, 'n', n, 'importo', importo) order by importo desc)
				from scaduti_gruppo
			), '[]'::jsonb),
			'per_metodo', coalesce((
				select jsonb_agg(jsonb_build_object('metodo', metodo, 'n', n, 'importo', importo) order by importo desc)
				from scaduti_metodo
			), '[]'::jsonb),
			'storico', coalesce((
				select jsonb_agg(jsonb_build_object('anni_fa', anni_fa, 'giorno', giorno, 'n', n, 'importo', importo) order by anni_fa)
				from scaduti_storici
			), '[]'::jsonb),
			'debitori', coalesce((
				select jsonb_agg(jsonb_build_object(
					'nome', nome, 'cognome', cognome, 'importo', importo, 'rate', rate, 'piu_vecchia', piu_vecchia
				) order by importo desc)
				from debitori
			), '[]'::jsonb)
		)
	);
$$;

revoke execute on function public.dashboard_finanza(integer) from public, anon, authenticated;
grant execute on function public.dashboard_finanza(integer) to service_role;

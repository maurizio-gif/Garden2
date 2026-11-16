-- L'id della persona in tutti gli elenchi con un nome, così nel pannello ogni
-- nominativo porta alla sua scheda (/contatti/<id>).
--
-- Le funzioni non si riscrivono per intero: si prende la definizione
-- installata, si sostituiscono solo i pezzi qui sotto e la si ricrea. Se un
-- pezzo non c'è (definizione cambiata nel frattempo) la migrazione si ferma.

do $migrazione$
declare
	m record;
	def text;
	nuova text;
begin
	for m in
		select * from (values
			('public.dashboard_home()',
				'select a.data_vendita, a.abbonamento, a.categoria, a.totale, p.nome, p.cognome',
				'select a.data_vendita, a.abbonamento, a.categoria, a.totale, a.persona_id, p.nome, p.cognome'),
			('public.dashboard_home()',
				'''quando'', data_vendita, ''nome'', nome,',
				'''quando'', data_vendita, ''persona_id'', persona_id, ''nome'', nome,'),
			('public.dashboard_abbonamenti_recenti(integer)',
				'a.totale, p.nome, p.cognome',
				'a.totale, a.persona_id, p.nome, p.cognome'),
			('public.dashboard_abbonamenti_recenti(integer)',
				'''nome'', nome, ''cognome'', cognome,',
				'''persona_id'', persona_id, ''nome'', nome, ''cognome'', cognome,'),
			('public.dashboard_accessi_recenti(integer)',
				'''quando'', u.data_accesso, ''nome'', p.nome',
				'''quando'', u.data_accesso, ''persona_id'', p.id, ''nome'', p.nome'),
			('public.dashboard_analisi_righe(jsonb, integer, integer, text)',
				'''nome'', p.nome, ''cognome'', p.cognome,',
				'''persona_id'', p.persona_id, ''nome'', p.nome, ''cognome'', p.cognome,'),
			('public.dashboard_finanza(integer)',
				'select pe.nome, pe.cognome, round(sum(ra.importo)) as importo',
				'select pe.id as persona_id, pe.nome, pe.cognome, round(sum(ra.importo)) as importo'),
			('public.dashboard_finanza(integer)',
				'''nome'', nome, ''cognome'', cognome, ''importo'', importo, ''rate'', rate',
				'''persona_id'', persona_id, ''nome'', nome, ''cognome'', cognome, ''importo'', importo, ''rate'', rate'),
			('public.dashboard_scadenze_elenco(jsonb, integer, integer, text)',
				'to_jsonb(x) - ''persona_id'' - ''id''',
				'to_jsonb(x) - ''id'''),
			('public.dashboard_incassi_righe(jsonb, integer, integer, text)',
				'to_jsonb(x) - ''persona_id'' - ''giorno''',
				'to_jsonb(x) - ''giorno'''),
			('public.dashboard_accessi(date, date)',
				'''nome'', p.nome, ''cognome'', p.cognome, ''presenze'', t.presenze',
				'''persona_id'', p.id, ''nome'', p.nome, ''cognome'', p.cognome, ''presenze'', t.presenze')
		) as v(funzione, vecchio, nuovo)
	loop
		def := pg_get_functiondef(m.funzione::regprocedure);
		if position(m.nuovo in def) > 0 then
			continue; -- già fatto (migrazione rieseguita)
		end if;
		if position(m.vecchio in def) = 0 then
			raise exception 'In % non trovo: %', m.funzione, m.vecchio;
		end if;
		nuova := replace(def, m.vecchio, m.nuovo);
		execute nuova;
	end loop;
end
$migrazione$;

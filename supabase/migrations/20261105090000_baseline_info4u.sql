-- Garden: schema di base per i dati di Info4U (dbgym), copiato dalla parte
-- «Info4U» del database di Ronchiverdi. Restano fuori tutto ciò che è del
-- sito, dello staff e del CRM di Ronchiverdi (form_contatti, sessioni, ticket,
-- email SendGrid, voucher, personal training, tesseramento CSI...).
--
-- Tutte le tabelle hanno RLS attiva e nessuna policy: ci scrive e legge solo
-- la service_role (lo script di sync e, più avanti, il backend).
--
-- Le tabelle con chiave `source_*` rispecchiano un ID di Info4U; `id` uuid è
-- la chiave interna. Gli upsert del sync usano `on_conflict=source_*`.

-- ───────────────────────────────────────────────────────────── funzioni

create or replace function public.normalizza_nome_persona(p_testo text)
returns text
language sql
immutable
set search_path to 'public'
as $$
	select nullif(regexp_replace(lower(btrim(coalesce(p_testo, ''))), '\s+', ' ', 'g'), '');
$$;

create or replace function public.normalizza_cellulare(p_numero text)
returns text
language plpgsql
immutable
set search_path to 'public'
as $$
declare
	v_cifre text;
begin
	if p_numero is null then return null; end if;

	v_cifre := regexp_replace(p_numero, '[^0-9]', '', 'g');

	if length(v_cifre) > 11 and left(v_cifre, 4) = '0039' then
		v_cifre := substr(v_cifre, 5);
	elsif length(v_cifre) > 10 and left(v_cifre, 2) = '39' then
		v_cifre := substr(v_cifre, 3);
	end if;

	if length(v_cifre) < 8 then return null; end if;

	return right(v_cifre, 10);
end;
$$;

-- ───────────────────────────────────────────────────────────── persone

-- Anagrafica: una riga per IDUtente di Info4U. A Garden non ci sono altre
-- fonti (niente form del sito), quindi non serve la deduplicazione di
-- Ronchiverdi: due utenti Info4U diversi restano due persone.
create table public.persone (
	id uuid primary key default gen_random_uuid(),
	creato_il timestamptz not null default now(),
	aggiornato_il timestamptz not null default now(),
	nome text,
	cognome text,
	email text,
	cellulare text,
	cellulare_norm text,
	note text,
	fonte text,
	storico boolean not null default false,
	source_utente_id integer,
	codice_fiscale text,
	data_nascita date,
	sesso text,
	telefono_1 text,
	telefono_2 text,
	indirizzo_via text,
	indirizzo_civico text,
	indirizzo_cap text,
	indirizzo_citta text,
	indirizzo_provincia text,
	indirizzo_stato text,
	conflitto_con_persona_id uuid references public.persone(id) on delete set null,
	conflitto_campo text check (conflitto_campo in ('email', 'cellulare', 'nome_cognome', 'possibile_doppione')),
	luogo_nascita text,
	provincia_nascita text,
	stato_nascita text,
	constraint persone_source_utente_id_key unique (source_utente_id)
);
comment on table public.persone is 'Anagrafica Garden: una riga per utente di Info4U (source_utente_id). Scritta dal sync tramite trova_o_crea_persona.';

create index persone_cellulare_lookup_idx on public.persone (cellulare_norm) where cellulare_norm is not null;
create index persone_cognome_idx on public.persone (cognome, nome);
create index persone_conflitto_con_idx on public.persone (conflitto_con_persona_id) where conflitto_con_persona_id is not null;
create index persone_email_lookup_idx on public.persone (email) where email is not null;
create index persone_fonte_idx on public.persone (fonte) where fonte is not null;
create index persone_nome_cognome_norm_idx on public.persone (normalizza_nome_persona(nome), normalizza_nome_persona(cognome));

-- Stessa firma di Ronchiverdi, così lo script di sync non cambia. Qui basta
-- trovare la scheda per source_utente_id o crearla: non c'è nessun'altra fonte
-- con cui fondere.
create or replace function public.trova_o_crea_persona(
	p_nome text,
	p_cognome text,
	p_email text,
	p_cellulare text,
	p_fonte text default 'info4u',
	p_source_utente_id integer default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
	v_id uuid;
	v_nome text := nullif(btrim(coalesce(p_nome, '')), '');
	v_cognome text := nullif(btrim(coalesce(p_cognome, '')), '');
	v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
	v_norm text := normalizza_cellulare(p_cellulare);
begin
	if v_nome is null then
		return null;
	end if;

	if p_source_utente_id is not null then
		select id into v_id from persone where source_utente_id = p_source_utente_id limit 1;
	end if;

	if v_id is null then
		insert into persone (nome, cognome, email, cellulare, cellulare_norm, fonte, source_utente_id)
		values (v_nome, v_cognome, v_email, p_cellulare, v_norm, p_fonte, p_source_utente_id)
		returning id into v_id;
		return v_id;
	end if;

	update persone set
		nome = coalesce(nome, v_nome),
		cognome = coalesce(cognome, v_cognome),
		email = coalesce(email, v_email),
		cellulare = coalesce(cellulare, p_cellulare),
		cellulare_norm = coalesce(cellulare_norm, v_norm),
		fonte = coalesce(fonte, p_fonte),
		aggiornato_il = now()
	where id = v_id;

	return v_id;
end;
$$;

-- ───────────────────────────────────────────────────────────── vendite

create table public.abbonamenti (
	id uuid primary key default gen_random_uuid(),
	source_iscrizione_id integer not null,
	persona_id uuid references public.persone(id),
	source_utente_id integer,
	source_durata_id integer,
	source_abbonamento_id integer,
	abbonamento text,
	variante text,
	durata integer,
	periodo text,
	data_vendita timestamptz,
	data_inizio date,
	data_fine date,
	totale numeric,
	importo_listino numeric,
	importo_categoria numeric,
	importo_configurato numeric,
	operatore_id integer,
	operatore_nome text,
	venditore_id integer,
	club_id integer,
	bloccato boolean,
	convertito boolean,
	rinnovo_automatico boolean,
	data_disdetta date,
	motivo_disdetta text,
	sconto_id integer,
	sconto_durata_id integer,
	gg_omaggio integer,
	gg_festivi integer,
	gg_sospensione integer,
	data_inizio_sospensione date,
	data_fine_sospensione date,
	note text,
	sincronizzato_il timestamptz not null default now(),
	cancellato_il timestamptz,
	venditore_nome text,
	categoria text,
	constraint abbonamenti_source_iscrizione_id_key unique (source_iscrizione_id)
);
comment on table public.abbonamenti is 'Una riga per vendita di Info4U (AbbonamentiIscrizione), dal 1 gennaio 2016. cancellato_il = la vendita non esiste più in Info4U.';

create index abbonamenti_cancellato_il_idx on public.abbonamenti (cancellato_il) where cancellato_il is not null;
create index abbonamenti_data_fine_idx on public.abbonamenti (data_fine) where data_fine is not null and cancellato_il is null;
create index abbonamenti_giorno_vendita_idx on public.abbonamenti (((data_vendita at time zone 'UTC')::date)) where cancellato_il is null;
create index abbonamenti_mese_fine_idx on public.abbonamenti ((date_trunc('month', data_fine::timestamp)::date)) where cancellato_il is null and data_fine is not null;
create index abbonamenti_mese_vendita_idx on public.abbonamenti ((date_trunc('month', data_vendita at time zone 'UTC')::date)) where cancellato_il is null;
create index abbonamenti_persona_data_fine_idx on public.abbonamenti (persona_id, data_fine) where cancellato_il is null;
create index abbonamenti_persona_data_inizio_idx on public.abbonamenti (persona_id, data_inizio) where cancellato_il is null;
create index abbonamenti_persona_id_idx on public.abbonamenti (persona_id);
create index abbonamenti_prodotto_vendita_idx on public.abbonamenti (abbonamento, data_vendita desc) where abbonamento is not null;
create index abbonamenti_source_abbonamento_idx on public.abbonamenti (source_abbonamento_id);
create index abbonamenti_source_utente_id_idx on public.abbonamenti (source_utente_id);

create table public.abbonamenti_modifiche (
	id uuid primary key default gen_random_uuid(),
	source_log_id integer not null,
	data_operazione timestamptz not null,
	operatore_id integer,
	operatore_nome text,
	source_utente_id integer,
	persona_id uuid references public.persone(id),
	source_iscrizione_id integer,
	inizio_precedente date,
	fine_precedente date,
	inizio_nuovo date,
	fine_nuova date,
	proroga_giorni integer,
	descrizione text,
	interpretata boolean not null default false,
	sincronizzato_il timestamptz not null default now(),
	constraint abbonamenti_modifiche_source_log_id_key unique (source_log_id)
);
create index abbonamenti_modifiche_data_idx on public.abbonamenti_modifiche (data_operazione desc);
create index abbonamenti_modifiche_iscrizione_idx on public.abbonamenti_modifiche (source_iscrizione_id);
create index abbonamenti_modifiche_operatore_idx on public.abbonamenti_modifiche (operatore_nome);

create table public.abbonamenti_rate (
	id uuid primary key default gen_random_uuid(),
	source_rata_id integer not null,
	source_iscrizione_id integer,
	source_movimento_id integer,
	data_rata date,
	importo numeric,
	data_pagato timestamptz,
	source_tipo_pagamento_id integer,
	metodo_pagamento text,
	operatore_id integer,
	operatore_nome text,
	transazione_errore text,
	transazione_data timestamptz,
	cancellato_il timestamptz,
	sincronizzato_il timestamptz not null default now(),
	constraint abbonamenti_rate_source_rata_id_key unique (source_rata_id)
);
create index abbonamenti_rate_cancellato_il_idx on public.abbonamenti_rate (cancellato_il) where cancellato_il is not null;
create index abbonamenti_rate_data_rata_idx on public.abbonamenti_rate (data_rata);
create index abbonamenti_rate_iscrizione_idx on public.abbonamenti_rate (source_iscrizione_id);
create index abbonamenti_rate_movimento_idx on public.abbonamenti_rate (source_movimento_id) where source_movimento_id is not null;

create table public.abbonamenti_sospensioni (
	id uuid primary key default gen_random_uuid(),
	source_sospensione_id integer not null,
	source_iscrizione_id integer,
	data_inizio date,
	data_fine date,
	giorni_netti integer,
	causale text,
	source_causale_id integer,
	causale_descrizione text,
	operatore_nome text,
	inserita_il timestamptz,
	cancellato_il timestamptz,
	sincronizzato_il timestamptz not null default now(),
	constraint abbonamenti_sospensioni_source_sospensione_id_key unique (source_sospensione_id)
);
comment on table public.abbonamenti_sospensioni is 'Sospensioni di Info4U (AbbonamentiSospensioni), legate alla vendita. A Garden è una tabella viva (~2.300 l''anno).';
create index abbonamenti_sospensioni_cancellato_il_idx on public.abbonamenti_sospensioni (cancellato_il) where cancellato_il is not null;
create index abbonamenti_sospensioni_inizio_idx on public.abbonamenti_sospensioni (data_inizio);
create index abbonamenti_sospensioni_iscrizione_idx on public.abbonamenti_sospensioni (source_iscrizione_id);

create table public.transazioni (
	id uuid primary key default gen_random_uuid(),
	source_movimento_id integer not null,
	persona_id uuid references public.persone(id),
	source_utente_id integer,
	source_iscrizione_id integer,
	source_servizio_id integer,
	tipo_servizio text,
	descrizione_servizio text,
	causale text,
	data_operazione timestamptz,
	importo numeric,
	source_tipo_pagamento_id integer,
	metodo_pagamento text,
	movimenta_cassa boolean,
	source_movimento_storno_id integer,
	operatore_id integer,
	operatore_nome text,
	cassetto text,
	cancellato_il timestamptz,
	sincronizzato_il timestamptz not null default now(),
	constraint transazioni_source_movimento_id_key unique (source_movimento_id)
);
create index transazioni_cancellato_il_idx on public.transazioni (cancellato_il) where cancellato_il is not null;
create index transazioni_data_operazione_idx on public.transazioni (data_operazione);
create index transazioni_persona_id_idx on public.transazioni (persona_id);
create index transazioni_source_iscrizione_id_idx on public.transazioni (source_iscrizione_id);
create index transazioni_source_utente_id_idx on public.transazioni (source_utente_id);

-- ───────────────────────────────────────────────────────── stato del sync

create table public.sync_info4u_stato (
	chiave text primary key,
	valore timestamptz not null,
	aggiornato_il timestamptz not null default now(),
	cursore bigint
);
comment on table public.sync_info4u_stato is 'Stato della sincronizzazione Info4U → Supabase che non è derivabile con un MAX() sulle tabelle: ultimo giro di refresh per ogni ambito e relativo cursore.';

-- ────────────────────────────────────────────────── anagrafiche di servizio

create table public.crm_tipi_azione (
	source_tipo_id integer primary key,
	descrizione text,
	attivo boolean,
	sincronizzato_il timestamptz not null default now()
);

create table public.crm_esiti_azione (
	source_esito_id integer primary key,
	descrizione text,
	attivo boolean,
	sincronizzato_il timestamptz not null default now()
);

create table public.crm_stati_commerciali (
	source_stato_id integer primary key,
	nome text,
	attivo boolean,
	sincronizzato_il timestamptz not null default now()
);

create table public.operatori_categorie_info4u (
	source_categoria_id integer primary key,
	descrizione text,
	sincronizzato_il timestamptz not null default now()
);

create table public.operatori_info4u (
	source_operatore_id integer primary key,
	nome text,
	source_categoria_id integer,
	attivo boolean,
	venditore boolean,
	istruttore boolean,
	eliminato boolean,
	sincronizzato_il timestamptz not null default now()
);

create table public.prenotazioni_catalogo (
	source_prenotazione_id integer primary key,
	source_categoria_id integer,
	descrizione text,
	attivo boolean,
	costo numeric,
	max_prenotazioni integer,
	durata_minuti integer,
	data_inizio timestamptz,
	data_fine timestamptz,
	sincronizzato_il timestamptz not null default now()
);

create table public.prenotazioni_lezioni (
	source_lezione_id integer primary key,
	source_prenotazione_id integer,
	data_inizio timestamptz,
	data_fine timestamptz,
	ora_inizio text,
	ora_fine text,
	giorni_settimana integer,
	source_istruttore_id integer,
	sincronizzato_il timestamptz not null default now()
);

create table public.esiti_accesso (
	numero_esito integer primary key,
	descrizione text,
	sincronizzato_il timestamptz not null default now()
);
comment on table public.esiti_accesso is 'Codici di accesso ai tornelli: TipoAccesso positivo = entrato, negativo = respinto (descrizione qui).';

create table public.terminali_info4u (
	id uuid primary key default gen_random_uuid(),
	source_terminale_id integer not null,
	indirizzo integer not null,
	source_concentratore_id integer not null,
	descrizione text,
	attivo boolean,
	ingresso boolean,
	uscita boolean,
	direzione text,
	zona_nr integer,
	zona_verso text,
	sincronizzato_il timestamptz not null default now(),
	constraint terminali_info4u_source_terminale_id_indirizzo_source_conce_key
		unique (source_terminale_id, indirizzo, source_concentratore_id)
);

-- ──────────────────────────────────────────────────────── CRM di Info4U

create table public.crm_pratiche (
	id uuid primary key default gen_random_uuid(),
	source_pratica_id integer not null,
	source_categoria_id integer,
	descrizione text,
	source_utente_id integer,
	persona_id uuid references public.persone(id),
	data_creazione timestamptz,
	source_stato_id integer,
	data_stato timestamptz,
	data_chiusura timestamptz,
	valore double precision,
	sincronizzato_il timestamptz not null default now(),
	constraint crm_pratiche_source_pratica_id_key unique (source_pratica_id)
);
create index crm_pratiche_creazione_idx on public.crm_pratiche (data_creazione desc);
create index crm_pratiche_persona_idx on public.crm_pratiche (persona_id);
create index crm_pratiche_utente_idx on public.crm_pratiche (source_utente_id);

create table public.crm_azioni (
	id uuid primary key default gen_random_uuid(),
	source_azione_id integer not null,
	source_pratica_id integer,
	operatore_autore_id integer,
	operatore_dest_id integer,
	data_appuntamento timestamptz,
	source_tipo_id integer,
	source_esito_id integer,
	descrizione text,
	data_evasione timestamptz,
	source_stato_id integer,
	data_presa_in_carico timestamptz,
	sincronizzato_il timestamptz not null default now(),
	constraint crm_azioni_source_azione_id_key unique (source_azione_id)
);
create index crm_azioni_autore_idx on public.crm_azioni (operatore_autore_id, data_appuntamento desc);
create index crm_azioni_data_idx on public.crm_azioni (data_appuntamento desc);
create index crm_azioni_pratica_idx on public.crm_azioni (source_pratica_id);
create index crm_azioni_tipo_idx on public.crm_azioni (source_tipo_id, source_esito_id);

create table public.crm_memo (
	id uuid primary key default gen_random_uuid(),
	source_memo_id integer not null,
	source_utente_id integer,
	persona_id uuid references public.persone(id),
	operatore_id integer,
	oggetto text,
	descrizione text,
	ultima_modifica timestamptz,
	data_operazione timestamptz,
	sincronizzato_il timestamptz not null default now(),
	constraint crm_memo_source_memo_id_key unique (source_memo_id)
);
comment on table public.crm_memo is 'Memo di Info4U: testo libero degli operatori, può contenere dati personali e di salute. Non esporlo oltre il necessario.';
create index crm_memo_utente_idx on public.crm_memo (source_utente_id);

create table public.email_info4u (
	id uuid primary key default gen_random_uuid(),
	source_email_id integer not null,
	source_utente_id integer,
	persona_id uuid references public.persone(id),
	operatore_id integer,
	data_creazione timestamptz,
	oggetto text,
	stato smallint,
	tipo smallint,
	data_invio timestamptz,
	errore text,
	mittente_nome text,
	sincronizzato_il timestamptz not null default now(),
	constraint email_info4u_source_email_id_key unique (source_email_id)
);
create index email_info4u_data_idx on public.email_info4u (data_creazione desc);
create index email_info4u_utente_idx on public.email_info4u (source_utente_id, data_creazione desc);

-- ───────────────────────────────────────── certificati, quote, prenotazioni

create table public.certificati (
	id uuid primary key default gen_random_uuid(),
	source_certificato_id integer not null,
	source_utente_id integer,
	persona_id uuid references public.persone(id),
	descrizione text,
	data_emissione date,
	data_scadenza date,
	sincronizzato_il timestamptz not null default now(),
	constraint certificati_source_certificato_id_key unique (source_certificato_id)
);
create index certificati_persona_idx on public.certificati (persona_id, data_scadenza desc);
create index certificati_scadenza_idx on public.certificati (data_scadenza);
create index certificati_utente_idx on public.certificati (source_utente_id, data_scadenza desc);

create table public.quote_associative (
	id uuid primary key default gen_random_uuid(),
	source_quota_id integer not null,
	source_utente_id integer,
	persona_id uuid references public.persone(id),
	data_inizio date,
	data_fine date,
	importo numeric,
	source_iscrizione_id integer,
	sincronizzato_il timestamptz not null default now(),
	constraint quote_associative_source_quota_id_key unique (source_quota_id)
);
create index quote_associative_utente_idx on public.quote_associative (source_utente_id, data_fine desc);

create table public.prenotazioni_iscrizioni (
	id uuid primary key default gen_random_uuid(),
	source_piscrizione_id integer not null,
	source_utente_id integer,
	persona_id uuid references public.persone(id),
	source_prenotazione_id integer,
	operatore_id integer,
	operatore_nome text,
	data_inizio timestamptz,
	data_fine timestamptz,
	totale numeric,
	data_operazione timestamptz,
	source_lezione_id integer,
	origine_tipo text,
	origine_id integer,
	sincronizzato_il timestamptz not null default now(),
	constraint prenotazioni_iscrizioni_source_piscrizione_id_key unique (source_piscrizione_id)
);
create index prenotazioni_iscrizioni_prenotazione_idx on public.prenotazioni_iscrizioni (source_prenotazione_id, data_inizio desc);
create index prenotazioni_iscrizioni_utente_idx on public.prenotazioni_iscrizioni (source_utente_id, data_inizio desc);

create table public.corsi_iscrizioni (
	id uuid primary key default gen_random_uuid(),
	source_iscrizione_corso_id integer not null,
	source_utente_id integer,
	persona_id uuid references public.persone(id),
	source_corso_id integer,
	source_iscrizione_id integer,
	operatore_id integer,
	data_inizio timestamptz,
	data_fine timestamptz,
	importo numeric,
	data_operazione timestamptz,
	terminato boolean,
	nr_lezioni integer,
	posti_occupati integer,
	source_piscrizione_id integer,
	sincronizzato_il timestamptz not null default now(),
	constraint corsi_iscrizioni_source_iscrizione_corso_id_key unique (source_iscrizione_corso_id)
);
create index corsi_iscrizioni_iscrizione_idx on public.corsi_iscrizioni (source_iscrizione_id);
create index corsi_iscrizioni_utente_idx on public.corsi_iscrizioni (source_utente_id, data_inizio desc);

create table public.omaggi_iscrizioni (
	id uuid primary key default gen_random_uuid(),
	source_omaggio_iscrizione_id integer not null,
	source_utente_id integer,
	persona_id uuid references public.persone(id),
	source_omaggio_id integer,
	source_iscrizione_id integer,
	data_inizio date,
	data_fine date,
	omaggi_totali integer,
	omaggi_usati integer,
	source_club_id integer,
	sincronizzato_il timestamptz not null default now(),
	constraint omaggi_iscrizioni_source_omaggio_iscrizione_id_key unique (source_omaggio_iscrizione_id)
);
create index omaggi_iscrizioni_utente_idx on public.omaggi_iscrizioni (source_utente_id, data_fine desc);

-- ─────────────────────────────────────────────────────────────── ricevute

create table public.ricevute (
	id uuid primary key default gen_random_uuid(),
	source_ricevuta_id integer not null,
	azienda_id integer,
	numero integer,
	tipo text,
	data_ricevuta date,
	annullata boolean,
	tipo_pagamento text,
	source_utente_id integer,
	persona_id uuid references public.persone(id),
	acconto boolean,
	operatore_id integer,
	bloccata boolean,
	data_saldo timestamptz,
	tipo_pagamento_saldo text,
	fe_stato smallint,
	fe_data_elaborazione timestamptz,
	fe_data_scarto_sdi timestamptz,
	rt_nr_scontrino text,
	rt_data_scontrino timestamptz,
	rt_data_annullo timestamptz,
	data_ora_ricevuta timestamptz,
	inviata_email boolean,
	sincronizzato_il timestamptz not null default now(),
	constraint ricevute_source_ricevuta_id_key unique (source_ricevuta_id)
);
create index ricevute_data_idx on public.ricevute (data_ricevuta desc);
create index ricevute_utente_idx on public.ricevute (source_utente_id, data_ricevuta desc);

create table public.ricevute_righe (
	id uuid primary key default gen_random_uuid(),
	source_riga_id integer not null,
	source_ricevuta_id integer not null,
	qta double precision,
	descrizione text,
	prezzo_unitario numeric,
	iva double precision,
	source_movimento_id integer,
	tipo smallint,
	centro_ricavo_id integer,
	iva_descrizione text,
	sincronizzato_il timestamptz not null default now(),
	constraint ricevute_righe_source_riga_id_key unique (source_riga_id)
);
create index ricevute_righe_movimento_idx on public.ricevute_righe (source_movimento_id);
create index ricevute_righe_ricevuta_idx on public.ricevute_righe (source_ricevuta_id);

-- ─────────────────────────────────────────────────────────────── accessi

create table public.accessi (
	source_accesso_id integer primary key,
	origine text not null,
	source_utente_id integer,
	source_terminale_id integer,
	indirizzo integer,
	source_concentratore_id integer,
	source_servizio_id integer,
	data_accesso timestamptz,
	tipo_servizio text,
	tipo_accesso integer,
	source_iscrizione_id integer,
	tipo_servizio_iscrizione text,
	source_automazione_id integer
);
comment on table public.accessi is 'Passaggi ai tornelli (dbo.Accessi). origine S = storico, A = archivio corrente. NomeUtente e Descrizione di Info4U non si copiano.';
create index accessi_data_idx on public.accessi (data_accesso desc);
create index accessi_origine_idx on public.accessi (origine, source_accesso_id desc);
create index accessi_utente_idx on public.accessi (source_utente_id, data_accesso desc);

-- ───────────────────────────────────────────── funzioni usate dal sync

-- Se Info4U cambia nome o categoria a un prodotto, lo allinea su tutte le sue
-- vendite. (A Ronchiverdi sposta anche la mappatura sui gruppi di report:
-- a Garden non c'è ancora.)
create or replace function public.allinea_catalogo_info4u(p_catalogo jsonb)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
	v_prodotto record;
	v_righe integer;
	v_totale integer := 0;
begin
	for v_prodotto in
		select (x->>'id')::int as id, nullif(trim(x->>'nome'), '') as nome, nullif(trim(x->>'categoria'), '') as categoria
		from jsonb_array_elements(p_catalogo) x
	loop
		continue when v_prodotto.id is null or v_prodotto.nome is null;

		update public.abbonamenti a
		set abbonamento = v_prodotto.nome,
			categoria = v_prodotto.categoria
		where a.source_abbonamento_id = v_prodotto.id
			and (a.abbonamento is distinct from v_prodotto.nome
				or a.categoria is distinct from v_prodotto.categoria);
		get diagnostics v_righe = row_count;
		v_totale := v_totale + v_righe;
	end loop;
	return v_totale;
end;
$$;

-- Utenti Info4U il cui source_utente_id sulle righe collegate non coincide con
-- quello della scheda a cui puntano (succede dopo una fusione di anagrafiche).
create or replace function public.info4u_utenti_senza_scheda()
returns table(source_utente_id integer, persona_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
	with righe as (
		select x.persona_id, x.source_utente_id from public.abbonamenti x
		union select x.persona_id, x.source_utente_id from public.abbonamenti_modifiche x
		union select x.persona_id, x.source_utente_id from public.transazioni x
		union select x.persona_id, x.source_utente_id from public.crm_pratiche x
		union select x.persona_id, x.source_utente_id from public.crm_memo x
		union select x.persona_id, x.source_utente_id from public.email_info4u x
		union select x.persona_id, x.source_utente_id from public.certificati x
		union select x.persona_id, x.source_utente_id from public.quote_associative x
		union select x.persona_id, x.source_utente_id from public.prenotazioni_iscrizioni x
		union select x.persona_id, x.source_utente_id from public.corsi_iscrizioni x
		union select x.persona_id, x.source_utente_id from public.omaggi_iscrizioni x
		union select x.persona_id, x.source_utente_id from public.ricevute x
	)
	select distinct on (r.source_utente_id) r.source_utente_id::integer, r.persona_id
	from righe r
	join public.persone p on p.id = r.persona_id
	where r.source_utente_id is not null
		and p.source_utente_id is not null
		and p.source_utente_id <> r.source_utente_id
		and not exists (select 1 from public.persone q where q.source_utente_id = r.source_utente_id)
	order by r.source_utente_id, r.persona_id;
$$;

-- ───────────────────────────────────────────────────── sicurezza (RLS)

alter table public.persone enable row level security;
alter table public.abbonamenti enable row level security;
alter table public.abbonamenti_modifiche enable row level security;
alter table public.abbonamenti_rate enable row level security;
alter table public.abbonamenti_sospensioni enable row level security;
alter table public.transazioni enable row level security;
alter table public.sync_info4u_stato enable row level security;
alter table public.crm_tipi_azione enable row level security;
alter table public.crm_esiti_azione enable row level security;
alter table public.crm_stati_commerciali enable row level security;
alter table public.operatori_categorie_info4u enable row level security;
alter table public.operatori_info4u enable row level security;
alter table public.prenotazioni_catalogo enable row level security;
alter table public.prenotazioni_lezioni enable row level security;
alter table public.esiti_accesso enable row level security;
alter table public.terminali_info4u enable row level security;
alter table public.crm_pratiche enable row level security;
alter table public.crm_azioni enable row level security;
alter table public.crm_memo enable row level security;
alter table public.email_info4u enable row level security;
alter table public.certificati enable row level security;
alter table public.quote_associative enable row level security;
alter table public.prenotazioni_iscrizioni enable row level security;
alter table public.corsi_iscrizioni enable row level security;
alter table public.omaggi_iscrizioni enable row level security;
alter table public.ricevute enable row level security;
alter table public.ricevute_righe enable row level security;
alter table public.accessi enable row level security;

-- Le funzioni le chiama solo il sync con la service_role.
revoke execute on function public.trova_o_crea_persona(text, text, text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.allinea_catalogo_info4u(jsonb) from public, anon, authenticated;
revoke execute on function public.info4u_utenti_senza_scheda() from public, anon, authenticated;

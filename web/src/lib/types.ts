// Forma dei JSON restituiti dalle funzioni SQL in
// supabase/migrations/20261107120000_dashboard_rpc.sql

export type Vendita = {
	quando: string;
	/** Scheda della persona (/contatti/<id>); null se la vendita non ha una persona. */
	persona_id?: string | null;
	nome: string | null;
	cognome: string | null;
	abbonamento: string | null;
	categoria: string | null;
	totale: number | null;
};

export type Home = {
	/** Giorno (Europe/Rome) in cui sono stati calcolati i numeri, AAAA-MM-GG. */
	oggi: string;
	/** Ultimo giro del sync delle transazioni; null se non è mai girato. */
	aggiornato_al: string | null;
	attivi: number;
	in_scadenza_30g: number;
	rate_scadute_90g: { n: number; importo: number };
	incassi_mese: { corrente: number; precedente_stesso_periodo: number };
	/** Dodici mesi, dal più vecchio al mese in corso (incompleto). */
	incassi_mesi: { mese: string; incassi: number }[];
	/** Persone con almeno un prodotto attivo, per categoria, dalla più grande. */
	categorie: { categoria: string; persone: number }[];
	ultime_vendite: Vendita[];
};

export type AbbonamentiRecenti = {
	aggiornato_al: string | null;
	abbonamenti: (Vendita & { inizio: string | null; fine: string | null })[];
};

export type AccessiRecenti = {
	ultimo_accesso: string | null;
	accessi: {
		quando: string;
		persona_id?: string | null;
		nome: string | null;
		cognome: string | null;
		servizio: string | null;
	}[];
};

// ── Analisi e confronto con gli anni scorsi
// (supabase/migrations/20261112090000_dashboard_analisi.sql)

export type RigaAnalisi = { chiave: string; vendite: number; persone: number; fatturato: number };

export type Analisi = {
	totali: { vendite: number; persone: number; fatturato: number };
	righe: RigaAnalisi[];
	/** Più di 400 gruppi: le righe sono le prime 400. */
	troncato: boolean;
};

export type VenditaDettaglio = {
	vendita: string | null;
	persona_id?: string | null;
	inizio: string | null;
	fine: string | null;
	nome: string | null;
	cognome: string | null;
	abbonamento: string | null;
	categoria: string | null;
	gruppo: string | null;
	durata: string | null;
	operatore: string | null;
	totale: number | null;
};

export type ElencoVendite = { totale: number; righe: VenditaDettaglio[] };

export type Opzioni = {
	gruppi: string[];
	categorie: { categoria: string; gruppo: string }[];
	operatori: string[];
	prima_vendita: string | null;
};

export type ConfrontoAnni = {
	oggi: string;
	aggiornato_al: string | null;
	/** Una riga per anno e gruppo; `gruppo: null` è il totale (persone diverse). */
	iscritti: { anni_fa: number; giorno: string; gruppo: string | null; persone: number }[];
	/** Dal 1 gennaio allo stesso giorno di ogni anno; `gruppo: null` è il totale. */
	ytd: { anni_fa: number; gruppo: string | null; vendite: number; persone: number; fatturato: number }[];
	anni: { anni_fa: number; giorno: string; inizio: string }[];
	mensile: { anno: number; mese: number; vendite: number; fatturato: number }[];
	/** Ultimi 24 mesi, dal più vecchio; l'ultimo è parziale. */
	movimento: { mese: string; nuovi: number; rientri: number; usciti: number; attivi: number }[];
};

export type Vista = { id: string; nome: string; query: string; creato_il: string };

// ── Finanza (supabase/migrations/20261113090000_dashboard_finanza.sql)

export type PeriodoFin = "mtd" | "ytd";

export type Finanza = {
	oggi: string;
	aggiornato_al: string | null;
	/** Gli intervalli di date di ogni periodo e anno (MTD = da inizio mese, YTD = da inizio anno). */
	periodi: { periodo: PeriodoFin; anni_fa: number; da: string; a: string }[];
	/** `gruppo: null` è il totale. Comprende le quote associative. */
	venduto: { periodo: PeriodoFin; anni_fa: number; gruppo: string | null; vendite: number; fatturato: number }[];
	incassato_tipologia: {
		periodo: PeriodoFin;
		anni_fa: number;
		tipologia: string;
		/** Pagamento di un abbonamento (e non ingressi singoli, agenda, cauzioni…). */
		da_abbonamento: boolean;
		importo: number;
		n: number;
	}[];
	incassato_metodo: { periodo: PeriodoFin; anni_fa: number; metodo: string; importo: number; n: number }[];
	/** Mese per mese, dall'inizio di quattro anni fa a oggi. */
	mesi: { anno: number; mese: number; venduto: number; incassato: number; incassato_abbonamenti: number }[];
	crediti: {
		/** s1…s5 = scaduto da 1-30, 31-90, 91-180, 181-365, oltre 365 giorni; f1…f3 = in scadenza entro 30, 31-90, oltre 90 giorni. */
		fasce: Record<string, { n: number; importo: number }>;
		per_gruppo: { gruppo: string; n: number; importo: number }[];
		per_metodo: { metodo: string; n: number; importo: number }[];
		/** Credito scaduto da meno di 90 giorni nello stesso giorno degli anni scorsi. */
		storico: { anni_fa: number; giorno: string; n: number; importo: number }[];
		debitori: { persona_id?: string | null; nome: string | null; cognome: string | null; importo: number; rate: number; piu_vecchia: string }[];
	};
};

// ── Direzionale, scadenze e rinnovi, incassi
// (supabase/migrations/20261116090000_dashboard_direzionale.sql)

export type MeseDirezionale = {
	/** Primo giorno del mese, AAAA-MM-GG. */
	mese: string;
	incassato: number;
	incassato_abbonamenti: number;
	vendite: number;
	venduto: number;
	vendite_rinnovi: number;
	venduto_rinnovi: number;
	/** Persone iscritte a fine mese (oggi per il mese in corso). */
	iscritti: number;
};

export type Valorizzazione = {
	/** null = totale. */
	gruppo: string | null;
	prodotti: number;
	persone: number;
	/** Somma del prezzo dei prodotti attivi oggi. */
	valore: number;
	/** Parte non ancora goduta (rateo sui giorni che mancano). */
	residuo: number;
	/** Valore spalmato su un mese. */
	mensile: number;
};

export type Direzionale = {
	oggi: string;
	aggiornato_al: string | null;
	/** 36 mesi, dal più vecchio al mese in corso (incompleto). */
	mesi: MeseDirezionale[];
	iscritti: { quando: "oggi" | "mese_fa" | "anno_fa"; giorno: string; persone: number }[];
	valorizzazione: Valorizzazione[];
	periodi: {
		periodo: "mtd" | "ytd";
		anni_fa: number;
		da: string;
		a: string;
		vendite: number;
		venduto: number;
		incassato: number;
	}[];
};

export type MeseScadenze = {
	mese: string;
	gruppo: string;
	scadenze: number;
	rinnovati: number;
	/** Somma del prezzo dei prodotti che scadono. */
	valore: number;
	/** Di quel valore, la parte già rinnovata. */
	valore_rinnovati: number;
	/** Quanto valgono i rinnovi (il nuovo prodotto). */
	valore_rinnovi: number;
};

export type Scadenze = { oggi: string; aggiornato_al: string | null; mesi: MeseScadenze[] };

export type RigaScadenza = {
	persona_id?: string | null;
	abbonamento: string | null;
	data_inizio: string;
	data_fine: string;
	totale: number | null;
	venditore: string | null;
	gruppo: string;
	nome: string | null;
	cognome: string | null;
	cellulare: string | null;
	email: string | null;
	rinnovo_abbonamento: string | null;
	rinnovo_inizio: string | null;
	rinnovo_fine: string | null;
	rinnovo_totale: number | null;
};

export type ElencoScadenze = {
	totale: number;
	rinnovati: number;
	valore: number;
	valore_da_rinnovare: number;
	righe: RigaScadenza[];
};

export type RigaIncassi = { chiave: string; importo: number; movimenti: number; persone: number };

export type AnalisiIncassi = {
	totali: { importo: number; entrate: number; uscite: number; movimenti: number; persone: number };
	righe: RigaIncassi[];
	troncato: boolean;
};

export type Movimento = {
	quando: string;
	persona_id?: string | null;
	importo: number;
	tipologia: string;
	metodo: string;
	operatore: string;
	gruppo: string | null;
	descrizione: string | null;
	causale: string | null;
	nome: string | null;
	cognome: string | null;
	abbonamento: string | null;
};

export type ElencoMovimenti = { totale: number; righe: Movimento[] };

export type OpzioniIncassi = { tipologie: string[]; metodi: string[]; operatori: string[]; gruppi: string[] };

// ── Dashboard accessi
// (supabase/migrations/20261116190000_dashboard_accessi.sql, 20261116200000_accessi_giorno.sql)

export type DashboardAccessi = {
	da: string;
	a: string;
	ultimo_accesso: string | null;
	/** Ultimo aggiornamento dei riassunti giornalieri (pg_cron, ogni 5 minuti). */
	aggiornato_al: string | null;
	totali: {
		/** Passaggi validi ai tornelli. */
		ingressi: number;
		/** Persona-giorno: chi passa più volte nello stesso giorno conta una volta. */
		presenze: number;
		persone: number;
		/** Somma, per persona, delle settimane con almeno una presenza. */
		settimane_persona: number;
		rifiutati: number;
		giorni: number;
		giorni_aperti: number;
	};
	/** dow 1 = lunedì … 7 = domenica; `giorni` = quanti di quei giorni nel periodo. */
	giorni_settimana: { dow: number; giorni: number; presenze: number }[];
	/** Ora del primo ingresso della giornata. */
	ore: { dow: number; ora: number; presenze: number }[];
	giorni: { giorno: string; presenze: number }[];
	varchi: { varco: string; ingressi: number; rifiutati: number }[];
	rifiuti: { motivo: string; n: number }[];
	abbonamenti: { abbonamento: string; gruppo: string; presenze: number; persone: number; settimane_persona: number }[];
	gruppi: { gruppo: string; presenze: number; persone: number; settimane_persona: number }[];
	utenti: { persona_id?: string | null; nome: string | null; cognome: string | null; presenze: number; settimane: number; ingressi: number }[];
};

export type AccessiMensile = {
	mesi: { mese: string; presenze: number; ingressi: number; persone: number; settimane_persona: number }[];
};

// ── Contatti e scheda cliente (supabase/migrations/20261117090000_contatti.sql)

export type StatoContatto = "attivo" | "in_scadenza" | "in_partenza" | "scaduto" | "ex" | "mai";

export type RigaContatto = {
	id: string;
	nome: string | null;
	cognome: string | null;
	cellulare: string | null;
	email: string | null;
	eta: number | null;
	stato: StatoContatto;
	/** Ultimo abbonamento: quello con la fine più lontana. */
	abbonamento: string | null;
	gruppo: string | null;
	cliente_dal: string | null;
	ultima_fine: string | null;
	prodotti: number;
	rate_scadute: boolean;
	ultimo_accesso: string | null;
};

export type ElencoContatti = {
	totale: number;
	/** Conteggi per stato con tutti i filtri tranne lo stato. */
	per_stato: Partial<Record<StatoContatto, number>> | null;
	righe: RigaContatto[];
};

export type SchedaPersona = {
	oggi: string;
	persona: {
		id: string;
		nome: string | null;
		cognome: string | null;
		email: string | null;
		cellulare: string | null;
		telefono_1: string | null;
		telefono_2: string | null;
		codice_fiscale: string | null;
		data_nascita: string | null;
		sesso: string | null;
		luogo_nascita: string | null;
		indirizzo: string | null;
		cap: string | null;
		citta: string | null;
		provincia: string | null;
		note: string | null;
		creato_il: string | null;
		source_utente_id: number | null;
		conflitto_con: string | null;
	};
	riepilogo: {
		venduto: number;
		incassato: number;
		da_pagare_scaduto: number;
		da_pagare_futuro: number;
		presenze: number;
		presenze_12m: number;
		settimane_12m: number;
		prima_presenza: string | null;
		ultima_presenza: string | null;
	};
	abbonamenti: {
		source_iscrizione_id: number;
		abbonamento: string | null;
		gruppo: string;
		categoria: string | null;
		quota: boolean;
		venduto_il: string | null;
		inizio: string | null;
		fine: string | null;
		totale: number | null;
		listino: number | null;
		venditore: string | null;
		disdetta: string | null;
		motivo_disdetta: string | null;
		giorni_sospensione: number | null;
		rinnovo_automatico: boolean | null;
		note: string | null;
	}[];
	rate: { scadenza: string; importo: number; pagata_il: string | null; metodo: string | null; abbonamento: string | null; errore: string | null }[];
	sospensioni: { inizio: string; fine: string; giorni: number | null; causale: string | null; abbonamento: string | null }[];
	pagamenti: {
		quando: string;
		importo: number;
		metodo: string | null;
		descrizione: string | null;
		causale: string | null;
		operatore: string | null;
		tipo: string | null;
	}[];
	pagamenti_totale: number;
	presenze_mesi: { mese: string; presenze: number }[];
	presenze_dow: { dow: number; presenze: number }[];
	accessi: { quando: string; varco: string | null; esito: string | null; tipo: number | null }[];
	certificati: { descrizione: string | null; emesso: string | null; scadenza: string | null }[];
	quote: { inizio: string | null; fine: string | null; importo: number | null }[];
	prenotazioni: { quando: string; cosa: string | null; totale: number | null; operatore: string | null }[];
	prenotazioni_totale: number;
	corsi: { inizio: string | null; fine: string | null; importo: number | null; lezioni: number | null; terminato: boolean | null }[];
	omaggi: { inizio: string | null; fine: string | null; totali: number | null; usati: number | null }[];
	pratiche: { creata: string; descrizione: string | null; stato: string | null; cambio_stato: string | null; chiusa: string | null; valore: number | null }[];
	memo: { quando: string | null; oggetto: string | null; testo: string | null }[];
	email: { quando: string; oggetto: string | null; inviata: string | null; errore: string | null }[];
};

// ── Certificati medici (supabase/migrations/20261117110000_dashboard_certificati.sql)

export type FasciaCertificato =
	| "mai"
	| "scaduto_oltre"
	| "scaduto_365"
	| "scaduto_180"
	| "scaduto_90"
	| "scaduto_30"
	| "in_scadenza"
	| "valido";

export type Certificati = {
	oggi: string;
	/** Ultimo aggiornamento dei certificati dal sync. */
	aggiornato_al: string | null;
	/** Iscritti attivi dai 6 anni compiuti (con il filtro sui gruppi). */
	attivi: number;
	/** Di questi, quanti non hanno la data di nascita (non si può sapere se hanno 6 anni). */
	senza_data_nascita: number;
	fasce: Partial<Record<FasciaCertificato, number>>;
	/** Senza filtro sui gruppi: per la tabella per gruppo. */
	gruppi: { gruppo: string; fascia: FasciaCertificato; n: number }[];
	tipi: { tipo: string; n: number }[];
	totale: number;
	righe: {
		persona_id: string;
		nome: string | null;
		cognome: string | null;
		cellulare: string | null;
		email: string | null;
		eta: number | null;
		abbonamento: string | null;
		gruppo: string;
		fine_abbonamento: string | null;
		scadenza: string | null;
		tipo: string | null;
		giorni_scaduto: number | null;
		fascia: FasciaCertificato;
		respinti_30g: number;
		ultimo_accesso: string | null;
	}[];
};

// ── Debitori (supabase/migrations/20261117120000_dashboard_debitori.sql)

export type FasciaDebito = "g30" | "g90" | "g180" | "g365" | "oltre";

export type Debitori = {
	oggi: string;
	aggiornato_al: string | null;
	/** Per anzianità della singola rata; «in_scadenza» = entro 30 giorni. */
	fasce: Partial<Record<FasciaDebito | "in_scadenza", { rate: number; importo: number; persone: number }>>;
	/** Persone per fascia della loro rata scaduta più vecchia. */
	fasce_persone: Partial<Record<FasciaDebito, { persone: number; importo: number; iscritti: number }>>;
	totale_scaduto: number;
	debitori: number;
	debitori_iscritti: number;
	scaduto_iscritti: number;
	per_gruppo: { gruppo: string; importo: number; rate: number }[];
	per_metodo: { metodo: string; importo: number; rate: number }[];
	totale: number;
	totale_importo: number;
	righe: {
		persona_id: string;
		nome: string | null;
		cognome: string | null;
		cellulare: string | null;
		email: string | null;
		scaduto: number;
		rate_scadute: number;
		piu_vecchia: string;
		giorni: number;
		fascia: FasciaDebito;
		da_scadere: number;
		metodo: string | null;
		errore: string | null;
		abbonamento: string | null;
		gruppo: string | null;
		iscritto: boolean;
		ultimo_accesso: string | null;
	}[];
};

// ── Riscontri passivi (supabase/migrations/20261118090000_dashboard_riscontri.sql)

/** Una data di chiusura: fine mese, oggi o lo stesso giorno di un anno fa. `gruppo` null = totale. */
export type RigaRiscontro = {
	giorno: string;
	tipo: "mese" | "oggi" | "anno_fa";
	gruppo: string | null;
	/** Parte degli abbonamenti venduti che riguarda giorni dopo `giorno`. */
	riscontro: number;
	/** Di cui abbonamenti venduti che non sono ancora iniziati (contano per intero). */
	non_iniziati: number;
	abbonamenti: number;
};

export type Riscontri = {
	oggi: string;
	righe: RigaRiscontro[];
};

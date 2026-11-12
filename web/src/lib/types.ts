// Forma dei JSON restituiti dalle funzioni SQL in
// supabase/migrations/20261107120000_dashboard_rpc.sql

export type Vendita = {
	quando: string;
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
		debitori: { nome: string | null; cognome: string | null; importo: number; rate: number; piu_vecchia: string }[];
	};
};

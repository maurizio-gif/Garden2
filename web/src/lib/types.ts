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

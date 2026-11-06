import { leggiGruppi } from '@/lib/gruppi';
import { supabaseServer } from '@/lib/supabase';

export type Sezione = 'abbonamenti' | 'incassato' | 'vendite' | 'accessi' | 'soci' | 'operatori';

/** Un mese di una serie: `gruppo` e' la serie (gruppo prodotto, metodo, operatore...). */
export type Serie = { mese_da: string; gruppo: string; valore: number };

export type Abbonamenti = {
	oggi: string;
	kpi: {
		nuovi_mese: number; nuovi_mese_prec: number;
		rinnovi_mese: number; rinnovi_mese_prec: number;
		ritorni_mese: number; ritorni_mese_prec: number;
	};
	mensile: { mese_da: string; tipo: 'Nuovi' | 'Rinnovi' | 'Ritorni'; n: number }[];
	scadenze: {
		totale: number;
		gia_rinnovati: number;
		settimane: { settimana: number; totale: number; rinnovati: number }[];
		gruppi: { gruppo: string; totale: number; rinnovati: number }[];
		da_recuperare: { gruppo: string; n: number }[];
	};
	tasso: { mese_da: string; scadenze: number; rinnovati: number }[];
};

export type Incassato = {
	oggi: string;
	kpi: {
		incassato_mese: number; incassato_mese_prec: number;
		incassato_anno: number; incassato_anno_prec: number;
		incassato_abb_anno: number; incassato_abb_anno_prec: number;
		venduto_anno: number; venduto_anno_prec: number;
	};
	metodi: Serie[];
	servizi: Serie[];
	mensile_prec: { mese_da: string; valore: number }[];
	giornaliero: Serie[];
	rate: { fascia: string; n: number; importo: number; con_errore: number }[];
};

export type Vendite = {
	oggi: string;
	kpi: {
		vendite_anno: number; vendite_anno_prec: number;
		/** Vendite non-corso: il denominatore delle vendite scontate. */
		vendite_sc_anno: number; vendite_sc_anno_prec: number;
		fatturato_anno: number; fatturato_anno_prec: number;
		scontate_anno: number; scontate_anno_prec: number;
		sconto_anno: number; sconto_anno_prec: number;
		sospensioni_mese: number; sospensioni_mese_prec: number;
		sospensioni_anno: number; sospensioni_anno_prec: number;
	};
	prodotti: { abbonamento: string; gruppo: string; vendite: number; fatturato: number; fatturato_prec: number }[];
	gruppi: { gruppo: string; vendite: number; fatturato: number; fatturato_prec: number }[];
	sospensioni_mensili: { mese_da: string; n: number }[];
};

export type Accessi = {
	oggi: string;
	/** Ultimo giorno con accessi caricati: indietro rispetto a oggi finche' lo storico si carica. */
	fine: string;
	kpi: { sette: number; sette_prec: number; trenta: number; trenta_prec: number; soci_30: number; soci_30_prec: number };
	mensile: { mese_da: string; n: number; n_prec: number }[];
	ore: { ora: number; n: number }[];
	settimana: { giorno: number; n: number }[];
	inattivi: { attivi: number; entrati_30: number; da_31_60: number; da_61_90: number; oltre_90: number };
	inattivi_gruppi: { gruppo: string; attivi: number; inattivi: number }[];
};

export type Soci = {
	oggi: string;
	totale: number;
	eta_media: number | null;
	eta_nota: number;
	fasce_eta: { fascia: string; n: number }[];
	sesso: { sesso: string; n: number }[];
	zone: { zona: string; n: number }[];
	anzianita: { fascia: string; n: number }[];
	nuovi: { mese_da: string; n: number; n_prec: number }[];
};

export type Operatori = {
	oggi: string;
	vendite: { operatore: string; vendite: number; fatturato: number; vendite_prec: number }[];
	ordine: string[];
	mensile: Serie[];
	cassa: { operatore: string; operazioni: number; importo: number }[];
	crm: { operatore: string; azioni: number; evase: number }[];
};

export type DatiSezione = {
	Abbonamenti: Abbonamenti; Incassato: Incassato; Vendite: Vendite; Accessi: Accessi; Soci: Soci; Operatori: Operatori;
};

type Meta = { calcolato_il: string | null; sincronizzato_il: string | null };

/**
 * Legge una sezione dalla cache del database (cruscotto_leggi). Le sezioni
 * con filtro per gruppo (abbonamenti, vendite) ricevono ?gruppi=; per le altre
 * il filtro non esiste.
 */
export async function caricaSezione<T>(
	sezione: Sezione,
	param?: string,
): Promise<{ dati: T; gruppi: string[]; scelti: string[] | null } & Meta> {
	const db = supabaseServer();
	const conFiltro = sezione === 'abbonamenti' || sezione === 'vendite';
	const elenco = conFiltro ? await db.rpc('direzione_gruppi') : { data: [] as string[], error: null };
	if (elenco.error) throw new Error(`direzione_gruppi: ${elenco.error.message}`);
	const gruppi = (elenco.data ?? []) as string[];
	const scelti = conFiltro ? leggiGruppi(param, gruppi) : null;

	const r = await db.rpc('cruscotto_leggi', { p_sezione: sezione, p_gruppi: scelti, p_max_minuti: 45 });
	if (r.error) throw new Error(`cruscotto_leggi(${sezione}): ${r.error.message}`);
	const { calcolato_il, sincronizzato_il, ...dati } = r.data as T & { calcolato_il?: string; sincronizzato_il?: string };
	return { dati: dati as T, gruppi, scelti, calcolato_il: calcolato_il ?? null, sincronizzato_il: sincronizzato_il ?? null };
}

import { readFile } from 'node:fs/promises';
import { leggiGruppi } from '@/lib/gruppi';
import { supabaseServer } from '@/lib/supabase';

export type Kpi = {
	vendite_mese: number;
	fatturato_mese: number;
	vendite_mese_prec: number;
	fatturato_mese_prec: number;
	vendite_anno: number;
	fatturato_anno: number;
	vendite_anno_prec: number;
	fatturato_anno_prec: number;
};

export type Riepilogo = {
	oggi: string;
	kpi: Kpi;
	soci: { oggi: number; mese_fa: number; anno_fa: number };
	fatturato_mensile: { mese_da: string; gruppo: string; fatturato: number; vendite: number }[];
	/** Gli stessi mesi un anno prima (il mese in corso, fino allo stesso giorno). */
	mensile_prec: { mese_da: string; fatturato: number; vendite: number }[];
	soci_mensili: { mese_da: string; gruppo: string; soci: number }[];
	ultime_vendite: { data_vendita: string; abbonamento: string; totale: number; gruppo: string }[];
};

export type Direzione = {
	gruppi: string[];
	/** null = tutti i gruppi */
	scelti: string[] | null;
	riepilogo: Riepilogo;
	/** Quando e' stato calcolato il riepilogo e quando e' arrivata l'ultima sincronizzazione da Info4U. */
	calcolato_il: string | null;
	sincronizzato_il: string | null;
};

/**
 * `param` e' il valore di ?gruppi= (es. «Nuoto,Corsi»). In sviluppo,
 * DIREZIONE_PROVA puo' puntare a un file JSON con gruppi, riepilogo e
 * calcolato_il e sincronizzato_il: serve a vedere la pagina senza la chiave del database, e non
 * si usa in produzione.
 */
export async function caricaDirezione(param: string | undefined): Promise<Direzione> {
	const prova = process.env.DIREZIONE_PROVA;
	if (prova && process.env.NODE_ENV !== 'production') {
		const d = JSON.parse(await readFile(prova, 'utf8')) as Omit<Direzione, 'scelti'>;
		return { ...d, scelti: leggiGruppi(param, d.gruppi) };
	}

	const db = supabaseServer();
	const elenco = await db.rpc('direzione_gruppi');
	if (elenco.error) throw new Error(`direzione_gruppi: ${elenco.error.message}`);
	const gruppi = elenco.data as string[];
	const scelti = leggiGruppi(param, gruppi);

	const riepilogo = await db.rpc('direzione_leggi', { p_gruppi: scelti });
	if (riepilogo.error) throw new Error(`direzione_leggi: ${riepilogo.error.message}`);
	const { calcolato_il, sincronizzato_il, ...dati } = riepilogo.data as Riepilogo & {
		calcolato_il?: string;
		sincronizzato_il?: string;
	};
	return {
		gruppi,
		scelti,
		riepilogo: dati,
		calcolato_il: calcolato_il ?? null,
		sincronizzato_il: sincronizzato_il ?? null,
	};
}

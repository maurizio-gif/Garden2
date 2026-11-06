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
	fatturato_mensile: { mese_da: string; gruppo: string; fatturato: number }[];
	soci_mensili: { mese_da: string; gruppo: string; soci: number }[];
	ultime_vendite: { data_vendita: string; abbonamento: string; totale: number; gruppo: string }[];
};

export type Direzione = {
	gruppi: string[];
	/** null = tutti i gruppi */
	scelti: string[] | null;
	riepilogo: Riepilogo;
	aggiornato_il: string | null;
};

/**
 * `param` e' il valore di ?gruppi= (es. «Nuoto,Corsi»). In sviluppo,
 * DIREZIONE_PROVA puo' puntare a un file JSON con gruppi, riepilogo e
 * aggiornato_il: serve a vedere la pagina senza la chiave del database, e non
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

	const [riepilogo, ultimo] = await Promise.all([
		db.rpc('direzione_riepilogo', { p_gruppi: scelti }),
		db.from('abbonamenti').select('sincronizzato_il').order('sincronizzato_il', { ascending: false }).limit(1),
	]);
	if (riepilogo.error) throw new Error(`direzione_riepilogo: ${riepilogo.error.message}`);
	return {
		gruppi,
		scelti,
		riepilogo: riepilogo.data as Riepilogo,
		aggiornato_il: (ultimo.data?.[0]?.sincronizzato_il as string | undefined) ?? null,
	};
}

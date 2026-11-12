import {
	colonneTempo,
	etichettaTempo,
	isTempo,
	type Filtri,
	type Metrica,
	type Raggruppa,
} from "./analisi";
import { frase, nomeCompleto } from "./format";
import type { Analisi, RigaAnalisi } from "./types";

export type Misure = Pick<RigaAnalisi, "vendite" | "persone" | "fatturato">;

export type RigaVista = {
	chiave: string;
	/** Come si scrive nella tabella e nel grafico. */
	nome: string;
	breve: string;
	secondaRiga?: string;
	attuale: Misure;
	/** Il periodo di confronto; null se non c'è confronto o il punto non esiste. */
	precedente: Misure | null;
	nomePrecedente?: string;
};

const ZERO: Misure = { vendite: 0, persone: 0, fatturato: 0 };

/** «FAMILY NUOTO» → «Family nuoto», «LUCA GROSSI» → «Luca Grossi». */
export function nomeChiave(r: Raggruppa, chiave: string) {
	if (r === "categoria" || r === "abbonamento") return frase(chiave);
	if (r === "operatore") return nomeCompleto(chiave, null);
	return chiave;
}

/**
 * Mette insieme il periodo scelto e quello di confronto, riga per riga. Nel
 * tempo si appaia la n-esima colonna con la n-esima (anche dove un periodo non ha
 * vendite: lo zero si vede); per tipo si appaiano i nomi uguali.
 */
export function unisci(
	f: Filtri,
	corrente: Analisi,
	precedente: Analisi | null,
	periodoPrecedente: { da: string; a: string } | null,
): RigaVista[] {
	const perChiave = (a: Analisi | null) => new Map((a?.righe ?? []).map((r) => [r.chiave, r]));
	const cur = perChiave(corrente);
	const prec = perChiave(precedente);

	if (f.raggruppa === "niente") {
		return [
			{
				chiave: "totale",
				nome: "Totale",
				breve: "Totale",
				attuale: corrente.totali,
				precedente: precedente ? precedente.totali : null,
			},
		];
	}

	if (isTempo(f.raggruppa)) {
		const colonne = colonneTempo(f.raggruppa, f.da, f.a);
		const colonnePrec = periodoPrecedente ? colonneTempo(f.raggruppa, periodoPrecedente.da, periodoPrecedente.a) : [];
		return colonne.map((chiave, i) => {
			const e = etichettaTempo(f.raggruppa, chiave);
			const kp = colonnePrec[i];
			return {
				chiave,
				nome: e.completo,
				breve: e.breve,
				secondaRiga: e.secondaRiga,
				attuale: cur.get(chiave) ?? ZERO,
				precedente: precedente && kp ? (prec.get(kp) ?? ZERO) : null,
				nomePrecedente: kp ? etichettaTempo(f.raggruppa, kp).completo : undefined,
			};
		});
	}

	const chiavi = new Set([...cur.keys(), ...prec.keys()]);
	return [...chiavi]
		.map((chiave) => ({
			chiave,
			nome: nomeChiave(f.raggruppa, chiave),
			breve: nomeChiave(f.raggruppa, chiave),
			attuale: cur.get(chiave) ?? ZERO,
			precedente: precedente ? (prec.get(chiave) ?? ZERO) : null,
		}))
		.sort((a, b) => b.attuale[f.metrica] - a.attuale[f.metrica] || b.attuale.fatturato - a.attuale.fatturato);
}

export const valore = (m: Misure, metrica: Metrica) => m[metrica];

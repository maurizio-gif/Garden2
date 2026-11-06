import type { Punto } from '@/components/Colonne';
import { annoDi, meseBreve } from '@/lib/format';

/** I primi giorni degli ultimi `n` mesi, dal piu' vecchio a quello di `oggi`. */
export function ultimiMesi(oggi: string, n = 12): string[] {
	const [a, m] = oggi.split('-').map(Number);
	return Array.from({ length: n }, (_, i) => {
		const idx = a * 12 + (m - 1) - (n - 1 - i);
		return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-01`;
	});
}

/**
 * Colonne mensili: una per mese, fatte a pezzi dalle serie in `ordine`.
 * L'ultimo mese e' quello in corso (tratteggiato).
 */
export function puntiMensili(
	mesi: string[],
	ordine: string[],
	valore: (mese: string, serie: string) => number,
	extra?: { confronto?: (mese: string) => number | undefined; inCorso?: string; titoloUltimo?: string },
): Punto[] {
	return mesi.map((m, i) => {
		const prec = extra?.confronto?.(m);
		const ultimo = i === mesi.length - 1;
		return {
			chiave: m,
			etichetta: meseBreve(m),
			anno: i === 0 || m.slice(5, 7) === '01' ? annoDi(m) : undefined,
			titolo: `${meseBreve(m)} ${annoDi(m)}${ultimo ? ` · ${extra?.titoloUltimo ?? 'finora'}` : ''}`,
			inCorso: ultimo && extra?.inCorso !== 'no',
			parti: ordine.map((g) => ({ gruppo: g, valore: valore(m, g) })),
			confronto: prec !== undefined ? { valore: prec, etichetta: `${meseBreve(m)} ${Number(annoDi(m)) - 1}` } : undefined,
		};
	});
}

/** Somma i valori di una serie [{mese_da, gruppo, valore}] per mese. */
export const sommaMese = <T extends { mese_da: string }>(righe: T[], mese: string, campo: (r: T) => number, filtro?: (r: T) => boolean) =>
	righe.filter((r) => r.mese_da === mese && (!filtro || filtro(r))).reduce((s, r) => s + Number(campo(r)), 0);

// Calcoli sulle scadenze (funzione SQL dashboard_scadenze): somme per mese con
// un filtro sui gruppi, tasso di rinnovo. Nessuna scelta di gruppi = tutti.

import type { MeseScadenze } from "./types";

export type TotaleMese = {
	mese: string;
	scadenze: number;
	rinnovati: number;
	valore: number;
	valore_rinnovati: number;
	valore_rinnovi: number;
};

/** Primo giorno del mese che sta `n` mesi da quello di `oggi` (negativo = passato). */
export function meseDa(oggi: string, n: number) {
	const [y, m] = oggi.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

/** Le righe per mese e gruppo sommate per mese, dal mese `da` al mese `a` compresi, anche quelli vuoti. */
export function perMese(righe: MeseScadenze[], gruppi: string[], da: string, a: string): TotaleMese[] {
	const mappa = new Map<string, TotaleMese>();
	for (let m = da; m <= a; m = meseDa(m, 1)) {
		mappa.set(m, { mese: m, scadenze: 0, rinnovati: 0, valore: 0, valore_rinnovati: 0, valore_rinnovi: 0 });
	}
	for (const r of righe) {
		if (gruppi.length && !gruppi.includes(r.gruppo)) continue;
		const t = mappa.get(r.mese);
		if (!t) continue;
		t.scadenze += r.scadenze;
		t.rinnovati += r.rinnovati;
		t.valore += r.valore;
		t.valore_rinnovati += r.valore_rinnovati;
		t.valore_rinnovi += r.valore_rinnovi;
	}
	return [...mappa.values()];
}

/**
 * Tasso di rinnovo sugli ultimi 12 mesi «chiusi»: quelli finiti da almeno 30
 * giorni, così la finestra di rinnovo è passata per tutti. Accanto, gli stessi
 * 12 mesi dell'anno prima.
 */
export function tassoRinnovi(righe: MeseScadenze[], oggi: string, gruppi: string[]) {
	const somma = (da: string, a: string) =>
		perMese(righe, gruppi, da, a).reduce(
			(s, m) => ({ scadenze: s.scadenze + m.scadenze, rinnovati: s.rinnovati + m.rinnovati }),
			{ scadenze: 0, rinnovati: 0 },
		);
	const ora = somma(meseDa(oggi, -13), meseDa(oggi, -2));
	const prima = somma(meseDa(oggi, -25), meseDa(oggi, -14));
	return {
		...ora,
		tasso: ora.scadenze > 0 ? ora.rinnovati / ora.scadenze : null,
		tassoPrima: prima.scadenze > 0 ? prima.rinnovati / prima.scadenze : null,
		da: meseDa(oggi, -13),
		a: meseDa(oggi, -2),
	};
}

// ───────────────────────────────────────── filtri dell'elenco (indirizzo)

export type StatoScadenza = "tutti" | "rinnovati" | "da_rinnovare";
export type OrdineScadenze = "fine" | "importo" | "nome";

export type FiltriElencoScadenze = {
	/** Mese di scadenza, AAAA-MM (vale se non ci sono `da` e `a`). */
	mese: string;
	da: string;
	a: string;
	gruppi: string[];
	stato: StatoScadenza;
	q: string;
	pagina: number;
	ordine: OrdineScadenze;
};

type Cerca = Record<string, string | string[] | undefined>;
const primo = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MESE = /^\d{4}-\d{2}$/;

function ultimoDelMese(mese: string) {
	const [y, m] = mese.split("-").map(Number);
	return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function leggiFiltriScadenze(cerca: Cerca, oggi: string, gruppiValidi: string[]): FiltriElencoScadenze {
	const m0 = primo(cerca.mese);
	const mese = m0 && MESE.test(m0) ? m0 : oggi.slice(0, 7);
	const d0 = primo(cerca.da);
	const a0 = primo(cerca.a);
	let da = d0 && ISO.test(d0) ? d0 : `${mese}-01`;
	let a = a0 && ISO.test(a0) ? a0 : ultimoDelMese(`${mese}-01`);
	if (da > a) [da, a] = [a, da];
	const grezzo = cerca.gruppi;
	const gruppi = (Array.isArray(grezzo) ? grezzo.join("|") : (grezzo ?? ""))
		.split("|")
		.map((x) => x.trim())
		.filter((x) => gruppiValidi.includes(x));
	const stato = primo(cerca.stato);
	const ordine = primo(cerca.ordine);
	const pagina = Number.parseInt(primo(cerca.pagina) ?? "1", 10);
	return {
		mese,
		da,
		a,
		gruppi,
		stato: stato === "rinnovati" || stato === "da_rinnovare" ? stato : "tutti",
		q: (primo(cerca.q) ?? "").trim().slice(0, 80),
		pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 5000) : 1,
		ordine: ordine === "importo" || ordine === "nome" ? ordine : "fine",
	};
}

/** L'indirizzo dei filtri; `extra` sostituisce o toglie (stringa vuota) singoli parametri. */
export function queryScadenze(f: FiltriElencoScadenze, extra: Record<string, string> = {}) {
	const p = new URLSearchParams();
	const daMese = f.da === `${f.mese}-01` && f.a === ultimoDelMese(`${f.mese}-01`);
	p.set("mese", f.mese);
	if (!daMese) {
		p.set("da", f.da);
		p.set("a", f.a);
	}
	if (f.gruppi.length) p.set("gruppi", f.gruppi.join("|"));
	if (f.stato !== "tutti") p.set("stato", f.stato);
	if (f.q) p.set("q", f.q);
	if (f.ordine !== "fine") p.set("ordine", f.ordine);
	if (f.pagina > 1) p.set("pagina", String(f.pagina));
	for (const [k, v] of Object.entries(extra)) {
		if (v) p.set(k, v);
		else p.delete(k);
	}
	return p.toString();
}

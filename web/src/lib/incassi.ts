// Filtri della ricerca sugli incassi (pagina Analisi → Incassi). Stessa idea
// dell'analisi delle vendite: tutto sta nell'indirizzo, così una ricerca si
// copia, si manda e si riapre uguale. Date, preset e colonne di tempo sono
// quelli di lib/analisi.ts.

import { aggiungiAnni, aggiungiGiorni, dataValida, giorniTra, PRESET, periodoDaPreset, type Preset } from "./analisi";

export type RaggruppaIncassi = "giorno" | "settimana" | "mese" | "anno" | "tipologia" | "metodo" | "operatore" | "gruppo" | "niente";
export type MetricaIncassi = "importo" | "movimenti" | "persone";
export type ConfrontoIncassi = "nessuno" | "anno" | "periodo";
export type Segno = "tutti" | "entrate" | "uscite";

export type FiltriIncassi = {
	preset: Preset | null;
	da: string;
	a: string;
	raggruppa: RaggruppaIncassi;
	metrica: MetricaIncassi;
	confronto: ConfrontoIncassi;
	tipologie: string[];
	metodi: string[];
	operatori: string[];
	segno: Segno;
	q: string;
	min: string;
	max: string;
	pagina: number;
	ordine: "data" | "importo";
};

export const RAGGRUPPA_INCASSI: { valore: RaggruppaIncassi; nome: string; tempo?: boolean }[] = [
	{ valore: "mese", nome: "Mese", tempo: true },
	{ valore: "settimana", nome: "Settimana", tempo: true },
	{ valore: "giorno", nome: "Giorno", tempo: true },
	{ valore: "anno", nome: "Anno", tempo: true },
	{ valore: "tipologia", nome: "Tipologia" },
	{ valore: "gruppo", nome: "Gruppo di abbonamenti" },
	{ valore: "metodo", nome: "Metodo di pagamento" },
	{ valore: "operatore", nome: "Operatore" },
	{ valore: "niente", nome: "Nessuno (solo totale)" },
];

export const METRICHE_INCASSI: { valore: MetricaIncassi; nome: string }[] = [
	{ valore: "importo", nome: "Incassato (€)" },
	{ valore: "movimenti", nome: "Numero di movimenti" },
	{ valore: "persone", nome: "Persone diverse" },
];

export const SEGNI: { valore: Segno; nome: string }[] = [
	{ valore: "tutti", nome: "Entrate e uscite (netto)" },
	{ valore: "entrate", nome: "Solo entrate" },
	{ valore: "uscite", nome: "Solo uscite e storni" },
];

export const isTempoIncassi = (r: RaggruppaIncassi) => r === "giorno" || r === "settimana" || r === "mese" || r === "anno";

type Cerca = Record<string, string | string[] | undefined>;

const primo = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const lista = (v: string | string[] | undefined) =>
	(Array.isArray(v) ? v : v ? [v] : [])
		.flatMap((x) => x.split("|"))
		.map((x) => x.trim())
		.filter(Boolean)
		.slice(0, 60);
const tra = <T extends string>(v: string | undefined, validi: readonly T[], difetto: T): T =>
	validi.includes(v as T) ? (v as T) : difetto;
const numero = (v: string | undefined) => {
	if (!v) return "";
	const n = Number(v.replace(",", "."));
	return Number.isFinite(n) ? String(n) : "";
};

/** Legge i filtri dall'indirizzo; qualsiasi valore sbagliato torna al valore di partenza. */
export function leggiFiltriIncassi(cerca: Cerca, oggi: string): FiltriIncassi {
	const preset = PRESET.find((p) => p.valore === primo(cerca.p))?.valore ?? null;
	let da: string;
	let a: string;
	if (preset) {
		({ da, a } = periodoDaPreset(preset, oggi));
	} else {
		const d0 = primo(cerca.da);
		const a0 = primo(cerca.a);
		if (dataValida(d0) || dataValida(a0)) {
			da = dataValida(d0) ? d0 : periodoDaPreset("anno", oggi).da;
			a = dataValida(a0) ? a0 : oggi;
		} else {
			({ da, a } = periodoDaPreset("anno", oggi));
		}
	}
	if (da > a) [da, a] = [a, da];

	let raggruppa = tra(
		primo(cerca.raggruppa),
		RAGGRUPPA_INCASSI.map((r) => r.valore),
		"mese",
	);
	if (raggruppa === "giorno" && giorniTra(da, a) > 370) raggruppa = "settimana";

	const pagina = Number.parseInt(primo(cerca.pagina) ?? "1", 10);
	return {
		preset,
		da,
		a,
		raggruppa,
		metrica: tra(primo(cerca.metrica), ["importo", "movimenti", "persone"], "importo"),
		confronto: tra(primo(cerca.confronto), ["nessuno", "anno", "periodo"], "anno"),
		tipologie: lista(cerca.tipologie),
		metodi: lista(cerca.metodi),
		operatori: lista(cerca.operatori),
		segno: tra(primo(cerca.segno), ["tutti", "entrate", "uscite"], "tutti"),
		q: (primo(cerca.q) ?? "").trim().slice(0, 80),
		min: numero(primo(cerca.min)),
		max: numero(primo(cerca.max)),
		pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 5000) : 1,
		ordine: primo(cerca.ordine) === "importo" ? "importo" : "data",
	};
}

/** L'indirizzo (senza «?») che descrive questi filtri. */
export function filtriIncassiInQuery(f: FiltriIncassi, opzioni: { senzaPagina?: boolean } = {}) {
	const p = new URLSearchParams();
	if (f.preset) p.set("p", f.preset);
	else {
		p.set("da", f.da);
		p.set("a", f.a);
	}
	if (f.raggruppa !== "mese") p.set("raggruppa", f.raggruppa);
	if (f.metrica !== "importo") p.set("metrica", f.metrica);
	if (f.confronto !== "anno") p.set("confronto", f.confronto);
	if (f.tipologie.length) p.set("tipologie", f.tipologie.join("|"));
	if (f.metodi.length) p.set("metodi", f.metodi.join("|"));
	if (f.operatori.length) p.set("operatori", f.operatori.join("|"));
	if (f.segno !== "tutti") p.set("segno", f.segno);
	if (f.q) p.set("q", f.q);
	if (f.min) p.set("min", f.min);
	if (f.max) p.set("max", f.max);
	if (f.ordine !== "data") p.set("ordine", f.ordine);
	if (!opzioni.senzaPagina && f.pagina > 1) p.set("pagina", String(f.pagina));
	return p.toString();
}

export function filtriIncassiPerRpc(f: FiltriIncassi, periodo?: { da: string; a: string }) {
	return {
		da: periodo?.da ?? f.da,
		a: periodo?.a ?? f.a,
		tipologie: f.tipologie,
		metodi: f.metodi,
		operatori: f.operatori,
		segno: f.segno,
		q: f.q,
		min: f.min,
		max: f.max,
	};
}

export function periodoConfrontoIncassi(f: FiltriIncassi): { da: string; a: string } | null {
	if (f.confronto === "anno") return { da: aggiungiAnni(f.da, -1), a: aggiungiAnni(f.a, -1) };
	if (f.confronto === "periodo") {
		const giorni = giorniTra(f.da, f.a) + 1;
		return { da: aggiungiGiorni(f.da, -giorni), a: aggiungiGiorni(f.da, -1) };
	}
	return null;
}

// Filtri della pagina Analisi: lettura dall'indirizzo, scrittura, confronto.
// Niente `server-only`: lo usano sia le pagine sia i controlli nel browser.
//
// Tutto sta nell'indirizzo (?da=…&gruppi=…): una vista si copia, si manda e si
// salva senza altro. Le viste salvate sono solo l'indirizzo con un nome.

export type Raggruppa =
	| "giorno"
	| "settimana"
	| "mese"
	| "anno"
	| "gruppo"
	| "categoria"
	| "abbonamento"
	| "operatore"
	| "durata"
	| "niente";
export type Metrica = "fatturato" | "vendite" | "persone";
export type Campo = "vendita" | "inizio" | "fine";
export type Confronto = "nessuno" | "anno" | "periodo";
export type Preset = "anno" | "anno_scorso" | "stagione" | "12m" | "90g" | "mese" | "mese_scorso";

export type Filtri = {
	/** Preset del periodo: se c'è, `da` e `a` sono ricalcolati ogni volta da oggi (le viste salvate restano attuali). */
	preset: Preset | null;
	da: string;
	a: string;
	campo: Campo;
	raggruppa: Raggruppa;
	metrica: Metrica;
	confronto: Confronto;
	gruppi: string[];
	categorie: string[];
	operatori: string[];
	q: string;
	min: string;
	max: string;
	conQuote: boolean;
	/** Pagina dell'elenco delle vendite, da 1. */
	pagina: number;
	ordine: "data" | "importo";
};

export const PRESET: { valore: Preset; nome: string }[] = [
	{ valore: "anno", nome: "Da inizio anno" },
	{ valore: "anno_scorso", nome: "Anno scorso" },
	{ valore: "stagione", nome: "Stagione in corso (da settembre)" },
	{ valore: "12m", nome: "Ultimi 12 mesi" },
	{ valore: "90g", nome: "Ultimi 90 giorni" },
	{ valore: "mese", nome: "Mese in corso" },
	{ valore: "mese_scorso", nome: "Mese scorso" },
];

export const RAGGRUPPA: { valore: Raggruppa; nome: string; tempo?: boolean }[] = [
	{ valore: "mese", nome: "Mese", tempo: true },
	{ valore: "settimana", nome: "Settimana", tempo: true },
	{ valore: "giorno", nome: "Giorno", tempo: true },
	{ valore: "anno", nome: "Anno", tempo: true },
	{ valore: "gruppo", nome: "Gruppo di prodotti" },
	{ valore: "categoria", nome: "Categoria" },
	{ valore: "abbonamento", nome: "Abbonamento" },
	{ valore: "durata", nome: "Durata" },
	{ valore: "operatore", nome: "Venditore" },
	{ valore: "niente", nome: "Nessuno (solo totale)" },
];

export const METRICHE: { valore: Metrica; nome: string; breve: string }[] = [
	{ valore: "fatturato", nome: "Venduto (€)", breve: "Venduto" },
	{ valore: "vendite", nome: "Numero di vendite", breve: "Vendite" },
	{ valore: "persone", nome: "Persone diverse", breve: "Persone" },
];

export const CAMPI: { valore: Campo; nome: string }[] = [
	{ valore: "vendita", nome: "Data di vendita" },
	{ valore: "inizio", nome: "Data di inizio" },
	{ valore: "fine", nome: "Data di fine" },
];

export const CONFRONTI: { valore: Confronto; nome: string }[] = [
	{ valore: "anno", nome: "Stesso periodo dell'anno scorso" },
	{ valore: "periodo", nome: "Periodo precedente (stessa durata)" },
	{ valore: "nessuno", nome: "Nessun confronto" },
];

export const isTempo = (r: Raggruppa) => r === "giorno" || r === "settimana" || r === "mese" || r === "anno";

// ───────────────────────────────────────────────────────────────── date

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function dataValida(s: string | undefined | null): s is string {
	if (!s || !ISO.test(s)) return false;
	const d = new Date(`${s}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const aData = (s: string) => new Date(`${s}T00:00:00Z`);
const aIso = (d: Date) => d.toISOString().slice(0, 10);

export function aggiungiGiorni(s: string, n: number) {
	const d = aData(s);
	d.setUTCDate(d.getUTCDate() + n);
	return aIso(d);
}

/** Stesso giorno di `n` anni fa (il 29 febbraio diventa 28). */
export function aggiungiAnni(s: string, n: number) {
	const [y, m, g] = s.split("-").map(Number);
	const ultimo = new Date(Date.UTC(y + n, m, 0)).getUTCDate();
	return aIso(new Date(Date.UTC(y + n, m - 1, Math.min(g, ultimo))));
}

export function giorniTra(da: string, a: string) {
	return Math.round((aData(a).getTime() - aData(da).getTime()) / 86_400_000);
}

export function periodoDaPreset(p: Preset, oggi: string): { da: string; a: string } {
	const [y, m] = oggi.split("-").map(Number);
	const primo = (anno: number, mese: number) => aIso(new Date(Date.UTC(anno, mese - 1, 1)));
	const ultimo = (anno: number, mese: number) => aIso(new Date(Date.UTC(anno, mese, 0)));
	switch (p) {
		case "anno":
			return { da: primo(y, 1), a: oggi };
		case "anno_scorso":
			return { da: primo(y - 1, 1), a: ultimo(y - 1, 12) };
		case "stagione":
			return { da: primo(m >= 9 ? y : y - 1, 9), a: oggi };
		case "12m":
			return { da: aggiungiGiorni(aggiungiAnni(oggi, -1), 1), a: oggi };
		case "90g":
			return { da: aggiungiGiorni(oggi, -89), a: oggi };
		case "mese":
			return { da: primo(y, m), a: oggi };
		case "mese_scorso":
			return { da: primo(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1), a: ultimo(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1) };
	}
}

// ───────────────────────────────────────────────────────── lettura / scrittura

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
export function leggiFiltri(cerca: Cerca, oggi: string): Filtri {
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
		RAGGRUPPA.map((r) => r.valore),
		"mese",
	);
	// Più di un anno di giorni sono troppe colonne per leggere qualcosa: si passa alle settimane.
	if (raggruppa === "giorno" && giorniTra(da, a) > 370) raggruppa = "settimana";

	const pagina = Number.parseInt(primo(cerca.pagina) ?? "1", 10);
	return {
		preset,
		da,
		a,
		campo: tra(primo(cerca.campo), ["vendita", "inizio", "fine"], "vendita"),
		raggruppa,
		metrica: tra(primo(cerca.metrica), ["fatturato", "vendite", "persone"], "fatturato"),
		confronto: tra(primo(cerca.confronto), ["nessuno", "anno", "periodo"], "anno"),
		gruppi: lista(cerca.gruppi),
		categorie: lista(cerca.categorie),
		operatori: lista(cerca.operatori),
		q: (primo(cerca.q) ?? "").trim().slice(0, 80),
		min: numero(primo(cerca.min)),
		max: numero(primo(cerca.max)),
		conQuote: primo(cerca.quote) === "1",
		pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 5000) : 1,
		ordine: primo(cerca.ordine) === "importo" ? "importo" : "data",
	};
}

/** L'indirizzo (senza «?») che descrive questi filtri. Con un preset le date non si scrivono. */
export function filtriInQuery(f: Filtri, opzioni: { senzaPagina?: boolean } = {}) {
	const p = new URLSearchParams();
	if (f.preset) p.set("p", f.preset);
	else {
		p.set("da", f.da);
		p.set("a", f.a);
	}
	if (f.campo !== "vendita") p.set("campo", f.campo);
	if (f.raggruppa !== "mese") p.set("raggruppa", f.raggruppa);
	if (f.metrica !== "fatturato") p.set("metrica", f.metrica);
	if (f.confronto !== "anno") p.set("confronto", f.confronto);
	if (f.gruppi.length) p.set("gruppi", f.gruppi.join("|"));
	if (f.categorie.length) p.set("categorie", f.categorie.join("|"));
	if (f.operatori.length) p.set("operatori", f.operatori.join("|"));
	if (f.q) p.set("q", f.q);
	if (f.min) p.set("min", f.min);
	if (f.max) p.set("max", f.max);
	if (f.conQuote) p.set("quote", "1");
	if (f.ordine !== "data") p.set("ordine", f.ordine);
	if (!opzioni.senzaPagina && f.pagina > 1) p.set("pagina", String(f.pagina));
	return p.toString();
}

/** I filtri nella forma che si aspetta la funzione SQL dashboard_base. */
export function filtriPerRpc(f: Filtri, periodo?: { da: string; a: string }) {
	return {
		da: periodo?.da ?? f.da,
		a: periodo?.a ?? f.a,
		campo: f.campo,
		gruppi: f.gruppi,
		categorie: f.categorie,
		operatori: f.operatori,
		q: f.q,
		min: f.min,
		max: f.max,
		con_quote: f.conQuote,
	};
}

/** Il periodo con cui si confronta, o null. */
export function periodoConfronto(f: Filtri): { da: string; a: string } | null {
	if (f.confronto === "anno") return { da: aggiungiAnni(f.da, -1), a: aggiungiAnni(f.a, -1) };
	if (f.confronto === "periodo") {
		const giorni = giorniTra(f.da, f.a) + 1;
		return { da: aggiungiGiorni(f.da, -giorni), a: aggiungiGiorni(f.da, -1) };
	}
	return null;
}

// ─────────────────────────────────────────────────── colonne di tempo

/** Le chiavi (come le restituisce SQL) di tutte le colonne del periodo, anche quelle vuote. */
export function colonneTempo(r: Raggruppa, da: string, a: string): string[] {
	const out: string[] = [];
	if (r === "giorno") {
		for (let d = da; d <= a; d = aggiungiGiorni(d, 1)) out.push(d);
	} else if (r === "settimana") {
		const inizio = aData(da);
		const dow = (inizio.getUTCDay() + 6) % 7; // lunedì = 0
		let d = aggiungiGiorni(da, -dow);
		for (; d <= a; d = aggiungiGiorni(d, 7)) out.push(d);
	} else if (r === "mese") {
		let [y, m] = da.split("-").map(Number);
		const [ya, ma] = a.split("-").map(Number);
		while (y < ya || (y === ya && m <= ma)) {
			out.push(`${y}-${String(m).padStart(2, "0")}`);
			m++;
			if (m > 12) {
				m = 1;
				y++;
			}
		}
	} else if (r === "anno") {
		for (let y = Number(da.slice(0, 4)); y <= Number(a.slice(0, 4)); y++) out.push(String(y));
	}
	return out;
}

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MESI_LUNGHI = [
	"gennaio",
	"febbraio",
	"marzo",
	"aprile",
	"maggio",
	"giugno",
	"luglio",
	"agosto",
	"settembre",
	"ottobre",
	"novembre",
	"dicembre",
];

/** Etichetta breve (sotto la barra), seconda riga e nome completo di una colonna di tempo. */
export function etichettaTempo(r: Raggruppa, chiave: string) {
	if (r === "mese") {
		const [y, m] = chiave.split("-").map(Number);
		return { breve: MESI[m - 1], secondaRiga: m === 1 ? String(y) : undefined, completo: `${MESI_LUNGHI[m - 1]} ${y}` };
	}
	if (r === "anno") return { breve: chiave, secondaRiga: undefined, completo: chiave };
	const [y, m, g] = chiave.split("-").map(Number);
	const breve = `${g} ${MESI[m - 1]}`;
	return {
		breve,
		secondaRiga: undefined,
		completo: r === "settimana" ? `settimana dal ${g} ${MESI[m - 1]} ${y}` : `${g} ${MESI[m - 1]} ${y}`,
	};
}

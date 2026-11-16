// Filtri della pagina Contatti: tutto nell'indirizzo, così una ricerca si
// copia e si riapre uguale. La logica (cos'è «attivo», «scaduto»…) sta in
// supabase/migrations/20261117090000_contatti.sql.

import type { StatoContatto } from "./types";

export type StatoFiltro = "tutti" | "attivi" | StatoContatto | "tutti_compresi_mai";
export type OrdineContatti = "nome" | "scadenza" | "accesso" | "cliente";

export type FiltriContatti = {
	q: string;
	stato: StatoFiltro;
	gruppi: string[];
	abbonamento: string;
	rateScadute: boolean;
	/** Non vengono da almeno N giorni (vuoto = nessun filtro). */
	assenti: string;
	sesso: "" | "M" | "F";
	etaMin: string;
	etaMax: string;
	certificatoScaduto: boolean;
	ordine: OrdineContatti;
	pagina: number;
};

export const STATI: { valore: StatoFiltro; nome: string; tono?: "ok" | "attenzione" | "spento" }[] = [
	{ valore: "tutti", nome: "Tutti i clienti" },
	{ valore: "attivi", nome: "Attivi", tono: "ok" },
	{ valore: "in_scadenza", nome: "In scadenza (30 giorni)", tono: "attenzione" },
	{ valore: "in_partenza", nome: "In partenza" },
	{ valore: "scaduto", nome: "Scaduti da poco (90 giorni)", tono: "attenzione" },
	{ valore: "ex", nome: "Ex clienti", tono: "spento" },
	{ valore: "mai", nome: "Mai iscritti (contatti)", tono: "spento" },
];

export const NOMI_STATO: Record<StatoContatto, string> = {
	attivo: "Attivo",
	in_scadenza: "In scadenza",
	in_partenza: "In partenza",
	scaduto: "Scaduto da poco",
	ex: "Ex cliente",
	mai: "Mai iscritto",
};

export const ORDINI: { valore: OrdineContatti; nome: string }[] = [
	{ valore: "nome", nome: "Cognome" },
	{ valore: "scadenza", nome: "Scadenza più vicina" },
	{ valore: "accesso", nome: "Ultimo accesso" },
	{ valore: "cliente", nome: "Cliente da più tempo" },
];

type Cerca = Record<string, string | string[] | undefined>;
const primo = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const intero = (v: string | undefined) => {
	const n = Number.parseInt(v ?? "", 10);
	return Number.isFinite(n) && n >= 0 && n < 200 ? String(n) : "";
};

export function leggiFiltriContatti(cerca: Cerca): FiltriContatti {
	const stato = primo(cerca.stato);
	const ordine = primo(cerca.ordine);
	const sesso = (primo(cerca.sesso) ?? "").toUpperCase();
	const grezzo = cerca.gruppi;
	const assenti = Number.parseInt(primo(cerca.assenti) ?? "", 10);
	const pagina = Number.parseInt(primo(cerca.pagina) ?? "1", 10);
	return {
		q: (primo(cerca.q) ?? "").trim().slice(0, 80),
		stato: STATI.some((s) => s.valore === stato) || stato === "tutti_compresi_mai" ? (stato as StatoFiltro) : "tutti",
		gruppi: (Array.isArray(grezzo) ? grezzo : grezzo ? [grezzo] : [])
			.flatMap((x) => x.split("|"))
			.map((x) => x.trim())
			.filter(Boolean)
			.slice(0, 20),
		abbonamento: (primo(cerca.abbonamento) ?? "").trim().slice(0, 80),
		rateScadute: primo(cerca.rate) === "1",
		assenti: Number.isFinite(assenti) && assenti > 0 && assenti <= 3650 ? String(assenti) : "",
		sesso: sesso === "M" || sesso === "F" ? sesso : "",
		etaMin: intero(primo(cerca.eta_min)),
		etaMax: intero(primo(cerca.eta_max)),
		certificatoScaduto: primo(cerca.certificato) === "scaduto",
		ordine: ORDINI.some((o) => o.valore === ordine) ? (ordine as OrdineContatti) : "nome",
		pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 5000) : 1,
	};
}

/** L'indirizzo dei filtri; `extra` cambia o toglie (stringa vuota) singoli parametri. */
export function queryContatti(f: FiltriContatti, extra: Record<string, string> = {}) {
	const p = new URLSearchParams();
	if (f.q) p.set("q", f.q);
	if (f.stato !== "tutti") p.set("stato", f.stato);
	if (f.gruppi.length) p.set("gruppi", f.gruppi.join("|"));
	if (f.abbonamento) p.set("abbonamento", f.abbonamento);
	if (f.rateScadute) p.set("rate", "1");
	if (f.assenti) p.set("assenti", f.assenti);
	if (f.sesso) p.set("sesso", f.sesso);
	if (f.etaMin) p.set("eta_min", f.etaMin);
	if (f.etaMax) p.set("eta_max", f.etaMax);
	if (f.certificatoScaduto) p.set("certificato", "scaduto");
	if (f.ordine !== "nome") p.set("ordine", f.ordine);
	if (f.pagina > 1) p.set("pagina", String(f.pagina));
	for (const [k, v] of Object.entries(extra)) {
		if (v) p.set(k, v);
		else p.delete(k);
	}
	return p.toString();
}

export function filtriContattiPerRpc(f: FiltriContatti) {
	return {
		q: f.q,
		stato: f.stato,
		gruppi: f.gruppi,
		abbonamento: f.abbonamento,
		rate_scadute: f.rateScadute,
		assenti: f.assenti,
		sesso: f.sesso,
		eta_min: f.etaMin,
		eta_max: f.etaMax,
		certificato_scaduto: f.certificatoScaduto,
	};
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const idValido = (id: string) => UUID.test(id);

/** Lo stato di una persona dai suoi abbonamenti (stesse regole di dashboard_contatti). */
export function statoDaAbbonamenti(
	abbonamenti: { quota: boolean; inizio: string | null; fine: string | null }[],
	oggi: string,
): StatoContatto {
	const prodotti = abbonamenti.filter((a) => !a.quota && a.inizio && a.fine && a.fine >= a.inizio) as { inizio: string; fine: string }[];
	if (prodotti.length === 0) return "mai";
	const piu30 = new Date(Date.parse(`${oggi}T00:00:00Z`) + 30 * 86_400_000).toISOString().slice(0, 10);
	const meno90 = new Date(Date.parse(`${oggi}T00:00:00Z`) - 90 * 86_400_000).toISOString().slice(0, 10);
	const ultimaFine = prodotti.reduce((m, p) => (p.fine > m ? p.fine : m), "");
	if (prodotti.some((p) => p.inizio <= oggi && p.fine >= oggi)) return ultimaFine <= piu30 ? "in_scadenza" : "attivo";
	if (prodotti.some((p) => p.inizio > oggi)) return "in_partenza";
	return ultimaFine >= meno90 ? "scaduto" : "ex";
}

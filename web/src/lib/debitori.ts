// Filtri e nomi della pagina Debitori. Le regole stanno in
// supabase/migrations/20261117120000_dashboard_debitori.sql.

import type { FasciaDebito } from "./types";

export const FASCE_DEBITO: { valore: FasciaDebito; nome: string }[] = [
	{ valore: "g30", nome: "Scaduto da meno di 30 giorni" },
	{ valore: "g90", nome: "Scaduto da 1-3 mesi" },
	{ valore: "g180", nome: "Scaduto da 3-6 mesi" },
	{ valore: "g365", nome: "Scaduto da 6-12 mesi" },
	{ valore: "oltre", nome: "Scaduto da oltre un anno" },
];

export type OrdineDebitori = "importo" | "anzianita" | "nome";
export type FiltriDebitori = {
	/** «anno» = scaduti nell'ultimo anno (tutte le fasce tranne «oltre»): la vista di partenza. */
	fascia: "anno" | "tutte" | FasciaDebito;
	gruppi: string[];
	q: string;
	soloIscritti: boolean;
	min: string;
	ordine: OrdineDebitori;
	pagina: number;
};

type Cerca = Record<string, string | string[] | undefined>;
const primo = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function leggiFiltriDebitori(cerca: Cerca): FiltriDebitori {
	const fascia = primo(cerca.fascia);
	const ordine = primo(cerca.ordine);
	const grezzo = cerca.gruppi;
	const min = Number((primo(cerca.min) ?? "").replace(",", "."));
	const pagina = Number.parseInt(primo(cerca.pagina) ?? "1", 10);
	return {
		fascia: FASCE_DEBITO.some((x) => x.valore === fascia) || fascia === "tutte" ? (fascia as FasciaDebito | "tutte") : "anno",
		gruppi: (Array.isArray(grezzo) ? grezzo.join("|") : (grezzo ?? ""))
			.split("|")
			.map((x) => x.trim())
			.filter(Boolean)
			.slice(0, 20),
		q: (primo(cerca.q) ?? "").trim().slice(0, 80),
		soloIscritti: primo(cerca.iscritti) === "1",
		min: Number.isFinite(min) && min > 0 ? String(min) : "",
		ordine: ordine === "anzianita" || ordine === "nome" ? ordine : "importo",
		pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 5000) : 1,
	};
}

export function queryDebitori(f: FiltriDebitori, extra: Record<string, string> = {}) {
	const p = new URLSearchParams();
	if (f.fascia !== "anno") p.set("fascia", f.fascia);
	if (f.gruppi.length) p.set("gruppi", f.gruppi.join("|"));
	if (f.q) p.set("q", f.q);
	if (f.soloIscritti) p.set("iscritti", "1");
	if (f.min) p.set("min", f.min);
	if (f.ordine !== "importo") p.set("ordine", f.ordine);
	if (f.pagina > 1) p.set("pagina", String(f.pagina));
	for (const [k, v] of Object.entries(extra)) {
		if (v) p.set(k, v);
		else p.delete(k);
	}
	return p.toString();
}

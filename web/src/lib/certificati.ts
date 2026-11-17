// Filtri e nomi della pagina Certificati. La logica (chi conta, le fasce) sta in
// supabase/migrations/20261117110000_dashboard_certificati.sql.

import type { FasciaCertificato } from "./types";

export type FiltroFascia = "da_sistemare" | "scaduti" | "tutti" | FasciaCertificato;

export const FASCE: { valore: FasciaCertificato; nome: string; breve: string }[] = [
	{ valore: "mai", nome: "Mai consegnato", breve: "Mai consegnato" },
	{ valore: "scaduto_oltre", nome: "Scaduto da oltre un anno", breve: "Oltre 1 anno" },
	{ valore: "scaduto_365", nome: "Scaduto da 6-12 mesi", breve: "6-12 mesi" },
	{ valore: "scaduto_180", nome: "Scaduto da 3-6 mesi", breve: "3-6 mesi" },
	{ valore: "scaduto_90", nome: "Scaduto da 1-3 mesi", breve: "1-3 mesi" },
	{ valore: "scaduto_30", nome: "Scaduto da meno di 30 giorni", breve: "Meno di 30 giorni" },
	{ valore: "in_scadenza", nome: "In scadenza entro 30 giorni", breve: "In scadenza" },
	{ valore: "valido", nome: "Valido", breve: "Valido" },
];

export const FILTRI_FASCIA: { valore: FiltroFascia; nome: string }[] = [
	{ valore: "da_sistemare", nome: "Da sistemare" },
	{ valore: "in_scadenza", nome: "In scadenza (30 giorni)" },
	{ valore: "scaduti", nome: "Scaduti" },
	{ valore: "mai", nome: "Mai consegnato" },
	{ valore: "valido", nome: "Validi" },
	{ valore: "tutti", nome: "Tutti gli iscritti attivi" },
];

export type FiltriCertificati = { fascia: FiltroFascia; gruppi: string[]; q: string; pagina: number };

type Cerca = Record<string, string | string[] | undefined>;
const primo = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function leggiFiltriCertificati(cerca: Cerca): FiltriCertificati {
	const fascia = primo(cerca.fascia);
	const validi = [...FILTRI_FASCIA.map((x) => x.valore), ...FASCE.map((x) => x.valore)];
	const grezzo = cerca.gruppi;
	const pagina = Number.parseInt(primo(cerca.pagina) ?? "1", 10);
	return {
		fascia: validi.includes(fascia as FiltroFascia) ? (fascia as FiltroFascia) : "da_sistemare",
		gruppi: (Array.isArray(grezzo) ? grezzo.join("|") : (grezzo ?? ""))
			.split("|")
			.map((x) => x.trim())
			.filter(Boolean)
			.slice(0, 20),
		q: (primo(cerca.q) ?? "").trim().slice(0, 80),
		pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 5000) : 1,
	};
}

export function queryCertificati(f: FiltriCertificati, extra: Record<string, string> = {}) {
	const p = new URLSearchParams();
	if (f.fascia !== "da_sistemare") p.set("fascia", f.fascia);
	if (f.gruppi.length) p.set("gruppi", f.gruppi.join("|"));
	if (f.q) p.set("q", f.q);
	if (f.pagina > 1) p.set("pagina", String(f.pagina));
	for (const [k, v] of Object.entries(extra)) {
		if (v) p.set(k, v);
		else p.delete(k);
	}
	return p.toString();
}

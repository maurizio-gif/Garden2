import { leggiMovimentiPerCsv } from "@/lib/data";

/**
 * I movimenti della ricerca sugli incassi in CSV, pronto per Excel italiano:
 * separatore «;», virgola decimale e BOM iniziale per gli accenti. Passa dal
 * proxy come ogni altra pagina, quindi vale la stessa password del pannello.
 */
export async function GET(request: Request) {
	const url = new URL(request.url);
	// I filtri multipli arrivano ripetuti (?metodi=a&metodi=b): si tengono tutti.
	const cerca: Record<string, string | string[]> = {};
	for (const k of new Set(url.searchParams.keys())) {
		const v = url.searchParams.getAll(k);
		cerca[k] = v.length > 1 ? v : v[0];
	}
	const { filtri, elenco } = await leggiMovimentiPerCsv(cerca);

	const testo = (v: string | null | undefined) => {
		const t = (v ?? "").replace(/\r?\n/g, " ");
		const sicuro = /^[=+\-@\t]/.test(t) ? `'${t}` : t;
		return /[";]/.test(sicuro) ? `"${sicuro.replace(/"/g, '""')}"` : sicuro;
	};
	const numero = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
	const quando = (iso: string) =>
		new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

	const intestazione = ["Data e ora", "Cognome", "Nome", "Tipologia", "Gruppo", "Abbonamento", "Descrizione", "Causale", "Metodo", "Operatore", "Importo"];
	const righe = elenco.righe.map((m) =>
		[
			quando(m.quando),
			testo(m.cognome),
			testo(m.nome),
			testo(m.tipologia),
			testo(m.gruppo),
			testo(m.abbonamento),
			testo(m.descrizione),
			testo(m.causale),
			testo(m.metodo),
			testo(m.operatore),
			numero(m.importo),
		].join(";"),
	);

	const corpo = `﻿${[intestazione.join(";"), ...righe].join("\r\n")}\r\n`;
	return new Response(corpo, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="garden-incassi-${filtri.da}_${filtri.a}.csv"`,
			"Cache-Control": "no-store",
			...(elenco.totale > elenco.righe.length ? { "X-Righe-Omesse": String(elenco.totale - elenco.righe.length) } : {}),
		},
	});
}

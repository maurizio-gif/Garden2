import { leggiElencoScadenze, leggiOpzioni, oggiARoma } from "@/lib/data";
import { leggiFiltriScadenze } from "@/lib/scadenze";

/**
 * Le scadenze filtrate in CSV, pronto per Excel italiano: separatore «;»,
 * virgola decimale e BOM iniziale per gli accenti. Passa dal proxy come ogni
 * altra pagina, quindi vale la stessa password del pannello.
 */
export async function GET(request: Request) {
	const cerca = Object.fromEntries(new URL(request.url).searchParams);
	const opzioni = await leggiOpzioni();
	const f = leggiFiltriScadenze(cerca, oggiARoma(), [...opzioni.gruppi, "Altro", "Quote e tessere"]);
	const { dati: elenco } = await leggiElencoScadenze(f, true);

	const testo = (v: string | null | undefined) => {
		const t = (v ?? "").replace(/\r?\n/g, " ");
		const sicuro = /^[=+\-@\t]/.test(t) ? `'${t}` : t;
		return /[";]/.test(sicuro) ? `"${sicuro.replace(/"/g, '""')}"` : sicuro;
	};
	const numero = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

	const intestazione = [
		"Scadenza",
		"Inizio",
		"Cognome",
		"Nome",
		"Cellulare",
		"Email",
		"Abbonamento",
		"Gruppo",
		"Importo",
		"Venditore",
		"Rinnovato",
		"Rinnovo: abbonamento",
		"Rinnovo: inizio",
		"Rinnovo: fine",
		"Rinnovo: importo",
	];
	const righe = elenco.righe.map((r) =>
		[
			r.data_fine,
			r.data_inizio,
			testo(r.cognome),
			testo(r.nome),
			testo(r.cellulare),
			testo(r.email),
			testo(r.abbonamento),
			testo(r.gruppo),
			numero(r.totale),
			testo(r.venditore),
			r.rinnovo_inizio ? "sì" : "no",
			testo(r.rinnovo_abbonamento),
			r.rinnovo_inizio ?? "",
			r.rinnovo_fine ?? "",
			numero(r.rinnovo_totale),
		].join(";"),
	);

	const corpo = `﻿${[intestazione.join(";"), ...righe].join("\r\n")}\r\n`;
	return new Response(corpo, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="garden-scadenze-${f.da}_${f.a}.csv"`,
			"Cache-Control": "no-store",
		},
	});
}

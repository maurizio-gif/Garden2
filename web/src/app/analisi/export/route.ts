import { leggiVenditePerCsv } from "@/lib/data";

/**
 * Le vendite dell'analisi in CSV, pronto per Excel italiano: separatore «;»,
 * virgola decimale e BOM iniziale per gli accenti. Passa dal proxy come ogni
 * altra pagina, quindi vale la stessa password del pannello.
 */
export async function GET(request: Request) {
	const cerca = Object.fromEntries(new URL(request.url).searchParams);
	const { filtri, elenco } = await leggiVenditePerCsv(cerca);

	// I testi che iniziano con = + - @ in Excel diventano formule: si disinnescano.
	const testo = (v: string | null | undefined) => {
		const t = (v ?? "").replace(/\r?\n/g, " ");
		const sicuro = /^[=+\-@\t]/.test(t) ? `'${t}` : t;
		return /[";]/.test(sicuro) ? `"${sicuro.replace(/"/g, '""')}"` : sicuro;
	};
	const numero = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));

	const intestazione = [
		"Venduto il",
		"Inizio",
		"Fine",
		"Cognome",
		"Nome",
		"Abbonamento",
		"Categoria",
		"Gruppo",
		"Durata",
		"Venditore",
		"Importo",
	];
	const righe = elenco.righe.map((v) =>
		[
			v.vendita ?? "",
			v.inizio ?? "",
			v.fine ?? "",
			testo(v.cognome),
			testo(v.nome),
			testo(v.abbonamento),
			testo(v.categoria),
			testo(v.gruppo),
			testo(v.durata),
			testo(v.operatore),
			numero(v.totale),
		].join(";"),
	);

	const corpo = `﻿${[intestazione.join(";"), ...righe].join("\r\n")}\r\n`;
	return new Response(corpo, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="garden-vendite-${filtri.da}_${filtri.a}.csv"`,
			"Cache-Control": "no-store",
			...(elenco.totale > elenco.righe.length ? { "X-Righe-Omesse": String(elenco.totale - elenco.righe.length) } : {}),
		},
	});
}

import { FASCE, leggiFiltriCertificati } from "@/lib/certificati";
import { leggiCertificati } from "@/lib/data";

/** L'elenco dei certificati filtrato in CSV per Excel (separatore «;», BOM). Passa dal proxy. */
export async function GET(request: Request) {
	const cerca = Object.fromEntries(new URL(request.url).searchParams);
	const f = leggiFiltriCertificati(cerca);
	const { dati } = await leggiCertificati(f, true);

	const testo = (v: string | number | null | undefined) => {
		const t = String(v ?? "").replace(/\r?\n/g, " ");
		const sicuro = /^[=+\-@\t]/.test(t) ? `'${t}` : t;
		return /[";]/.test(sicuro) ? `"${sicuro.replace(/"/g, '""')}"` : sicuro;
	};
	const intestazione = ["Cognome", "Nome", "Età", "Cellulare", "Email", "Stato certificato", "Scadenza certificato", "Giorni scaduto", "Tipo", "Abbonamento attivo", "Gruppo", "Fine abbonamento", "Respinti 30 giorni", "Ultimo accesso"];
	const righe = dati.righe.map((r) =>
		[
			testo(r.cognome),
			testo(r.nome),
			r.eta ?? "",
			testo(r.cellulare),
			testo(r.email),
			FASCE.find((x) => x.valore === r.fascia)?.nome ?? r.fascia,
			r.scadenza ?? "",
			r.giorni_scaduto != null && r.giorni_scaduto > 0 ? r.giorni_scaduto : "",
			testo(r.tipo),
			testo(r.abbonamento),
			testo(r.gruppo),
			r.fine_abbonamento ?? "",
			r.respinti_30g,
			r.ultimo_accesso ?? "",
		].join(";"),
	);
	const corpo = `﻿${[intestazione.join(";"), ...righe].join("\r\n")}\r\n`;
	return new Response(corpo, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="garden-certificati.csv"`,
			"Cache-Control": "no-store",
		},
	});
}

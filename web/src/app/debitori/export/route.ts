import { leggiDebitori } from "@/lib/data";
import { FASCE_DEBITO, leggiFiltriDebitori } from "@/lib/debitori";

/** I debitori filtrati in CSV per Excel (separatore «;», virgola decimale, BOM). Passa dal proxy. */
export async function GET(request: Request) {
	const cerca = Object.fromEntries(new URL(request.url).searchParams);
	const f = leggiFiltriDebitori(cerca);
	const { dati } = await leggiDebitori(f, true);

	const testo = (v: string | number | null | undefined) => {
		const t = String(v ?? "").replace(/\r?\n/g, " ");
		const sicuro = /^[=+\-@\t]/.test(t) ? `'${t}` : t;
		return /[";]/.test(sicuro) ? `"${sicuro.replace(/"/g, '""')}"` : sicuro;
	};
	const numero = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
	const intestazione = ["Cognome", "Nome", "Cellulare", "Email", "Scaduto", "Rate scadute", "Rata più vecchia", "Giorni", "Fascia", "Prossime rate", "Metodo", "Esito addebito", "Abbonamento", "Gruppo", "Iscritto", "Ultimo accesso"];
	const righe = dati.righe.map((r) =>
		[
			testo(r.cognome),
			testo(r.nome),
			testo(r.cellulare),
			testo(r.email),
			numero(r.scaduto),
			r.rate_scadute,
			r.piu_vecchia,
			r.giorni,
			FASCE_DEBITO.find((x) => x.valore === r.fascia)?.nome ?? r.fascia,
			numero(r.da_scadere),
			testo(r.metodo),
			testo(r.errore),
			testo(r.abbonamento),
			testo(r.gruppo),
			r.iscritto ? "sì" : "no",
			r.ultimo_accesso ?? "",
		].join(";"),
	);
	const corpo = `﻿${[intestazione.join(";"), ...righe].join("\r\n")}\r\n`;
	return new Response(corpo, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="garden-debitori.csv"`,
			"Cache-Control": "no-store",
		},
	});
}

import { leggiFiltriContatti, NOMI_STATO } from "@/lib/contatti";
import { leggiContatti } from "@/lib/data";

/**
 * I contatti filtrati in CSV, pronto per Excel italiano: separatore «;» e BOM
 * iniziale per gli accenti. Passa dal proxy, quindi vale la password del pannello.
 */
export async function GET(request: Request) {
	const url = new URL(request.url);
	const cerca: Record<string, string | string[]> = {};
	for (const k of new Set(url.searchParams.keys())) {
		const v = url.searchParams.getAll(k);
		cerca[k] = v.length > 1 ? v : v[0];
	}
	const f = leggiFiltriContatti(cerca);
	const { dati } = await leggiContatti(f, true);

	const testo = (v: string | number | null | undefined) => {
		const t = String(v ?? "").replace(/\r?\n/g, " ");
		const sicuro = /^[=+\-@\t]/.test(t) ? `'${t}` : t;
		return /[";]/.test(sicuro) ? `"${sicuro.replace(/"/g, '""')}"` : sicuro;
	};
	const intestazione = ["Cognome", "Nome", "Cellulare", "Email", "Età", "Stato", "Ultimo abbonamento", "Gruppo", "Scade", "Ultimo accesso", "Cliente dal", "Rate scadute"];
	const righe = dati.righe.map((r) =>
		[
			testo(r.cognome),
			testo(r.nome),
			testo(r.cellulare),
			testo(r.email),
			r.eta ?? "",
			NOMI_STATO[r.stato],
			testo(r.abbonamento),
			testo(r.gruppo),
			r.ultima_fine ?? "",
			r.ultimo_accesso ?? "",
			r.cliente_dal ?? "",
			r.rate_scadute ? "sì" : "no",
		].join(";"),
	);
	const corpo = `﻿${[intestazione.join(";"), ...righe].join("\r\n")}\r\n`;
	return new Response(corpo, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="garden-contatti.csv"`,
			"Cache-Control": "no-store",
		},
	});
}

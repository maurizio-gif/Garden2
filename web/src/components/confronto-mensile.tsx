"use client";

import { useState } from "react";
import { LineeAnni, type SerieAnno } from "./linee-anni";

/** Le linee per anno con un interruttore tra venduto in euro e numero di vendite. */
export function ConfrontoMensile({
	fatturato,
	vendite,
	meseCorrente,
	nomi = { fatturato: "Venduto (€)", vendite: "Numero di vendite" },
	titoli = { fatturato: "Venduto per mese, un anno per linea", vendite: "Vendite per mese, un anno per linea" },
	formatoVendite = "numero",
}: {
	fatturato: SerieAnno[];
	vendite: SerieAnno[];
	meseCorrente: number;
	/** Le due etichette dell'interruttore (di norma venduto in euro e numero di vendite). */
	nomi?: { fatturato: string; vendite: string };
	titoli?: { fatturato: string; vendite: string };
	formatoVendite?: "euro" | "numero";
}) {
	const [misura, setMisura] = useState<"fatturato" | "vendite">("fatturato");
	return (
		<div>
			<div role="group" aria-label="Cosa mostrare" className="mb-4 inline-flex rounded-xl bg-surface-2 p-1 text-sm">
				{(
					[
						["fatturato", nomi.fatturato],
						["vendite", nomi.vendite],
					] as const
				).map(([v, nome]) => (
					<button
						key={v}
						type="button"
						aria-pressed={misura === v}
						onClick={() => setMisura(v)}
						className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
							misura === v ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink"
						}`}
					>
						{nome}
					</button>
				))}
			</div>
			<LineeAnni
				serie={misura === "fatturato" ? fatturato : vendite}
				formato={misura === "fatturato" ? "euro" : formatoVendite}
				titolo={misura === "fatturato" ? titoli.fatturato : titoli.vendite}
				meseCorrente={meseCorrente}
			/>
		</div>
	);
}

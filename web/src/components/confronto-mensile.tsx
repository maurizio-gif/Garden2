"use client";

import { useState } from "react";
import { LineeAnni, type SerieAnno } from "./linee-anni";

/** Le linee per anno con un interruttore tra venduto in euro e numero di vendite. */
export function ConfrontoMensile({
	fatturato,
	vendite,
	meseCorrente,
}: {
	fatturato: SerieAnno[];
	vendite: SerieAnno[];
	meseCorrente: number;
}) {
	const [misura, setMisura] = useState<"fatturato" | "vendite">("fatturato");
	return (
		<div>
			<div role="group" aria-label="Cosa mostrare" className="mb-4 inline-flex rounded-xl bg-surface-2 p-1 text-sm">
				{(
					[
						["fatturato", "Venduto (€)"],
						["vendite", "Numero di vendite"],
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
				formato={misura === "fatturato" ? "euro" : "numero"}
				titolo={misura === "fatturato" ? "Venduto per mese, un anno per linea" : "Vendite per mese, un anno per linea"}
				meseCorrente={meseCorrente}
			/>
		</div>
	);
}

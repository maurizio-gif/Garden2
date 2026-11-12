/** Variazione in percentuale, o null quando il confronto non ha senso (base zero). */
export function variazione(ora: number, prima: number | null | undefined) {
	if (prima == null || prima === 0) return null;
	return ((ora - prima) / prima) * 100;
}

/**
 * «+5%» / «−3%» con freccia e parole per i lettori di schermo: il verde e
 * l'arancio da soli non bastano. `inverso` per i numeri in cui salire è un male (le uscite).
 */
export function Delta({
	ora,
	prima,
	inverso = false,
	assoluto = false,
}: {
	ora: number;
	prima: number | null | undefined;
	inverso?: boolean;
	/** Scrive anche la differenza in numeri («+262»). */
	assoluto?: boolean;
}) {
	if (prima == null) return <span className="text-ink-3">—</span>;
	const diff = ora - prima;
	const perc = variazione(ora, prima);
	if (diff === 0) return <span className="text-xs text-ink-3">invariato</span>;
	const su = diff > 0;
	const bene = inverso ? !su : su;
	const testo = [
		assoluto ? `${su ? "+" : "−"}${new Intl.NumberFormat("it-IT").format(Math.abs(Math.round(diff)))}` : null,
		perc != null ? `${su ? "+" : "−"}${Math.abs(Math.round(perc))}%` : null,
	]
		.filter(Boolean)
		.join(" · ");
	return (
		<span
			className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
				bene ? "bg-accent-soft text-accent-strong" : "bg-warn-soft text-warn"
			}`}
		>
			<svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
				<path
					d={su ? "M6 10V2.5M2.8 5.5 6 2.3l3.2 3.2" : "M6 2v7.5M2.8 6.5 6 9.7l3.2-3.2"}
					fill="none"
					stroke="currentColor"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			<span className="sr-only">{su ? "in aumento di" : "in calo di"}</span>
			{testo || "—"}
		</span>
	);
}

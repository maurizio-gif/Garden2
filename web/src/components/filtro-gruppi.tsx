import Link from "next/link";

/**
 * Chip per scegliere uno o più gruppi di prodotti. Tutto sta nell'indirizzo
 * (`?gruppi=Nuoto|Corsi`), così la scelta si copia e si ricarica uguale.
 * Nessuna scelta = tutti i gruppi.
 */
export function FiltroGruppi({
	percorso,
	gruppi,
	scelti,
	altri = {},
}: {
	percorso: string;
	gruppi: string[];
	scelti: string[];
	/** Altri parametri dell'indirizzo da conservare. */
	altri?: Record<string, string>;
}) {
	const href = (lista: string[]) => {
		const p = new URLSearchParams(altri);
		if (lista.length) p.set("gruppi", lista.join("|"));
		const q = p.toString();
		return q ? `${percorso}?${q}` : percorso;
	};
	const chip = (attivo: boolean) =>
		`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
			attivo ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface text-ink-2 hover:text-ink"
		}`;

	return (
		<nav aria-label="Filtra per gruppo" className="flex flex-wrap items-center gap-2">
			<span className="mr-1 text-xs text-ink-3">Gruppi:</span>
			<Link href={href([])} scroll={false} className={chip(scelti.length === 0)} aria-current={scelti.length === 0 ? "true" : undefined}>
				Tutti
			</Link>
			{gruppi.map((g) => {
				const attivo = scelti.includes(g);
				const prossimi = attivo ? scelti.filter((x) => x !== g) : [...scelti, g];
				return (
					<Link key={g} href={href(prossimi)} scroll={false} className={chip(attivo)} aria-current={attivo ? "true" : undefined}>
						{g}
					</Link>
				);
			})}
		</nav>
	);
}

/** Legge `?gruppi=` e tiene solo i gruppi che esistono. */
export function gruppiScelti(v: string | string[] | undefined, validi: string[]) {
	const grezzo = Array.isArray(v) ? v.join("|") : (v ?? "");
	return grezzo
		.split("|")
		.map((x) => x.trim())
		.filter((x) => validi.includes(x));
}

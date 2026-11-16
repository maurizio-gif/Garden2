import Link from "next/link";

/** Le due ricerche personalizzate: sulle vendite di abbonamenti e sugli incassi. */
export function SchedeAnalisi({ attiva }: { attiva: "vendite" | "incassi" }) {
	const voce = (on: boolean) =>
		`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
			on ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink"
		}`;
	return (
		<nav aria-label="Tipo di analisi" className="mt-3 inline-flex gap-1 rounded-xl bg-surface-2 p-1">
			<Link href="/analisi" className={voce(attiva === "vendite")} aria-current={attiva === "vendite" ? "page" : undefined}>
				Vendite di abbonamenti
			</Link>
			<Link href="/analisi/incassi" className={voce(attiva === "incassi")} aria-current={attiva === "incassi" ? "page" : undefined}>
				Incassi
			</Link>
		</nav>
	);
}

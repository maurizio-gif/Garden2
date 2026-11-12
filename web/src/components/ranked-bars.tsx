"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

export type RigaOrdinata = { etichetta: string; valore: number; confronto?: number | null };

const intero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: "always" });
const soldi = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Barre orizzontali ordinate, la più lunga in alto: è la forma che permette di
 * confrontare bene tante categorie (un anello con 24 fette non si legge).
 * Ogni barra si allunga da sinistra, una dopo l'altra, quando entra nello schermo.
 * Il valore è scritto sulla riga, non solo nel colore.
 */
export function RankedBars({
	righe,
	unita,
	euro = false,
}: {
	righe: RigaOrdinata[];
	unita: string;
	/** Valori in euro invece che numeri interi. */
	euro?: boolean;
}) {
	const ridotto = useReducedMotion();
	const ref = useRef<HTMLUListElement>(null);
	const visto = useInView(ref, { once: true, amount: 0.2 });
	const max = Math.max(...righe.flatMap((r) => [r.valore, r.confronto ?? 0]), 1);
	const conConfronto = righe.some((r) => r.confronto != null);
	const fmt = euro ? soldi : intero;

	return (
		<ul ref={ref} className="m-0 flex list-none flex-col gap-3.5 p-0">
			{righe.map((r, i) => (
				<li key={r.etichetta}>
					<div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
						<span className="min-w-0 truncate text-ink-2">{r.etichetta}</span>
						<span className="shrink-0 font-medium tabular-nums text-ink">
							{fmt.format(r.valore)}
							<span className="sr-only"> {unita}</span>
						</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
						<motion.div
							className="h-full rounded-full bg-accent"
							initial={{ width: 0 }}
							animate={{ width: visto ? `${(r.valore / max) * 100}%` : 0 }}
							transition={
								ridotto
									? { duration: 0 }
									: { duration: 0.85, delay: 0.1 + i * 0.07, ease: [0.22, 1, 0.36, 1] }
							}
						/>
					</div>
					{conConfronto && r.confronto != null && (
						<div className="mt-1 flex items-center gap-2">
							<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
								<div
									className="h-full rounded-full"
									style={{ width: `${(r.confronto / max) * 100}%`, background: "var(--serie-4)", opacity: 0.55 }}
								/>
							</div>
							<span className="w-24 shrink-0 text-right text-xs tabular-nums text-ink-3">
								<span className="sr-only">Periodo di confronto: </span>
								{fmt.format(r.confronto)}
							</span>
						</div>
					)}
				</li>
			))}
		</ul>
	);
}

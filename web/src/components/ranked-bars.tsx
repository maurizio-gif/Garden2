"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

export type RigaOrdinata = { etichetta: string; valore: number };

const intero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: "always" });

/**
 * Barre orizzontali ordinate, la più lunga in alto: è la forma che permette di
 * confrontare bene tante categorie (un anello con 24 fette non si legge).
 * Ogni barra si allunga da sinistra, una dopo l'altra, quando entra nello schermo.
 * Il valore è scritto sulla riga, non solo nel colore.
 */
export function RankedBars({ righe, unita }: { righe: RigaOrdinata[]; unita: string }) {
	const ridotto = useReducedMotion();
	const ref = useRef<HTMLUListElement>(null);
	const visto = useInView(ref, { once: true, amount: 0.2 });
	const max = Math.max(...righe.map((r) => r.valore), 1);

	return (
		<ul ref={ref} className="m-0 flex list-none flex-col gap-3.5 p-0">
			{righe.map((r, i) => (
				<li key={r.etichetta}>
					<div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
						<span className="min-w-0 truncate text-ink-2">{r.etichetta}</span>
						<span className="shrink-0 font-medium tabular-nums text-ink">
							{intero.format(r.valore)}
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
				</li>
			))}
		</ul>
	);
}

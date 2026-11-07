"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

export type PuntoBarre = {
	/** Testo breve sotto la barra («ott»). */
	etichetta: string;
	/** Seconda riga sotto la barra, solo dove serve (l'anno su gennaio). */
	secondaRiga?: string;
	/** Testo completo per tooltip e tabella («ottobre 2026»). */
	nomeCompleto: string;
	valore: number;
	/** Mese non ancora finito: la barra è tratteggiata. */
	incompleto?: boolean;
};

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const compatto = new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 0 });

/** Scala «pulita»: quattro intervalli con passo 1, 2, 2,5 o 5 × 10ⁿ. */
function scala(max: number) {
	const grezzo = Math.max(max, 1) / 4;
	const ordine = 10 ** Math.floor(Math.log10(grezzo));
	const n = grezzo / ordine;
	const passo = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * ordine;
	let tetto = Math.ceil(max / passo) * passo || passo;
	// Aria sopra la barra più alta: serve all'etichetta del valore e al tooltip.
	if (max / tetto > 0.82) tetto += passo;
	const tacche: number[] = [];
	for (let v = 0; v <= tetto + passo / 2; v += passo) tacche.push(v);
	return { tetto, tacche };
}

/**
 * Colonne verticali che crescono dal basso, una dopo l'altra, quando il grafico
 * entra nello schermo. Una sola serie: niente legenda, il titolo dice cosa è.
 * Solo l'ultima barra e la più alta portano il valore scritto; per gli altri
 * ci sono tooltip (mouse e tastiera) e la tabella nascosta per i lettori di schermo.
 */
export function BarChart({ punti, titolo }: { punti: PuntoBarre[]; titolo: string }) {
	const ridotto = useReducedMotion();
	const [attivo, setAttivo] = useState<number | null>(null);
	// Si osserva l'intero grafico, non le barre: partono da altezza 0 e un
	// elemento senza area non risulta mai «visibile» se la sua base è vicina al bordo.
	const ref = useRef<HTMLElement>(null);
	const visto = useInView(ref, { once: true, amount: 0.25 });
	const max = Math.max(...punti.map((p) => p.valore), 0);
	const { tetto, tacche } = scala(max);
	const indiceMax = punti.findIndex((p) => p.valore === max);
	const ultimo = punti.length - 1;

	return (
		<figure ref={ref} className="m-0 flex min-h-0 flex-1 flex-col">
			<div className="flex flex-1" role="img" aria-label={`${titolo}: grafico a colonne, ${punti.length} mesi`}>
				{/* asse verticale: la stessa altezza dell'area del grafico, più lo spazio delle etichette dei mesi */}
				<div className="mr-2 flex w-12 shrink-0 flex-col text-right text-[11px] text-ink-3" aria-hidden="true">
					<div className="relative min-h-56 flex-1">
						{tacche.map((t) => (
							<span
								key={t}
								className="absolute right-0 translate-y-1/2 tabular-nums"
								style={{ bottom: `${(t / tetto) * 100}%` }}
							>
								{t === 0 ? "0" : compatto.format(t)}
							</span>
						))}
					</div>
					<div className="mt-2 h-8" />
				</div>

				<div className="flex min-w-0 flex-1 flex-col">
					<div className="relative min-h-56 flex-1">
						{tacche.map((t) => (
							<div
								key={t}
								className="absolute inset-x-0 border-t border-line"
								style={{ bottom: `${(t / tetto) * 100}%` }}
								aria-hidden="true"
							/>
						))}

						<div className="absolute inset-0 flex">
							{punti.map((p, i) => {
								const altezza = (p.valore / tetto) * 100;
								const conEtichetta = i === ultimo || i === indiceMax;
								const spento = attivo !== null && attivo !== i;
								return (
									<button
										key={p.nomeCompleto}
										type="button"
										className="relative flex h-full min-w-0 flex-1 items-end justify-center px-0.5 outline-offset-0"
										aria-label={`${p.nomeCompleto}: ${euro.format(p.valore)}${p.incompleto ? " (mese in corso)" : ""}`}
										onMouseEnter={() => setAttivo(i)}
										onMouseLeave={() => setAttivo(null)}
										onFocus={() => setAttivo(i)}
										onBlur={() => setAttivo(null)}
									>
										<motion.span
											className={`block w-full max-w-6 rounded-t-[4px] transition-opacity duration-150 ${
												spento ? "opacity-40" : "opacity-100"
											}`}
											style={
												p.incompleto
													? {
															background:
																"repeating-linear-gradient(-45deg, var(--accent) 0 3px, var(--surface) 3px 6px)",
															boxShadow: "inset 0 0 0 1.5px var(--accent)",
														}
													: { background: "var(--accent)" }
											}
											initial={{ height: 0 }}
											animate={{ height: visto ? `${altezza}%` : 0 }}
											transition={
												ridotto
													? { duration: 0 }
													: { duration: 0.8, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }
											}
										/>

										{conEtichetta && attivo !== i && (
											<motion.span
												aria-hidden="true"
												className={`pointer-events-none absolute whitespace-nowrap text-[11px] font-semibold tabular-nums text-ink ${
													i === ultimo ? "right-0.5" : "left-1/2 -translate-x-1/2"
												}`}
												style={{ bottom: `calc(${altezza}% + 6px)` }}
												initial={{ opacity: 0 }}
												animate={{ opacity: visto ? 1 : 0 }}
												transition={{ delay: ridotto ? 0 : 0.8 + i * 0.05, duration: 0.3 }}
											>
												{compatto.format(p.valore)}
											</motion.span>
										)}

										{attivo === i && (
											<span
												role="presentation"
												className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lift ${
													i < 2
														? "left-0"
														: i > punti.length - 3
															? "right-0"
															: "left-1/2 -translate-x-1/2"
												}`}
												style={{ bottom: `calc(${altezza}% + 8px)` }}
											>
												<span className="block text-ink-3">
													{p.nomeCompleto}
													{p.incompleto ? " · in corso" : ""}
												</span>
												<span className="block text-sm font-semibold tabular-nums text-ink">
													{euro.format(p.valore)}
												</span>
											</span>
										)}
									</button>
								);
							})}
						</div>
					</div>

					{/* asse orizzontale */}
					<div className="mt-2 flex h-8" aria-hidden="true">
						{punti.map((p) => (
							<div
								key={p.nomeCompleto}
								className="min-w-0 flex-1 text-center text-[11px] leading-tight text-ink-3 max-sm:odd:invisible"
							>
								<span className={p.incompleto ? "font-semibold text-ink-2" : ""}>{p.etichetta}</span>
								<span className="block h-3">{p.secondaRiga}</span>
							</div>
						))}
					</div>
				</div>
			</div>

			<figcaption className="sr-only">{titolo}</figcaption>
			<table className="sr-only">
				<caption>{titolo}</caption>
				<thead>
					<tr>
						<th scope="col">Mese</th>
						<th scope="col">Incassi</th>
					</tr>
				</thead>
				<tbody>
					{punti.map((p) => (
						<tr key={p.nomeCompleto}>
							<th scope="row">
								{p.nomeCompleto}
								{p.incompleto ? " (in corso)" : ""}
							</th>
							<td>{euro.format(p.valore)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</figure>
	);
}

"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

export type PuntoMovimento = {
	etichetta: string;
	secondaRiga?: string;
	nomeCompleto: string;
	nuovi: number;
	rientri: number;
	usciti: number;
	attivi: number;
	incompleto?: boolean;
};

const intero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: "always" });

/**
 * Entrate sopra lo zero (nuovi in verde, rientri più chiari), uscite sotto in
 * arancio: si vede subito se un mese cresce o si svuota. Il numero di iscritti a
 * fine mese è nel tooltip. Il mese in corso è tratteggiato: le uscite si
 * conoscono solo a fine periodo.
 */
export function MovimentoChart({ punti, titolo }: { punti: PuntoMovimento[]; titolo: string }) {
	const ridotto = useReducedMotion();
	const ref = useRef<HTMLDivElement>(null);
	const visto = useInView(ref, { once: true, amount: 0.2 });
	const [attivo, setAttivo] = useState<number | null>(null);

	const maxSu = Math.max(...punti.map((p) => p.nuovi + p.rientri), 1);
	const maxGiu = Math.max(...punti.map((p) => p.usciti), 1);
	const tot = maxSu + maxGiu;
	const zero = (maxSu / tot) * 100; // % dall'alto

	const tratteggio = (colore: string) => ({
		background: `repeating-linear-gradient(-45deg, ${colore} 0 3px, var(--surface) 3px 6px)`,
		boxShadow: `inset 0 0 0 1.5px ${colore}`,
	});

	return (
		<figure ref={ref} className="m-0">
			<ul className="m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-ink-2">
				<li className="flex items-center gap-1.5">
					<span className="size-2.5 rounded-sm bg-accent" /> Nuovi (prima volta)
				</li>
				<li className="flex items-center gap-1.5">
					<span className="size-2.5 rounded-sm" style={{ background: "var(--serie-2)" }} /> Rientri
				</li>
				<li className="flex items-center gap-1.5">
					<span className="size-2.5 rounded-sm bg-warn" /> Usciti
				</li>
			</ul>

			<div className="flex" role="img" aria-label={`${titolo}: grafico a colonne, ${punti.length} mesi`}>
				<div className="relative h-64 min-w-0 flex-1">
					<div className="absolute inset-x-0 border-t border-ink-3" style={{ top: `${zero}%` }} aria-hidden="true" />
					<div className="absolute inset-0 flex">
						{punti.map((p, i) => {
							const hNuovi = (p.nuovi / tot) * 100;
							const hRientri = (p.rientri / tot) * 100;
							const hUsciti = (p.usciti / tot) * 100;
							const spento = attivo !== null && attivo !== i;
							return (
								<button
									key={p.nomeCompleto}
									type="button"
									className="relative h-full min-w-0 flex-1 px-px outline-offset-0 sm:px-0.5"
									aria-label={`${p.nomeCompleto}: ${p.nuovi} nuovi, ${p.rientri} rientri, ${p.usciti} usciti, ${p.attivi} iscritti a fine mese${p.incompleto ? " (mese in corso)" : ""}`}
									onMouseEnter={() => setAttivo(i)}
									onMouseLeave={() => setAttivo(null)}
									onFocus={() => setAttivo(i)}
									onBlur={() => setAttivo(null)}
								>
									<div className={`absolute inset-y-0 inset-x-px sm:inset-x-0.5 transition-opacity ${spento ? "opacity-40" : ""}`}>
										<motion.span
											className="absolute inset-x-0 block origin-bottom rounded-t-[3px]"
											style={{
												bottom: `${100 - zero}%`,
												height: `${hNuovi}%`,
												...(p.incompleto ? tratteggio("var(--accent)") : { background: "var(--accent)" }),
											}}
											initial={{ scaleY: 0 }}
											animate={{ scaleY: visto ? 1 : 0 }}
											transition={{ duration: ridotto ? 0 : 0.7, delay: ridotto ? 0 : i * 0.02 }}
										/>
										<motion.span
											className="absolute inset-x-0 block origin-bottom rounded-t-[3px]"
											style={{
												bottom: `calc(${100 - zero}% + ${hNuovi}%)`,
												height: `${hRientri}%`,
												...(p.incompleto ? tratteggio("var(--serie-2)") : { background: "var(--serie-2)" }),
											}}
											initial={{ scaleY: 0 }}
											animate={{ scaleY: visto ? 1 : 0 }}
											transition={{ duration: ridotto ? 0 : 0.7, delay: ridotto ? 0 : i * 0.02 + 0.05 }}
										/>
										<motion.span
											className="absolute inset-x-0 block origin-top rounded-b-[3px]"
											style={{
												top: `${zero}%`,
												height: `${hUsciti}%`,
												...(p.incompleto ? tratteggio("var(--warn)") : { background: "var(--warn)" }),
											}}
											initial={{ scaleY: 0 }}
											animate={{ scaleY: visto ? 1 : 0 }}
											transition={{ duration: ridotto ? 0 : 0.7, delay: ridotto ? 0 : i * 0.02 }}
										/>
									</div>

									{attivo === i && (
										<span
											role="presentation"
											className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs shadow-lift ${
												i < 4 ? "left-0" : i > punti.length - 5 ? "right-0" : "left-1/2 -translate-x-1/2"
											}`}
											style={{ top: 0 }}
										>
											<span className="block font-semibold text-ink">
												{p.nomeCompleto}
												{p.incompleto ? " · in corso" : ""}
											</span>
											<span className="mt-1 block text-ink-2">Nuovi: <b className="tabular-nums text-ink">{intero.format(p.nuovi)}</b></span>
											<span className="block text-ink-2">Rientri: <b className="tabular-nums text-ink">{intero.format(p.rientri)}</b></span>
											<span className="block text-ink-2">Usciti: <b className="tabular-nums text-ink">{intero.format(p.usciti)}</b></span>
											<span className="mt-1 block border-t border-line pt-1 text-ink-2">
												Iscritti a fine mese: <b className="tabular-nums text-ink">{intero.format(p.attivi)}</b>
											</span>
										</span>
									)}
								</button>
							);
						})}
					</div>
				</div>
			</div>

			<div className="mt-2 flex" aria-hidden="true">
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

			<figcaption className="sr-only">{titolo}</figcaption>
			<table className="sr-only">
				<caption>{titolo}</caption>
				<thead>
					<tr>
						<th scope="col">Mese</th>
						<th scope="col">Nuovi</th>
						<th scope="col">Rientri</th>
						<th scope="col">Usciti</th>
						<th scope="col">Iscritti a fine mese</th>
					</tr>
				</thead>
				<tbody>
					{punti.map((p) => (
						<tr key={p.nomeCompleto}>
							<th scope="row">{p.nomeCompleto}</th>
							<td>{p.nuovi}</td>
							<td>{p.rientri}</td>
							<td>{p.usciti}</td>
							<td>{p.attivi}</td>
						</tr>
					))}
				</tbody>
			</table>
		</figure>
	);
}

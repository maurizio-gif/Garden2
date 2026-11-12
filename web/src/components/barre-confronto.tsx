"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

export type ColonnaConfronto = {
	etichetta: string;
	secondaRiga?: string;
	nomeCompleto: string;
	valore: number;
	/** Valore dello stesso punto nel periodo di confronto. */
	confronto?: number | null;
	/** Nome del punto di confronto («novembre 2025»). */
	nomeConfronto?: string;
};

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" });
const intero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: "always" });
const compatto = new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 });

function scala(max: number) {
	const grezzo = Math.max(max, 1) / 4;
	const ordine = 10 ** Math.floor(Math.log10(grezzo));
	const n = grezzo / ordine;
	const passo = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * ordine;
	let tetto = Math.ceil(max / passo) * passo || passo;
	if (max / tetto > 0.9) tetto += passo;
	const tacche: number[] = [];
	for (let v = 0; v <= tetto + passo / 2; v += passo) tacche.push(v);
	return { tetto, tacche };
}

/**
 * Colonne per l'analisi personalizzata: una per periodo (giorno, settimana,
 * mese, anno), con accanto la colonna grigia del periodo di confronto quando
 * c'è. Se le colonne sono tante le etichette si diradano da sole.
 */
export function BarreConfronto({
	colonne,
	formato,
	nomeMisura,
	nomeCorrente,
	nomeConfronto,
}: {
	colonne: ColonnaConfronto[];
	formato: "euro" | "numero";
	nomeMisura: string;
	nomeCorrente: string;
	nomeConfronto?: string;
}) {
	const ridotto = useReducedMotion();
	const ref = useRef<HTMLDivElement>(null);
	const visto = useInView(ref, { once: true, amount: 0.15 });
	const [attivo, setAttivo] = useState<number | null>(null);
	const fmt = (v: number) => (formato === "euro" ? euro.format(v) : intero.format(v));
	const conConfronto = colonne.some((c) => c.confronto != null);
	const max = Math.max(...colonne.flatMap((c) => [c.valore, c.confronto ?? 0]), 0);
	const { tetto, tacche } = scala(max);
	const ogni = Math.max(1, Math.ceil(colonne.length / 14));

	return (
		<figure ref={ref} className="m-0">
			{conConfronto && (
				<ul className="m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-ink-2">
					<li className="flex items-center gap-1.5">
						<span className="size-2.5 rounded-sm bg-accent" /> {nomeCorrente}
					</li>
					<li className="flex items-center gap-1.5">
						<span className="size-2.5 rounded-sm" style={{ background: "var(--serie-4)", opacity: 0.55 }} /> {nomeConfronto}
					</li>
				</ul>
			)}
			<div className="flex" role="img" aria-label={`${nomeMisura}: grafico a colonne, ${colonne.length} periodi`}>
				<div className="mr-2 flex w-12 shrink-0 flex-col text-right text-[11px] text-ink-3" aria-hidden="true">
					<div className="relative min-h-60 flex-1">
						{tacche.map((t) => (
							<span key={t} className="absolute right-0 translate-y-1/2 tabular-nums" style={{ bottom: `${(t / tetto) * 100}%` }}>
								{t === 0 ? "0" : compatto.format(t)}
							</span>
						))}
					</div>
					<div className="mt-2 h-8" />
				</div>

				<div className="flex min-w-0 flex-1 flex-col">
					<div className="relative min-h-60 flex-1">
						{tacche.map((t) => (
							<div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(t / tetto) * 100}%` }} aria-hidden="true" />
						))}
						<div className="absolute inset-0 flex">
							{colonne.map((c, i) => {
								const spento = attivo !== null && attivo !== i;
								const h = (c.valore / tetto) * 100;
								const hc = ((c.confronto ?? 0) / tetto) * 100;
								return (
									<button
										key={c.nomeCompleto}
										type="button"
										className="relative flex h-full min-w-0 flex-1 items-end justify-center gap-px px-px outline-offset-0"
										aria-label={`${c.nomeCompleto}: ${fmt(c.valore)}${c.confronto != null ? `, confronto ${fmt(c.confronto)}` : ""}`}
										onMouseEnter={() => setAttivo(i)}
										onMouseLeave={() => setAttivo(null)}
										onFocus={() => setAttivo(i)}
										onBlur={() => setAttivo(null)}
									>
										{conConfronto && (
											<motion.span
												className={`block w-full max-w-5 rounded-t-[3px] transition-opacity ${spento ? "opacity-20" : "opacity-55"}`}
												style={{ background: "var(--serie-4)" }}
												initial={{ height: 0 }}
												animate={{ height: visto ? `${hc}%` : 0 }}
												transition={{ duration: ridotto ? 0 : 0.6, delay: ridotto ? 0 : Math.min(i * 0.02, 0.6) }}
											/>
										)}
										<motion.span
											className={`block w-full max-w-5 rounded-t-[3px] bg-accent transition-opacity ${spento ? "opacity-40" : ""}`}
											initial={{ height: 0 }}
											animate={{ height: visto ? `${h}%` : 0 }}
											transition={{ duration: ridotto ? 0 : 0.7, delay: ridotto ? 0 : Math.min(i * 0.02, 0.6) }}
										/>
										{attivo === i && (
											<span
												role="presentation"
												className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-xs shadow-lift ${
													i < 3 ? "left-0" : i > colonne.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2"
												}`}
												style={{ bottom: `calc(${Math.max(h, hc)}% + 8px)` }}
											>
												<span className="block text-ink-3">{c.nomeCompleto}</span>
												<span className="block text-sm font-semibold tabular-nums text-ink">{fmt(c.valore)}</span>
												{c.confronto != null && (
													<span className="mt-0.5 block text-ink-3">
														{c.nomeConfronto ?? nomeConfronto}: <b className="tabular-nums text-ink-2">{fmt(c.confronto)}</b>
													</span>
												)}
											</span>
										)}
									</button>
								);
							})}
						</div>
					</div>
					<div className="mt-2 flex h-8" aria-hidden="true">
						{colonne.map((c, i) => (
							<div key={c.nomeCompleto} className="min-w-0 flex-1 text-center text-[11px] leading-tight text-ink-3">
								{i % ogni === 0 && (
									<>
										<span className="block whitespace-nowrap">{c.etichetta}</span>
										<span className="block h-3">{c.secondaRiga}</span>
									</>
								)}
							</div>
						))}
					</div>
				</div>
			</div>

			<figcaption className="sr-only">{nomeMisura}</figcaption>
			<table className="sr-only">
				<caption>{nomeMisura}</caption>
				<thead>
					<tr>
						<th scope="col">Periodo</th>
						<th scope="col">{nomeCorrente}</th>
						{conConfronto && <th scope="col">{nomeConfronto}</th>}
					</tr>
				</thead>
				<tbody>
					{colonne.map((c) => (
						<tr key={c.nomeCompleto}>
							<th scope="row">{c.nomeCompleto}</th>
							<td>{fmt(c.valore)}</td>
							{conConfronto && <td>{c.confronto == null ? "—" : fmt(c.confronto)}</td>}
						</tr>
					))}
				</tbody>
			</table>
		</figure>
	);
}

"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

export type SerieImpilata = { nome: string; colore: string; opaca?: boolean };

export type ColonnaImpilata = {
	etichetta: string;
	secondaRiga?: string;
	nomeCompleto: string;
	/** Un valore per serie, nello stesso ordine di `serie` (dal basso verso l'alto). */
	valori: number[];
	/** Testo breve sopra la colonna («42%»). */
	sopra?: string;
	/** Righe in più nel tooltip, sotto il totale. */
	note?: string[];
	/** Periodo non ancora finito: la colonna è tratteggiata. */
	incompleto?: boolean;
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
	if (max / tetto > 0.86) tetto += passo;
	const tacche: number[] = [];
	for (let v = 0; v <= tetto + passo / 2; v += passo) tacche.push(v);
	return { tetto, tacche };
}

/**
 * Colonne impilate (nuovi + rinnovi, rinnovati + da rinnovare…), che crescono
 * dal basso quando il grafico entra nello schermo. Passando sopra una colonna
 * (o con la tastiera) il tooltip mostra ogni pezzo, il totale e le note.
 */
export function BarreImpilate({
	colonne,
	serie,
	formato,
	nomeMisura,
}: {
	colonne: ColonnaImpilata[];
	serie: SerieImpilata[];
	formato: "euro" | "numero";
	nomeMisura: string;
}) {
	const ridotto = useReducedMotion();
	const ref = useRef<HTMLDivElement>(null);
	const visto = useInView(ref, { once: true, amount: 0.15 });
	const [attivo, setAttivo] = useState<number | null>(null);
	const fmt = (v: number) => (formato === "euro" ? euro.format(v) : intero.format(v));
	const totale = (c: ColonnaImpilata) => c.valori.reduce((s, v) => s + v, 0);
	const max = Math.max(...colonne.map(totale), 0);
	const { tetto, tacche } = scala(max);
	const ogni = Math.max(1, Math.ceil(colonne.length / 14));
	const conSopra = colonne.some((c) => c.sopra);

	return (
		<figure ref={ref} className="m-0">
			<ul className="m-0 mb-3 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-ink-2">
				{serie.map((s) => (
					<li key={s.nome} className="flex items-center gap-1.5">
						<span className="size-2.5 rounded-sm" style={{ background: s.colore, opacity: s.opaca ? 0.45 : 1 }} /> {s.nome}
					</li>
				))}
			</ul>
			<div className="flex" role="img" aria-label={`${nomeMisura}: colonne impilate, ${colonne.length} periodi`}>
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
					<div className={`relative min-h-60 flex-1 ${conSopra ? "mt-4" : ""}`}>
						{tacche.map((t) => (
							<div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(t / tetto) * 100}%` }} aria-hidden="true" />
						))}
						<div className="absolute inset-0 flex">
							{colonne.map((c, i) => {
								const tot = totale(c);
								const h = (tot / tetto) * 100;
								const spento = attivo !== null && attivo !== i;
								return (
									<button
										key={c.nomeCompleto}
										type="button"
										className="relative flex h-full min-w-0 flex-1 items-end justify-center px-[2px] outline-offset-0"
										aria-label={`${c.nomeCompleto}: ${serie.map((s, k) => `${s.nome} ${fmt(c.valori[k] ?? 0)}`).join(", ")}, totale ${fmt(tot)}`}
										onMouseEnter={() => setAttivo(i)}
										onMouseLeave={() => setAttivo(null)}
										onFocus={() => setAttivo(i)}
										onBlur={() => setAttivo(null)}
									>
										<motion.span
											className={`relative flex w-full max-w-7 flex-col-reverse overflow-hidden rounded-t-[3px] transition-opacity ${spento ? "opacity-40" : ""}`}
											initial={{ height: 0 }}
											animate={{ height: visto ? `${h}%` : 0 }}
											transition={{ duration: ridotto ? 0 : 0.7, delay: ridotto ? 0 : Math.min(i * 0.025, 0.6) }}
										>
											{serie.map((s, k) => (
												<span
													key={s.nome}
													className="block w-full"
													style={{
														height: tot > 0 ? `${((c.valori[k] ?? 0) / tot) * 100}%` : 0,
														background: s.colore,
														opacity: s.opaca ? 0.45 : 1,
														backgroundImage: c.incompleto
															? "repeating-linear-gradient(135deg, transparent 0 3px, rgb(255 255 255 / 0.35) 3px 5px)"
															: undefined,
													}}
												/>
											))}
										</motion.span>
										{c.sopra && (
											<span
												className="pointer-events-none absolute inset-x-0 text-center text-[10px] font-medium tabular-nums text-ink-2"
												style={{ bottom: `calc(${h}% + 3px)` }}
												aria-hidden="true"
											>
												{c.sopra}
											</span>
										)}
										{attivo === i && (
											<span
												role="presentation"
												className={`pointer-events-none absolute z-10 min-w-44 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-xs shadow-lift ${
													i < 3 ? "left-0" : i > colonne.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2"
												}`}
												style={{ bottom: `calc(${Math.min(h, 80)}% + 18px)` }}
											>
												<span className="mb-1 block text-ink-3">{c.nomeCompleto}</span>
												{serie.map((s, k) => (
													<span key={s.nome} className="flex items-center justify-between gap-4">
														<span className="flex items-center gap-1.5 text-ink-2">
															<span className="size-2 rounded-sm" style={{ background: s.colore, opacity: s.opaca ? 0.45 : 1 }} />
															{s.nome}
														</span>
														<b className="tabular-nums text-ink">{fmt(c.valori[k] ?? 0)}</b>
													</span>
												))}
												<span className="mt-1 flex justify-between gap-4 border-t border-line pt-1 text-ink-2">
													Totale <b className="tabular-nums text-ink">{fmt(tot)}</b>
												</span>
												{c.note?.map((n) => (
													<span key={n} className="mt-0.5 block text-ink-3">
														{n}
													</span>
												))}
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
						{serie.map((s) => (
							<th key={s.nome} scope="col">
								{s.nome}
							</th>
						))}
						<th scope="col">Totale</th>
					</tr>
				</thead>
				<tbody>
					{colonne.map((c) => (
						<tr key={c.nomeCompleto}>
							<th scope="row">{c.nomeCompleto}</th>
							{serie.map((s, k) => (
								<td key={s.nome}>{fmt(c.valori[k] ?? 0)}</td>
							))}
							<td>{fmt(totale(c))}</td>
						</tr>
					))}
				</tbody>
			</table>
		</figure>
	);
}

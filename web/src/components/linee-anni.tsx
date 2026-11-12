"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

export type SerieAnno = {
	/** «2026». */
	nome: string;
	/** Indice del colore: 0 = anno in corso. */
	indice: number;
	/** Dodici valori, gennaio→dicembre; `null` dove il mese non è ancora arrivato. */
	valori: (number | null)[];
};

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const intero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });
const compatto = new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 });

const L = 640;
const A = 260;
const M = { s: 8, d: 12, su: 14, giu: 26 };

function scala(max: number) {
	const grezzo = Math.max(max, 1) / 4;
	const ordine = 10 ** Math.floor(Math.log10(grezzo));
	const n = grezzo / ordine;
	const passo = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * ordine;
	const tetto = Math.ceil(max / passo) * passo || passo;
	const tacche: number[] = [];
	for (let v = 0; v <= tetto + passo / 2; v += passo) tacche.push(v);
	return { tetto, tacche };
}

const TRATTI = ["", "7 4", "2 3", "10 3 2 3", "1 4", "5 5"];

/**
 * Un anno per linea, mesi sull'asse: serve a vedere a colpo d'occhio se
 * quest'anno va sopra o sotto gli altri nello stesso mese. L'anno in corso è la
 * linea piena e più spessa; gli altri sono più sottili e con un tratto diverso.
 * Passando sopra un mese (mouse o tastiera) il tooltip elenca tutti gli anni.
 */
export function LineeAnni({
	serie,
	formato,
	titolo,
	meseCorrente,
}: {
	serie: SerieAnno[];
	formato: "euro" | "numero";
	titolo: string;
	/** 0–11: il mese in corso, dove la linea dell'anno corrente è provvisoria. */
	meseCorrente: number;
}) {
	const ridotto = useReducedMotion();
	const ref = useRef<SVGSVGElement>(null);
	const visto = useInView(ref, { once: true, amount: 0.2 });
	const [attivo, setAttivo] = useState<number | null>(null);
	const [spente, setSpente] = useState<Set<number>>(new Set());
	const fmt = (v: number) => (formato === "euro" ? euro.format(v) : intero.format(v));

	const visibili = serie.filter((s) => !spente.has(s.indice));
	const max = Math.max(...visibili.flatMap((s) => s.valori.filter((v): v is number => v != null)), 0);
	const { tetto, tacche } = scala(max);
	const x = (i: number) => M.s + 36 + (i / 11) * (L - M.s - M.d - 36);
	const y = (v: number) => M.su + (1 - v / tetto) * (A - M.su - M.giu);

	function percorso(s: SerieAnno, senzaMeseInCorso = true) {
		let d = "";
		let aperto = false;
		s.valori.forEach((v, i) => {
			// Il mese in corso non è finito: la linea piena si ferma al mese prima, l'ultimo tratto è tratteggiato.
			if (v == null || (senzaMeseInCorso && s.indice === 0 && i === meseCorrente)) {
				aperto = false;
				return;
			}
			d += `${aperto ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
			aperto = true;
		});
		return d;
	}

	function alterna(i: number) {
		setSpente((prima) => {
			const n = new Set(prima);
			if (n.has(i)) n.delete(i);
			else if (serie.length - n.size > 1) n.add(i);
			return n;
		});
	}

	return (
		<figure className="m-0">
			<ul className="m-0 mb-3 flex list-none flex-wrap gap-2 p-0 text-xs">
				{serie.map((s) => {
					const spenta = spente.has(s.indice);
					return (
						<li key={s.nome}>
							<button
								type="button"
								aria-pressed={!spenta}
								onClick={() => alterna(s.indice)}
								className={`inline-flex items-center gap-2 rounded-full border border-line px-2.5 py-1 font-medium transition-opacity ${
									spenta ? "opacity-40" : "opacity-100"
								}`}
							>
								<svg viewBox="0 0 22 6" className="h-1.5 w-5" aria-hidden="true">
									<line
										x1="0"
										y1="3"
										x2="22"
										y2="3"
										stroke={`var(--serie-${s.indice})`}
										strokeWidth={s.indice === 0 ? 3 : 2}
										strokeDasharray={TRATTI[s.indice]}
										strokeLinecap="round"
									/>
								</svg>
								{s.nome}
							</button>
						</li>
					);
				})}
			</ul>

			<div className="relative">
				<svg
					ref={ref}
					viewBox={`0 0 ${L} ${A}`}
					className="block h-auto w-full"
					role="img"
					aria-label={`${titolo}: una linea per anno, dodici mesi`}
				>
					{tacche.map((t) => (
						<g key={t}>
							<line x1={M.s + 36} x2={L - M.d} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
							<text x={M.s + 30} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--text-3)" className="tabular-nums">
								{t === 0 ? "0" : compatto.format(t)}
							</text>
						</g>
					))}
					{MESI.map((m, i) => (
						<text
							key={m}
							x={x(i)}
							y={A - 8}
							textAnchor="middle"
							fontSize="10.5"
							fill={i === meseCorrente ? "var(--text)" : "var(--text-3)"}
							fontWeight={i === meseCorrente ? 600 : 400}
						>
							{m}
						</text>
					))}

					{attivo !== null && (
						<line x1={x(attivo)} x2={x(attivo)} y1={M.su} y2={A - M.giu} stroke="var(--text-3)" strokeWidth="1" strokeDasharray="3 3" />
					)}

					{[...visibili].reverse().map((s) => (
						<motion.path
							key={s.nome}
							d={percorso(s)}
							fill="none"
							stroke={`var(--serie-${s.indice})`}
							strokeWidth={s.indice === 0 ? 3 : 1.8}
							strokeDasharray={TRATTI[s.indice]}
							strokeLinecap="round"
							strokeLinejoin="round"
							initial={{ pathLength: ridotto ? 1 : 0, opacity: ridotto ? 1 : 0 }}
							animate={visto ? { pathLength: 1, opacity: 1 } : {}}
							transition={{ duration: ridotto ? 0 : 1.1, delay: s.indice * 0.08, ease: [0.22, 1, 0.36, 1] }}
						/>
					))}

					{/* ultimo tratto dell'anno in corso: provvisorio, tratteggiato */}
					{visibili
						.filter((s) => s.indice === 0 && meseCorrente > 0 && s.valori[meseCorrente] != null && s.valori[meseCorrente - 1] != null)
						.map((s) => (
							<path
								key="provvisorio"
								d={`M${x(meseCorrente - 1).toFixed(1)} ${y(s.valori[meseCorrente - 1] as number).toFixed(1)}L${x(meseCorrente).toFixed(1)} ${y(s.valori[meseCorrente] as number).toFixed(1)}`}
								fill="none"
								stroke="var(--serie-0)"
								strokeWidth="3"
								strokeDasharray="2 5"
								strokeLinecap="round"
							/>
						))}

					{/* punto sull'ultimo valore dell'anno in corso */}
					{visibili
						.filter((s) => s.indice === 0)
						.map((s) => {
							const i = s.valori.reduce<number>((u, v, k) => (v != null ? k : u), -1);
							if (i < 0) return null;
							return (
								<circle
									key="ora"
									cx={x(i)}
									cy={y(s.valori[i] as number)}
									r="4.5"
									fill="var(--surface)"
									stroke="var(--serie-0)"
									strokeWidth="2.5"
								/>
							);
						})}

					{/* colonne sensibili: una per mese, raggiungibili anche da tastiera */}
					{MESI.map((m, i) => (
						<rect
							key={m}
							x={x(i) - (L - M.s - M.d - 36) / 22}
							y={M.su}
							width={(L - M.s - M.d - 36) / 11}
							height={A - M.su - M.giu}
							fill="transparent"
							tabIndex={0}
							role="presentation"
							onMouseEnter={() => setAttivo(i)}
							onMouseLeave={() => setAttivo(null)}
							onFocus={() => setAttivo(i)}
							onBlur={() => setAttivo(null)}
						/>
					))}
				</svg>

				{attivo !== null && (
					<div
						role="presentation"
						className="pointer-events-none absolute top-2 z-10 min-w-40 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lift"
						style={{
							left: `${(x(attivo) / L) * 100}%`,
							transform: attivo > 7 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
						}}
					>
						<p className="mb-1 font-semibold text-ink">
							{MESI[attivo]}
							{attivo === meseCorrente ? " · in corso" : ""}
						</p>
						{[...visibili]
							.sort((a, b) => (b.valori[attivo] ?? -1) - (a.valori[attivo] ?? -1))
							.map((s) => (
								<p key={s.nome} className="flex items-center justify-between gap-4">
									<span className="flex items-center gap-1.5 text-ink-2">
										<span className="size-2 rounded-full" style={{ background: `var(--serie-${s.indice})` }} />
										{s.nome}
									</span>
									<span className="font-medium tabular-nums text-ink">
										{s.valori[attivo] == null ? "—" : fmt(s.valori[attivo] as number)}
									</span>
								</p>
							))}
					</div>
				)}
			</div>

			<figcaption className="sr-only">{titolo}</figcaption>
			<table className="sr-only">
				<caption>{titolo}</caption>
				<thead>
					<tr>
						<th scope="col">Mese</th>
						{serie.map((s) => (
							<th key={s.nome} scope="col">
								{s.nome}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{MESI.map((m, i) => (
						<tr key={m}>
							<th scope="row">{m}</th>
							{serie.map((s) => (
								<td key={s.nome}>{s.valori[i] == null ? "—" : fmt(s.valori[i] as number)}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</figure>
	);
}

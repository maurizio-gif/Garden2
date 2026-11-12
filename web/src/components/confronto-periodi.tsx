"use client";

import { useState } from "react";
import { Delta } from "./delta";

export type RigaPeriodo = {
	nome: string;
	/** Un valore per anno: il primo è l'anno in corso, poi uno, due, tre anni fa. */
	valori: number[];
	totale?: boolean;
	/** Niente freccia verso l'anno scorso: per i numeri in cui salire non è né bene né male. */
	senzaDelta?: boolean;
};

export type MisuraPeriodo = {
	id: string;
	nome: string;
	formato: "euro" | "numero";
	righe: { mtd: RigaPeriodo[]; ytd: RigaPeriodo[] };
};

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" });
const intero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

function Segmenti<T extends string>({
	etichetta,
	valore,
	opzioni,
	onChange,
}: {
	etichetta: string;
	valore: T;
	opzioni: { id: T; nome: string }[];
	onChange: (v: T) => void;
}) {
	return (
		<div role="group" aria-label={etichetta} className="inline-flex rounded-xl bg-surface-2 p-1 text-sm">
			{opzioni.map((o) => (
				<button
					key={o.id}
					type="button"
					aria-pressed={valore === o.id}
					onClick={() => onChange(o.id)}
					className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
						valore === o.id ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink"
					}`}
				>
					{o.nome}
				</button>
			))}
		</div>
	);
}

/**
 * Tabella «anno in corso contro gli anni scorsi», con l'interruttore tra il mese
 * (dal 1 a oggi) e l'anno (dal 1 gennaio a oggi). Accanto al valore di quest'anno
 * c'è la differenza con l'anno scorso, nello stesso identico tratto di calendario.
 */
export function ConfrontoPeriodi({
	anni,
	intervalli,
	misure,
	nota,
}: {
	anni: string[];
	/** Come si scrive il tratto di calendario sotto ogni anno: «1–12 nov». */
	intervalli: { mtd: string[]; ytd: string[] };
	misure: MisuraPeriodo[];
	nota?: string;
}) {
	const [periodo, setPeriodo] = useState<"mtd" | "ytd">("ytd");
	const [misuraId, setMisuraId] = useState(misure[0].id);
	const misura = misure.find((m) => m.id === misuraId) ?? misure[0];
	const fmt = (v: number) => (misura.formato === "euro" ? euro.format(v) : intero.format(v));
	const righe = misura.righe[periodo];

	return (
		<div>
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<Segmenti
					etichetta="Periodo"
					valore={periodo}
					onChange={setPeriodo}
					opzioni={[
						{ id: "mtd", nome: "Mese in corso" },
						{ id: "ytd", nome: "Da inizio anno" },
					]}
				/>
				{misure.length > 1 && (
					<Segmenti etichetta="Cosa mostrare" valore={misuraId} onChange={setMisuraId} opzioni={misure.map((m) => ({ id: m.id, nome: m.nome }))} />
				)}
			</div>

			<div className="-mx-2 overflow-x-auto px-2">
				<table className="w-full min-w-[34rem] border-collapse text-sm">
					<thead>
						<tr className="border-b border-line">
							<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
								{misura.nome}
							</th>
							{anni.map((a, i) => (
								<th key={a} scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
									{a}
									<span className="block font-normal">{intervalli[periodo][i]}</span>
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{righe.map((r) => (
							<tr key={r.nome} className={`border-b border-line last:border-0 ${r.totale ? "bg-surface-2/60 font-semibold" : ""}`}>
								<th scope="row" className={`px-3 py-2.5 text-left ${r.totale ? "" : "font-normal text-ink-2"}`}>
									{r.nome}
								</th>
								{r.valori.map((v, i) => (
									<td key={i} className="px-3 py-2.5 text-right tabular-nums">
										{fmt(v)}
										{i === 0 && r.valori.length > 1 && !r.senzaDelta && (
											<span className="mt-0.5 block font-normal">
												<Delta ora={v} prima={r.valori[1]} />
											</span>
										)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{nota && <p className="mt-3 text-xs text-ink-3">{nota}</p>}
		</div>
	);
}

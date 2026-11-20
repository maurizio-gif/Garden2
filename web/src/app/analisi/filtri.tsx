"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
	CAMPI,
	CONFRONTI,
	METRICHE,
	PRESET,
	RAGGRUPPA,
	filtriInQuery,
	periodoDaPreset,
	type Filtri,
	type Preset,
} from "@/lib/analisi";
import type { Opzioni } from "@/lib/types";
import { salvaVista } from "./actions";

const campo =
	"w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent";
const etichetta = "mb-1.5 block text-xs font-medium text-ink-2";

/**
 * Pannello dei filtri. Lo stato sta qui e si riflette nell'indirizzo: ogni
 * cambio aggiorna la pagina (i campi di testo con un attimo di attesa, per non
 * ricaricare a ogni lettera). Così una vista è sempre un link.
 */
export function FiltriAnalisi({
	iniziali,
	opzioni,
	oggi,
	puoSalvare,
}: {
	iniziali: Filtri;
	opzioni: Opzioni;
	oggi: string;
	puoSalvare: boolean;
}) {
	const router = useRouter();
	const [f, setF] = useState<Filtri>(iniziali);
	const [inAttesa, avvia] = useTransition();
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Se l'indirizzo cambia da fuori (una vista salvata, «indietro»), il pannello segue.
	const firma = filtriInQuery(iniziali);
	const ultimaFirma = useRef(firma);
	useEffect(() => {
		if (firma !== ultimaFirma.current) {
			ultimaFirma.current = firma;
			setF(iniziali);
		}
	}, [firma, iniziali]);

	function vai(nuovo: Filtri, ritardo = 0) {
		setF(nuovo);
		if (timer.current) clearTimeout(timer.current);
		const spingi = () => {
			const q = filtriInQuery({ ...nuovo, pagina: 1 });
			ultimaFirma.current = q;
			avvia(() => router.replace(q ? `/analisi?${q}` : "/analisi", { scroll: false }));
		};
		if (ritardo) timer.current = setTimeout(spingi, ritardo);
		else spingi();
	}
	useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

	const categorieVisibili = useMemo(
		() => opzioni.categorie.filter((c) => f.gruppi.length === 0 || f.gruppi.includes(c.gruppo)),
		[opzioni.categorie, f.gruppi],
	);

	const attivi =
		f.gruppi.length +
		f.categorie.length +
		f.operatori.length +
		(f.q ? 1 : 0) +
		(f.min || f.max ? 1 : 0) +
		(f.conQuote ? 0 : 1);

	function scegliPreset(v: string) {
		if (v === "") return vai({ ...f, preset: null });
		const p = periodoDaPreset(v as Preset, oggi);
		vai({ ...f, preset: v as Preset, ...p });
	}

	const querySalva = filtriInQuery(f, { senzaPagina: true });
	const esporta = `/analisi/export?${filtriInQuery(f, { senzaPagina: true })}`;

	return (
		<section
			aria-label="Filtri dell'analisi"
			className="relative rounded-2xl border border-line bg-surface p-5 shadow-card"
		>
			{inAttesa && (
				<span
					className="absolute inset-x-5 top-0 h-0.5 animate-pulse rounded-full bg-accent"
					role="status"
					aria-label="Aggiornamento in corso"
				/>
			)}

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div>
					<label htmlFor="f-preset" className={etichetta}>
						Periodo
					</label>
					<select id="f-preset" className={campo} value={f.preset ?? ""} onChange={(e) => scegliPreset(e.target.value)}>
						<option value="">Date a scelta</option>
						{PRESET.map((p) => (
							<option key={p.valore} value={p.valore}>
								{p.nome}
							</option>
						))}
					</select>
				</div>
				<div>
					<label htmlFor="f-da" className={etichetta}>
						Dal
					</label>
					<input
						id="f-da"
						type="date"
						className={campo}
						value={f.da}
						max={f.a}
						onChange={(e) => e.target.value && vai({ ...f, preset: null, da: e.target.value }, 500)}
					/>
				</div>
				<div>
					<label htmlFor="f-a" className={etichetta}>
						Al
					</label>
					<input
						id="f-a"
						type="date"
						className={campo}
						value={f.a}
						min={f.da}
						onChange={(e) => e.target.value && vai({ ...f, preset: null, a: e.target.value }, 500)}
					/>
				</div>
				<div>
					<label htmlFor="f-campo" className={etichetta}>
						Il periodo vale per la
					</label>
					<select id="f-campo" className={campo} value={f.campo} onChange={(e) => vai({ ...f, campo: e.target.value as Filtri["campo"] })}>
						{CAMPI.map((c) => (
							<option key={c.valore} value={c.valore}>
								{c.nome}
							</option>
						))}
					</select>
				</div>

				<div>
					<label htmlFor="f-raggruppa" className={etichetta}>
						Raggruppa per
					</label>
					<select
						id="f-raggruppa"
						className={campo}
						value={f.raggruppa}
						onChange={(e) => vai({ ...f, raggruppa: e.target.value as Filtri["raggruppa"] })}
					>
						<optgroup label="Nel tempo">
							{RAGGRUPPA.filter((r) => r.tempo).map((r) => (
								<option key={r.valore} value={r.valore}>
									{r.nome}
								</option>
							))}
						</optgroup>
						<optgroup label="Per tipo">
							{RAGGRUPPA.filter((r) => !r.tempo).map((r) => (
								<option key={r.valore} value={r.valore}>
									{r.nome}
								</option>
							))}
						</optgroup>
					</select>
				</div>
				<div>
					<label htmlFor="f-metrica" className={etichetta}>
						Cosa misurare nel grafico
					</label>
					<select id="f-metrica" className={campo} value={f.metrica} onChange={(e) => vai({ ...f, metrica: e.target.value as Filtri["metrica"] })}>
						{METRICHE.map((m) => (
							<option key={m.valore} value={m.valore}>
								{m.nome}
							</option>
						))}
					</select>
				</div>
				<div className="sm:col-span-2">
					<label htmlFor="f-confronto" className={etichetta}>
						Confronta con
					</label>
					<select id="f-confronto" className={campo} value={f.confronto} onChange={(e) => vai({ ...f, confronto: e.target.value as Filtri["confronto"] })}>
						{CONFRONTI.map((c) => (
							<option key={c.valore} value={c.valore}>
								{c.nome}
							</option>
						))}
					</select>
				</div>
			</div>

			<hr className="my-5 border-line" />

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div className="sm:col-span-2">
					<label htmlFor="f-q" className={etichetta}>
						Cerca (nome, cognome, abbonamento, venditore)
					</label>
					<input
						id="f-q"
						type="search"
						className={campo}
						placeholder="es. rossi family nuoto"
						value={f.q}
						onChange={(e) => vai({ ...f, q: e.target.value }, 450)}
					/>
					<p className="mt-1 text-xs text-ink-3">Più parole: devono esserci tutte.</p>
				</div>
				<div>
					<label htmlFor="f-min" className={etichetta}>
						Importo da (€)
					</label>
					<input
						id="f-min"
						type="number"
						inputMode="decimal"
						min="0"
						className={campo}
						value={f.min}
						onChange={(e) => vai({ ...f, min: e.target.value }, 450)}
					/>
				</div>
				<div>
					<label htmlFor="f-max" className={etichetta}>
						Importo fino a (€)
					</label>
					<input
						id="f-max"
						type="number"
						inputMode="decimal"
						min="0"
						className={campo}
						value={f.max}
						onChange={(e) => vai({ ...f, max: e.target.value }, 450)}
					/>
				</div>
			</div>

			<fieldset className="mt-5">
				<legend className={etichetta}>Gruppo di prodotti</legend>
				<div className="flex flex-wrap gap-2">
					{opzioni.gruppi.map((g) => {
						const on = f.gruppi.includes(g);
						return (
							<button
								key={g}
								type="button"
								aria-pressed={on}
								onClick={() =>
									vai({
										...f,
										gruppi: on ? f.gruppi.filter((x) => x !== g) : [...f.gruppi, g],
										// le categorie scelte che non appartengono più ai gruppi attivi si tolgono
										categorie: [],
									})
								}
								className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
									on
										? "border-accent bg-accent-soft text-accent-strong"
										: "border-line text-ink-2 hover:border-ink-3 hover:text-ink"
								}`}
							>
								{g}
							</button>
						);
					})}
				</div>
			</fieldset>

			<div className="mt-5 grid gap-4 sm:grid-cols-2">
				<MultiScelta
					nome="Categoria"
					vuoto="Tutte le categorie"
					scelti={f.categorie}
					voci={categorieVisibili.map((c) => ({ valore: c.categoria, nota: c.gruppo }))}
					onChange={(categorie) => vai({ ...f, categorie })}
				/>
				<MultiScelta
					nome="Venditore"
					vuoto="Tutti i venditori"
					scelti={f.operatori}
					voci={opzioni.operatori.map((o) => ({ valore: o }))}
					onChange={(operatori) => vai({ ...f, operatori })}
				/>
			</div>

			<label className="mt-5 inline-flex items-center gap-2 text-sm text-ink-2">
				<input
					type="checkbox"
					className="size-4 accent-[var(--accent)]"
					checked={f.conQuote}
					onChange={(e) => vai({ ...f, conQuote: e.target.checked })}
				/>
				Includi quote associative e quote extra
			</label>

			<div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
				<div className="flex flex-wrap items-center gap-3 text-sm">
					<button
						type="button"
						onClick={() => vai({ ...iniziali, preset: "anno", ...periodoDaPreset("anno", oggi), campo: "vendita", raggruppa: "mese", metrica: "fatturato", confronto: "anno", gruppi: [], categorie: [], operatori: [], q: "", min: "", max: "", conQuote: true, pagina: 1, ordine: "data" })}
						className="font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
					>
						Azzera i filtri{attivi > 0 ? ` (${attivi})` : ""}
					</button>
					<a
						href={esporta}
						className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 font-medium text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
					>
						<svg viewBox="0 0 20 20" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
							<path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 16h12" />
						</svg>
						Scarica in CSV
					</a>
				</div>

				{puoSalvare ? (
					<form action={salvaVista} className="flex flex-wrap items-end gap-2">
						<input type="hidden" name="query" value={querySalva} />
						<div>
							<label htmlFor="f-nome-vista" className={etichetta}>
								Salva questa analisi come vista
							</label>
							<input
								id="f-nome-vista"
								name="nome"
								required
								maxLength={80}
								placeholder="es. Nuoto, stagione in corso"
								className={`${campo} w-64`}
							/>
						</div>
						<button
							type="submit"
							className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
						>
							Salva vista
						</button>
					</form>
				) : (
					<p className="text-xs text-ink-3">Le viste si salvano solo con Supabase collegato.</p>
				)}
			</div>
		</section>
	);
}

/** Menu a tendina con ricerca e caselle: per scegliere tra decine di categorie o venditori. */
function MultiScelta({
	nome,
	vuoto,
	scelti,
	voci,
	onChange,
}: {
	nome: string;
	vuoto: string;
	scelti: string[];
	voci: { valore: string; nota?: string }[];
	onChange: (v: string[]) => void;
}) {
	const [cerca, setCerca] = useState("");
	const dettagli = useRef<HTMLDetailsElement>(null);

	// Un clic fuori chiude il menu.
	useEffect(() => {
		const fuori = (e: PointerEvent) => {
			if (dettagli.current?.open && !dettagli.current.contains(e.target as Node)) dettagli.current.open = false;
		};
		document.addEventListener("pointerdown", fuori);
		return () => document.removeEventListener("pointerdown", fuori);
	}, []);

	const filtrate = voci.filter((v) => v.valore.toLowerCase().includes(cerca.trim().toLowerCase()));
	const scegli = (v: string) => onChange(scelti.includes(v) ? scelti.filter((x) => x !== v) : [...scelti, v]);

	return (
		<div>
			<span className={etichetta}>{nome}</span>
			<details ref={dettagli} className="group relative">
				<summary
					className={`${campo} flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden`}
				>
					<span className="truncate">
						{scelti.length === 0 ? vuoto : scelti.length === 1 ? scelti[0] : `${scelti.length} selezionate`}
					</span>
					<svg viewBox="0 0 20 20" className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
						<path d="m5 8 5 5 5-5" />
					</svg>
				</summary>
				<div className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-line bg-surface p-2 shadow-lift">
					<input
						type="search"
						className={`${campo} mb-2`}
						placeholder={`Cerca ${nome.toLowerCase()}…`}
						aria-label={`Cerca ${nome.toLowerCase()}`}
						value={cerca}
						onChange={(e) => setCerca(e.target.value)}
					/>
					<ul className="m-0 max-h-60 list-none overflow-y-auto p-0">
						{filtrate.length === 0 && <li className="px-2 py-3 text-sm text-ink-3">Nessun risultato.</li>}
						{filtrate.map((v) => (
							<li key={v.valore}>
								<label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
									<input
										type="checkbox"
										className="size-4 shrink-0 accent-[var(--accent)]"
										checked={scelti.includes(v.valore)}
										onChange={() => scegli(v.valore)}
									/>
									<span className="min-w-0 flex-1 truncate">{v.valore}</span>
									{v.nota && <span className="shrink-0 text-xs text-ink-3">{v.nota}</span>}
								</label>
							</li>
						))}
					</ul>
					{scelti.length > 0 && (
						<button
							type="button"
							onClick={() => onChange([])}
							className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
						>
							Deseleziona tutto
						</button>
					)}
				</div>
			</details>
		</div>
	);
}

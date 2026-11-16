import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarreConfronto } from "@/components/barre-confronto";
import { Card, Titolo } from "@/components/card";
import { Delta } from "@/components/delta";
import { Icone, Kpi } from "@/components/kpi";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { RankedBars } from "@/components/ranked-bars";
import { SchedeAnalisi } from "@/components/schede-analisi";
import { ScheletroLista } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { PRESET, colonneTempo, etichettaTempo } from "@/lib/analisi";
import { RIGHE_PER_PAGINA, leggiAnalisiIncassi, leggiOpzioniIncassi } from "@/lib/data";
import { dataBreve, dataOra, euro, frase, intero, nomeCompleto } from "@/lib/format";
import {
	METRICHE_INCASSI,
	RAGGRUPPA_INCASSI,
	SEGNI,
	filtriIncassiInQuery,
	isTempoIncassi,
	type FiltriIncassi,
} from "@/lib/incassi";
import type { AnalisiIncassi, OpzioniIncassi, RigaIncassi } from "@/lib/types";

export const metadata: Metadata = { title: "Analisi incassi" };

type Cerca = Record<string, string | string[] | undefined>;

export default function Pagina({ searchParams }: { searchParams: Promise<Cerca> }) {
	return (
		<>
			<div className="mb-4">
				<Titolo>Analisi</Titolo>
				<p className="mt-1 max-w-3xl text-sm text-ink-3">
					Cerca negli incassi: scegli il periodo, filtra per tipologia, metodo di pagamento, operatore o testo, raggruppa come
					preferisci e confronta con l&apos;anno scorso. Ogni ricerca è un link: copialo per riaprirla uguale.
				</p>
				<SchedeAnalisi attiva="incassi" />
			</div>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto searchParams={searchParams} />
			</Suspense>
		</>
	);
}

type Misure = Pick<RigaIncassi, "importo" | "movimenti" | "persone">;
const ZERO: Misure = { importo: 0, movimenti: 0, persone: 0 };

/** Mette insieme periodo scelto e confronto: nel tempo colonna con colonna, per tipo nome con nome. */
function unisci(f: FiltriIncassi, cur: AnalisiIncassi, prec: AnalisiIncassi | null, pp: { da: string; a: string } | null) {
	const mappa = (a: AnalisiIncassi | null) => new Map((a?.righe ?? []).map((r) => [r.chiave, r]));
	const c = mappa(cur);
	const p = mappa(prec);
	if (f.raggruppa === "niente") {
		return [{ chiave: "totale", nome: "Totale", breve: "Totale", secondaRiga: undefined as string | undefined, attuale: cur.totali as Misure, precedente: prec ? (prec.totali as Misure) : null, nomePrecedente: undefined as string | undefined }];
	}
	if (isTempoIncassi(f.raggruppa)) {
		const r = f.raggruppa;
		const colonne = colonneTempo(r, f.da, f.a);
		const colonnePrec = pp ? colonneTempo(r, pp.da, pp.a) : [];
		return colonne.map((chiave, i) => {
			const e = etichettaTempo(r, chiave);
			const kp = colonnePrec[i];
			return {
				chiave,
				nome: e.completo,
				breve: e.breve,
				secondaRiga: e.secondaRiga,
				attuale: (c.get(chiave) as Misure | undefined) ?? ZERO,
				precedente: prec && kp ? ((p.get(kp) as Misure | undefined) ?? ZERO) : null,
				nomePrecedente: kp ? etichettaTempo(r, kp).completo : undefined,
			};
		});
	}
	const nome = (k: string) => (f.raggruppa === "operatore" ? nomeCompleto(k, null) : k);
	return [...new Set([...c.keys(), ...p.keys()])]
		.map((chiave) => ({
			chiave,
			nome: nome(chiave),
			breve: nome(chiave),
			secondaRiga: undefined as string | undefined,
			attuale: (c.get(chiave) as Misure | undefined) ?? ZERO,
			precedente: prec ? ((p.get(chiave) as Misure | undefined) ?? ZERO) : null,
			nomePrecedente: undefined as string | undefined,
		}))
		.sort((a, b) => b.attuale[f.metrica] - a.attuale[f.metrica]);
}

const campo = "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent";
const etichetta = "mb-1.5 block text-xs font-medium text-ink-2";

async function Contenuto({ searchParams }: { searchParams: Promise<Cerca> }) {
	const cerca = await searchParams;
	const [r, opzioni] = await Promise.all([leggiAnalisiIncassi(cerca), leggiOpzioniIncassi()]);
	const { filtri: f, corrente, precedente, periodoPrecedente, elenco, modo, adesso } = r;

	const righe = unisci(f, corrente, precedente, periodoPrecedente);
	const metrica = METRICHE_INCASSI.find((m) => m.valore === f.metrica)!;
	const raggruppa = RAGGRUPPA_INCASSI.find((x) => x.valore === f.raggruppa)!;
	const nomeCorrente = `${dataBreve(f.da)} – ${dataBreve(f.a)}`;
	const nomePrecedente = periodoPrecedente ? `${dataBreve(periodoPrecedente.da)} – ${dataBreve(periodoPrecedente.a)}` : "";
	const nPagine = Math.max(1, Math.ceil(elenco.totale / RIGHE_PER_PAGINA));
	const link = (extra: Record<string, string>) => {
		const p = new URLSearchParams(filtriIncassiInQuery(f, { senzaPagina: true }));
		for (const [k, v] of Object.entries(extra)) {
			if (v) p.set(k, v);
			else p.delete(k);
		}
		return `/analisi/incassi?${p.toString()}`;
	};
	const totalePositivo = Math.max(corrente.totali.importo, 1);

	return (
		<Stagger className="flex flex-col gap-4">
			{modo === "demo" && (
				<StaggerItem>
					<StatoDati modo={modo} aggiornatoAl={null} adesso={adesso} />
				</StaggerItem>
			)}

			<StaggerItem>
				<FiltriIncassiForm f={f} opzioni={opzioni} />
			</StaggerItem>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Kpi
					etichetta="Incassato netto"
					valore={corrente.totali.importo}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={nomeCorrente}
					icona={Icone.incassi}
					delta={
						precedente && precedente.totali.importo !== 0
							? {
									percentuale: ((corrente.totali.importo - precedente.totali.importo) / Math.abs(precedente.totali.importo)) * 100,
									riferimento: `contro ${euro.format(precedente.totali.importo)} (${nomePrecedente})`,
								}
							: undefined
					}
				/>
				<Kpi
					etichetta="Entrate"
					valore={corrente.totali.entrate}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={`Uscite e storni: ${euro.format(corrente.totali.uscite)}`}
					icona={Icone.incassi}
					delta={
						precedente && precedente.totali.entrate > 0
							? {
									percentuale: ((corrente.totali.entrate - precedente.totali.entrate) / precedente.totali.entrate) * 100,
									riferimento: `contro ${euro.format(precedente.totali.entrate)}`,
								}
							: undefined
					}
				/>
				<Kpi
					etichetta="Movimenti"
					valore={corrente.totali.movimenti}
					nota={`Medio ${euro.format(corrente.totali.movimenti ? corrente.totali.importo / corrente.totali.movimenti : 0)}`}
					icona={Icone.rate}
					delta={
						precedente && precedente.totali.movimenti > 0
							? {
									percentuale: ((corrente.totali.movimenti - precedente.totali.movimenti) / precedente.totali.movimenti) * 100,
									riferimento: `contro ${intero.format(precedente.totali.movimenti)}`,
								}
							: undefined
					}
				/>
				<Kpi
					etichetta="Persone che hanno pagato"
					valore={corrente.totali.persone}
					nota={`Medio ${euro.format(corrente.totali.persone ? corrente.totali.importo / corrente.totali.persone : 0)} a persona`}
					icona={Icone.persone}
					delta={
						precedente && precedente.totali.persone > 0
							? {
									percentuale: ((corrente.totali.persone - precedente.totali.persone) / precedente.totali.persone) * 100,
									riferimento: `contro ${intero.format(precedente.totali.persone)}`,
								}
							: undefined
					}
				/>
			</div>

			{corrente.totali.movimenti === 0 ? (
				<Card titolo="Nessun incasso con questi filtri">
					<p className="text-sm text-ink-3">Allarga il periodo o togli qualche filtro.</p>
				</Card>
			) : (
				<>
					{f.raggruppa !== "niente" && (
						<Card
							titolo={`${metrica.nome.replace(" (€)", "")} per ${raggruppa.nome.toLowerCase()}`}
							sottotitolo={
								precedente
									? `In verde ${nomeCorrente}, in grigio ${nomePrecedente}. Passa sopra per i valori e la differenza.`
									: nomeCorrente
							}
						>
							{isTempoIncassi(f.raggruppa) ? (
								<BarreConfronto
									colonne={righe.map((x) => ({
										etichetta: x.breve,
										secondaRiga: x.secondaRiga,
										nomeCompleto: x.nome,
										valore: x.attuale[f.metrica],
										confronto: x.precedente ? x.precedente[f.metrica] : null,
										nomeConfronto: x.nomePrecedente,
									}))}
									formato={f.metrica === "importo" ? "euro" : "numero"}
									nomeMisura={`${metrica.nome} per ${raggruppa.nome.toLowerCase()}`}
									nomeCorrente={nomeCorrente}
									nomeConfronto={nomePrecedente}
								/>
							) : (
								<RankedBars
									euro={f.metrica === "importo"}
									unita={f.metrica === "importo" ? "" : f.metrica}
									righe={righe.slice(0, 15).map((x) => ({
										etichetta: x.nome,
										valore: x.attuale[f.metrica],
										confronto: x.precedente ? x.precedente[f.metrica] : null,
									}))}
								/>
							)}
						</Card>
					)}

					<Card titolo="Il dettaglio dei numeri" sottotitolo={precedente ? `Accanto, ${nomePrecedente} e la variazione.` : nomeCorrente}>
						<div className="-mx-2 overflow-x-auto px-2">
							<table className="w-full min-w-[40rem] border-collapse text-sm">
								<thead>
									<tr className="border-b border-line text-xs text-ink-3">
										<th scope="col" className="px-3 py-2 text-left font-medium">
											{raggruppa.nome}
										</th>
										<th scope="col" className="px-3 py-2 text-right font-medium">Incassato</th>
										{precedente && <th scope="col" className="px-3 py-2 text-right font-medium">Confronto</th>}
										{precedente && <th scope="col" className="px-3 py-2 text-right font-medium">Variazione</th>}
										<th scope="col" className="px-3 py-2 text-right font-medium">Quota</th>
										<th scope="col" className="px-3 py-2 text-right font-medium">Movimenti</th>
										<th scope="col" className="px-3 py-2 text-right font-medium">Persone</th>
									</tr>
								</thead>
								<tbody>
									{righe.map((x) => (
										<tr key={x.chiave} className="border-b border-line last:border-0 hover:bg-surface-2/60">
											<th scope="row" className="px-3 py-2.5 text-left font-medium first-letter:uppercase">
												{x.nome}
											</th>
											<td className="px-3 py-2.5 text-right font-medium tabular-nums">{euro.format(x.attuale.importo)}</td>
											{precedente && (
												<td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{x.precedente ? euro.format(x.precedente.importo) : "—"}</td>
											)}
											{precedente && (
												<td className="px-3 py-2.5 text-right">
													<Delta ora={x.attuale.importo} prima={x.precedente?.importo} />
												</td>
											)}
											<td className="px-3 py-2.5 text-right tabular-nums text-ink-3">
												{Math.round((x.attuale.importo / totalePositivo) * 1000) / 10}%
											</td>
											<td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{intero.format(x.attuale.movimenti)}</td>
											<td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{intero.format(x.attuale.persone)}</td>
										</tr>
									))}
								</tbody>
								{righe.length > 1 && (
									<tfoot>
										<tr className="border-t-2 border-line font-semibold">
											<th scope="row" className="px-3 py-2.5 text-left">Totale</th>
											<td className="px-3 py-2.5 text-right tabular-nums">{euro.format(corrente.totali.importo)}</td>
											{precedente && <td className="px-3 py-2.5 text-right tabular-nums">{euro.format(precedente.totali.importo)}</td>}
											{precedente && (
												<td className="px-3 py-2.5 text-right">
													<Delta ora={corrente.totali.importo} prima={precedente.totali.importo} />
												</td>
											)}
											<td className="px-3 py-2.5 text-right tabular-nums">100%</td>
											<td className="px-3 py-2.5 text-right tabular-nums">{intero.format(corrente.totali.movimenti)}</td>
											<td className="px-3 py-2.5 text-right tabular-nums">{intero.format(corrente.totali.persone)}</td>
										</tr>
									</tfoot>
								)}
							</table>
						</div>
						{corrente.troncato && <p className="mt-3 text-xs text-warn">Più di 400 righe: la tabella mostra le prime 400.</p>}
					</Card>

					<Card
						titolo="I movimenti uno per uno"
						sottotitolo={`${intero.format(elenco.totale)} movimenti con questi filtri${elenco.totale > RIGHE_PER_PAGINA ? `, pagina ${f.pagina} di ${intero.format(nPagine)}` : ""}`}
					>
						<div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
							<span className="text-ink-3">Ordina per</span>
							{(
								[
									["data", "Più recenti"],
									["importo", "Importo più alto"],
								] as const
							).map(([v, nome]) => (
								<Link
									key={v}
									href={link({ ordine: v === "data" ? "" : v, pagina: "" })}
									scroll={false}
									aria-current={f.ordine === v ? "true" : undefined}
									className={`rounded-full border px-3 py-1 font-medium transition-colors ${
										f.ordine === v ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink-2 hover:border-ink-3 hover:text-ink"
									}`}
								>
									{nome}
								</Link>
							))}
							<a
								href={`/analisi/incassi/export?${filtriIncassiInQuery(f, { senzaPagina: true })}`}
								className="ml-auto rounded-xl border border-line px-3 py-1 font-medium text-ink-2 hover:border-ink-3 hover:text-ink"
							>
								Scarica CSV
							</a>
						</div>
						<div className="-mx-2 overflow-x-auto px-2">
							<table className="w-full min-w-[52rem] border-collapse text-sm">
								<thead>
									<tr className="border-b border-line text-left text-xs text-ink-3">
										<th scope="col" className="px-3 py-2 font-medium">Quando</th>
										<th scope="col" className="px-3 py-2 font-medium">Persona</th>
										<th scope="col" className="px-3 py-2 font-medium">Cosa</th>
										<th scope="col" className="px-3 py-2 font-medium">Metodo</th>
										<th scope="col" className="px-3 py-2 font-medium">Operatore</th>
										<th scope="col" className="px-3 py-2 text-right font-medium">Importo</th>
									</tr>
								</thead>
								<tbody>
									{elenco.righe.map((m, i) => (
										<tr key={`${m.quando}-${i}`} className="border-b border-line last:border-0 hover:bg-surface-2/60">
											<td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{dataOra(m.quando)}</td>
											<td className="px-3 py-2.5">{m.nome || m.cognome ? nomeCompleto(m.nome, m.cognome) : "—"}</td>
											<td className="px-3 py-2.5">
												<span className="block">{frase(m.abbonamento ?? m.descrizione) || m.tipologia}</span>
												<span className="block text-xs text-ink-3">{[m.tipologia, m.causale ? frase(m.causale) : null].filter(Boolean).join(" · ")}</span>
											</td>
											<td className="px-3 py-2.5 text-ink-2">{m.metodo}</td>
											<td className="px-3 py-2.5 text-ink-2">{nomeCompleto(m.operatore, null)}</td>
											<td className={`px-3 py-2.5 text-right font-medium tabular-nums ${m.importo < 0 ? "text-warn" : ""}`}>{euro.format(m.importo)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{nPagine > 1 && (
							<nav aria-label="Pagine dell'elenco" className="mt-4 flex items-center justify-between gap-3 text-sm">
								{f.pagina > 1 ? (
									<Link href={link({ pagina: f.pagina - 1 > 1 ? String(f.pagina - 1) : "" })} className="rounded-xl border border-line px-3 py-1.5 font-medium hover:border-ink-3">
										← Precedenti
									</Link>
								) : (
									<span />
								)}
								<span className="text-ink-3">
									Pagina {f.pagina} di {intero.format(nPagine)}
								</span>
								{f.pagina < nPagine ? (
									<Link href={link({ pagina: String(f.pagina + 1) })} className="rounded-xl border border-line px-3 py-1.5 font-medium hover:border-ink-3">
										Successive →
									</Link>
								) : (
									<span />
								)}
							</nav>
						)}
					</Card>
				</>
			)}
		</Stagger>
	);
}

/** Modulo dei filtri: un normale GET, così ogni ricerca è un indirizzo da copiare. */
function FiltriIncassiForm({ f, opzioni }: { f: FiltriIncassi; opzioni: OpzioniIncassi }) {
	const multipla = (nome: string, titolo: string, valori: string[], scelti: string[], formatta = (v: string) => v) => (
		<details className="group relative">
			<summary className={`${campo} flex cursor-pointer list-none items-center justify-between gap-2`}>
				<span className="truncate">{scelti.length ? `${titolo}: ${scelti.length}` : `${titolo}: tutti`}</span>
				<span aria-hidden="true" className="text-ink-3 transition-transform group-open:rotate-180">
					▾
				</span>
			</summary>
			<div className="absolute z-20 mt-1 max-h-72 w-72 overflow-auto rounded-xl border border-line bg-surface p-2 shadow-lift">
				{valori.map((v) => (
					<label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
						<input type="checkbox" name={nome} value={v} defaultChecked={scelti.includes(v)} className="accent-[var(--accent)]" />
						{formatta(v)}
					</label>
				))}
			</div>
		</details>
	);

	return (
		<form method="get" action="/analisi/incassi" className="rounded-2xl border border-line bg-surface p-4 shadow-card">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<label>
					<span className={etichetta}>Periodo</span>
					<select name="p" defaultValue={f.preset ?? ""} className={campo}>
						<option value="">Date scelte qui accanto</option>
						{PRESET.map((p) => (
							<option key={p.valore} value={p.valore}>
								{p.nome}
							</option>
						))}
					</select>
				</label>
				<div className="grid grid-cols-2 gap-2">
					<label>
						<span className={etichetta}>Dal</span>
						<input type="date" name="da" defaultValue={f.da} className={campo} />
					</label>
					<label>
						<span className={etichetta}>Al</span>
						<input type="date" name="a" defaultValue={f.a} className={campo} />
					</label>
				</div>
				<label>
					<span className={etichetta}>Raggruppa per</span>
					<select name="raggruppa" defaultValue={f.raggruppa} className={campo}>
						{RAGGRUPPA_INCASSI.map((r) => (
							<option key={r.valore} value={r.valore}>
								{r.nome}
							</option>
						))}
					</select>
				</label>
				<label>
					<span className={etichetta}>Confronta con</span>
					<select name="confronto" defaultValue={f.confronto} className={campo}>
						<option value="anno">Stesso periodo dell&apos;anno scorso</option>
						<option value="periodo">Periodo precedente (stessa durata)</option>
						<option value="nessuno">Nessun confronto</option>
					</select>
				</label>

				<div>
					<span className={etichetta}>Tipologia</span>
					{multipla("tipologie", "Tipologie", opzioni.tipologie, f.tipologie)}
				</div>
				<div>
					<span className={etichetta}>Metodo di pagamento</span>
					{multipla("metodi", "Metodi", opzioni.metodi, f.metodi)}
				</div>
				<div>
					<span className={etichetta}>Operatore</span>
					{multipla("operatori", "Operatori", opzioni.operatori, f.operatori, (v) => nomeCompleto(v, null))}
				</div>
				<label>
					<span className={etichetta}>Misura nel grafico</span>
					<select name="metrica" defaultValue={f.metrica} className={campo}>
						{METRICHE_INCASSI.map((m) => (
							<option key={m.valore} value={m.valore}>
								{m.nome}
							</option>
						))}
					</select>
				</label>

				<label className="sm:col-span-2">
					<span className={etichetta}>Cerca (persona, descrizione, causale, abbonamento)</span>
					<input type="search" name="q" defaultValue={f.q} placeholder="es. Rossi, ingresso, family nuoto" className={campo} />
				</label>
				<label>
					<span className={etichetta}>Entrate o uscite</span>
					<select name="segno" defaultValue={f.segno} className={campo}>
						{SEGNI.map((s) => (
							<option key={s.valore} value={s.valore}>
								{s.nome}
							</option>
						))}
					</select>
				</label>
				<div className="grid grid-cols-2 gap-2">
					<label>
						<span className={etichetta}>Importo da €</span>
						<input type="number" step="any" name="min" defaultValue={f.min} className={campo} />
					</label>
					<label>
						<span className={etichetta}>a €</span>
						<input type="number" step="any" name="max" defaultValue={f.max} className={campo} />
					</label>
				</div>
			</div>
			<div className="mt-4 flex flex-wrap items-center gap-2">
				<button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong">
					Applica i filtri
				</button>
				<Link href="/analisi/incassi" className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:border-ink-3 hover:text-ink">
					Azzera
				</Link>
				<span className="text-xs text-ink-3">
					Il periodo scelto nel menu vale più delle date; per usare le date scegli «Date scelte qui accanto».
				</span>
			</div>
		</form>
	);
}

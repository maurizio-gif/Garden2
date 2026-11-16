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
import { CAMPI, METRICHE, RAGGRUPPA, filtriInQuery, isTempo } from "@/lib/analisi";
import { unisci } from "@/lib/analisi-vista";
import { RIGHE_PER_PAGINA, elencoViste, leggiAnalisi, leggiOpzioni, oggiARoma } from "@/lib/data";
import { dataBreve, euro, frase, intero, nomeCompleto } from "@/lib/format";
import { eliminaVista } from "./actions";
import { FiltriAnalisi } from "./filtri";
import { NomePersona } from "@/components/nome-persona";

export const metadata: Metadata = { title: "Analisi" };

export default function Pagina({ searchParams }: PageProps<"/analisi">) {
	return (
		<>
			<div className="mb-4">
				<Titolo>Analisi</Titolo>
				<p className="mt-1 max-w-3xl text-sm text-ink-3">
					Costruisci la tua vista sugli abbonamenti: scegli il periodo, filtra per prodotto, venditore o testo, raggruppa come
					preferisci e confronta con l&apos;anno scorso. Ogni analisi è un link: copialo o salvalo come vista.
				</p>
				<SchedeAnalisi attiva="vendite" />
			</div>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto searchParams={searchParams} />
			</Suspense>
		</>
	);
}

const th = "px-3 py-2 text-right text-xs font-medium text-ink-3";
const td = "px-3 py-2.5 text-right tabular-nums";

async function Contenuto({ searchParams }: { searchParams: PageProps<"/analisi">["searchParams"] }) {
	const cerca = await searchParams;
	const [r, opzioni, viste] = await Promise.all([leggiAnalisi(cerca), leggiOpzioni(), elencoViste()]);
	const { filtri: f, corrente, precedente, periodoPrecedente, elenco, modo, adesso } = r;

	const righe = unisci(f, corrente, precedente, periodoPrecedente);
	const metrica = METRICHE.find((m) => m.valore === f.metrica)!;
	const raggruppa = RAGGRUPPA.find((x) => x.valore === f.raggruppa)!;
	const confronto = precedente !== null;
	const nomeCorrente = `${dataBreve(f.da)} – ${dataBreve(f.a)}`;
	const nomePrecedente = periodoPrecedente ? `${dataBreve(periodoPrecedente.da)} – ${dataBreve(periodoPrecedente.a)}` : "";
	const spesa = (m: { vendite: number; fatturato: number }) => (m.vendite > 0 ? m.fatturato / m.vendite : 0);
	const oggi = oggiARoma(adesso);
	const nPagine = Math.max(1, Math.ceil(elenco.totale / RIGHE_PER_PAGINA));
	const link = (extra: Record<string, string>) => {
		const p = new URLSearchParams(filtriInQuery(f, { senzaPagina: true }));
		for (const [k, v] of Object.entries(extra)) {
			if (v) p.set(k, v);
			else p.delete(k);
		}
		return `/analisi?${p.toString()}`;
	};

	return (
		<Stagger className="flex flex-col gap-4">
			{modo === "demo" && (
				<StaggerItem>
					<StatoDati modo={modo} aggiornatoAl={null} adesso={adesso} />
				</StaggerItem>
			)}

			{viste.length > 0 && (
				<StaggerItem as="section" className="flex flex-wrap items-center gap-2">
					<h2 className="mr-1 text-sm font-semibold">Le tue viste</h2>
					{viste.map((v) => (
						<span
							key={v.id}
							className="inline-flex items-center overflow-hidden rounded-full border border-line bg-surface text-sm shadow-card"
						>
							<Link href={`/analisi?${v.query}`} className="px-3 py-1.5 font-medium transition-colors hover:bg-accent-soft hover:text-accent-strong">
								{v.nome}
							</Link>
							<form action={eliminaVista}>
								<input type="hidden" name="id" value={v.id} />
								<button
									type="submit"
									aria-label={`Elimina la vista ${v.nome}`}
									title="Elimina la vista"
									className="px-2 py-1.5 text-ink-3 transition-colors hover:bg-bad-soft hover:text-bad"
								>
									<svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
										<path d="m4 4 8 8M12 4l-8 8" />
									</svg>
								</button>
							</form>
						</span>
					))}
				</StaggerItem>
			)}

			<StaggerItem>
				<FiltriAnalisi iniziali={f} opzioni={opzioni} oggi={oggi} puoSalvare={modo === "reale"} />
			</StaggerItem>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Kpi
					etichetta="Venduto"
					valore={corrente.totali.fatturato}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={nomeCorrente}
					icona={Icone.incassi}
					delta={
						confronto && precedente.totali.fatturato > 0
							? {
									percentuale: ((corrente.totali.fatturato - precedente.totali.fatturato) / precedente.totali.fatturato) * 100,
									riferimento: `su ${nomePrecedente}`,
								}
							: undefined
					}
				/>
				<Kpi
					etichetta="Vendite"
					valore={corrente.totali.vendite}
					nota="Contratti venduti nel periodo"
					icona={Icone.rate}
					delta={
						confronto && precedente.totali.vendite > 0
							? {
									percentuale: ((corrente.totali.vendite - precedente.totali.vendite) / precedente.totali.vendite) * 100,
									riferimento: `su ${nomePrecedente}`,
								}
							: undefined
					}
				/>
				<Kpi
					etichetta="Persone diverse"
					valore={corrente.totali.persone}
					nota="Chi ha comprato almeno una volta"
					icona={Icone.persone}
					delta={
						confronto && precedente.totali.persone > 0
							? {
									percentuale: ((corrente.totali.persone - precedente.totali.persone) / precedente.totali.persone) * 100,
									riferimento: `su ${nomePrecedente}`,
								}
							: undefined
					}
				/>
				<Kpi
					etichetta="Spesa media per vendita"
					valore={Math.round(spesa(corrente.totali))}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota="Venduto diviso vendite"
					icona={Icone.scadenza}
					delta={
						confronto && spesa(precedente.totali) > 0
							? {
									percentuale: ((spesa(corrente.totali) - spesa(precedente.totali)) / spesa(precedente.totali)) * 100,
									riferimento: `su ${nomePrecedente}`,
								}
							: undefined
					}
				/>
			</div>

			{corrente.totali.vendite === 0 && !(precedente && precedente.totali.vendite > 0) ? (
				<Card titolo="Nessuna vendita con questi filtri">
					<p className="text-sm text-ink-3">
						Prova ad allargare il periodo o a togliere qualche filtro (testo, importo, categoria).
					</p>
				</Card>
			) : (
				<>
					{f.raggruppa !== "niente" && (
						<Card
							titolo={`${metrica.nome.replace(" (€)", "")} per ${raggruppa.nome.toLowerCase()}`}
							sottotitolo={
								confronto
									? `${nomeCorrente}, in grigio ${nomePrecedente}. Il periodo vale per la ${CAMPI.find((c) => c.valore === f.campo)!.nome.toLowerCase()}.`
									: `${nomeCorrente}. Il periodo vale per la ${CAMPI.find((c) => c.valore === f.campo)!.nome.toLowerCase()}.`
							}
						>
							{isTempo(f.raggruppa) ? (
								<BarreConfronto
									nomeMisura={`${metrica.breve} per ${raggruppa.nome.toLowerCase()}`}
									formato={f.metrica === "fatturato" ? "euro" : "numero"}
									nomeCorrente={nomeCorrente}
									nomeConfronto={nomePrecedente}
									colonne={righe.map((x) => ({
										etichetta: x.breve,
										secondaRiga: x.secondaRiga,
										nomeCompleto: x.nome,
										valore: x.attuale[f.metrica],
										confronto: x.precedente ? x.precedente[f.metrica] : null,
										nomeConfronto: x.nomePrecedente,
									}))}
								/>
							) : (
								<>
									<RankedBars
										unita={metrica.breve.toLowerCase()}
										euro={f.metrica === "fatturato"}
										righe={righe
											.filter((x) => x.attuale[f.metrica] > 0)
											.slice(0, 12)
											.map((x) => ({
												etichetta: x.nome,
												valore: x.attuale[f.metrica],
												confronto: x.precedente ? x.precedente[f.metrica] : null,
											}))}
									/>
									{righe.length > 12 && (
										<p className="mt-4 text-xs text-ink-3">Nel grafico i primi 12 su {righe.length}: l&apos;elenco completo è nella tabella.</p>
									)}
								</>
							)}
						</Card>
					)}

					<Card
						titolo="Il dettaglio dei numeri"
						sottotitolo={
							confronto
								? `Una riga per ${raggruppa.nome.toLowerCase()}. Il confronto è con ${nomePrecedente}.`
								: `Una riga per ${raggruppa.nome.toLowerCase()}.`
						}
					>
						<div className="-mx-2 overflow-x-auto px-2">
							<table className="w-full min-w-[36rem] border-collapse text-sm">
								<thead>
									<tr className="border-b border-line">
										<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
											{raggruppa.nome}
										</th>
										<th scope="col" className={th}>
											Venduto
										</th>
										<th scope="col" className={th}>
											Vendite
										</th>
										<th scope="col" className={th}>
											Persone
										</th>
										<th scope="col" className={th}>
											Spesa media
										</th>
										{confronto && (
											<>
												<th scope="col" className={th}>
													Venduto prima
												</th>
												<th scope="col" className={th}>
													Variazione
												</th>
											</>
										)}
									</tr>
								</thead>
								<tbody>
									{righe.map((x) => (
										<tr key={x.chiave} className="border-b border-line last:border-0">
											<th scope="row" className="max-w-64 px-3 py-2.5 text-left font-normal">
												{x.nome}
											</th>
											<td className={td}>{euro.format(x.attuale.fatturato)}</td>
											<td className={td}>{intero.format(x.attuale.vendite)}</td>
											<td className={td}>{intero.format(x.attuale.persone)}</td>
											<td className={td}>{x.attuale.vendite ? euro.format(spesa(x.attuale)) : "—"}</td>
											{confronto && (
												<>
													<td className={`${td} text-ink-3`}>{x.precedente ? euro.format(x.precedente.fatturato) : "—"}</td>
													<td className={td}>
														{x.precedente ? <Delta ora={x.attuale.fatturato} prima={x.precedente.fatturato} /> : "—"}
													</td>
												</>
											)}
										</tr>
									))}
									{righe.length > 1 && (
										<tr className="border-t-2 border-line bg-surface-2/60 font-semibold">
											<th scope="row" className="px-3 py-2.5 text-left">
												Totale
											</th>
											<td className={td}>{euro.format(corrente.totali.fatturato)}</td>
											<td className={td}>{intero.format(corrente.totali.vendite)}</td>
											<td className={td}>{intero.format(corrente.totali.persone)}</td>
											<td className={td}>{euro.format(spesa(corrente.totali))}</td>
											{confronto && (
												<>
													<td className={`${td} font-normal text-ink-3`}>{euro.format(precedente.totali.fatturato)}</td>
													<td className={td}>
														<Delta ora={corrente.totali.fatturato} prima={precedente.totali.fatturato} />
													</td>
												</>
											)}
										</tr>
									)}
								</tbody>
							</table>
						</div>
						{corrente.troncato && (
							<p className="mt-3 text-xs text-warn">Ci sono più di 400 gruppi: la tabella mostra i primi 400. Restringi i filtri.</p>
						)}
						{righe.length > 1 && f.raggruppa !== "niente" && (
							<p className="mt-3 text-xs text-ink-3">
								Le persone del totale sono persone diverse nel periodo: la somma delle righe può essere più alta, perché chi compra in due {isTempo(f.raggruppa) ? "periodi" : "gruppi"} conta in entrambi.
							</p>
						)}
					</Card>

					<Card
						titolo="Le vendite una per una"
						sottotitolo={`${intero.format(elenco.totale)} ${elenco.totale === 1 ? "vendita" : "vendite"} con questi filtri${
							elenco.totale > RIGHE_PER_PAGINA ? `, pagina ${f.pagina} di ${nPagine}` : ""
						}`}
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
									aria-current={f.ordine === v ? "true" : undefined}
									className={`rounded-full border px-3 py-1 font-medium transition-colors ${
										f.ordine === v
											? "border-accent bg-accent-soft text-accent-strong"
											: "border-line text-ink-2 hover:border-ink-3 hover:text-ink"
									}`}
								>
									{nome}
								</Link>
							))}
						</div>
						<div className="-mx-2 overflow-x-auto px-2">
							<table className="w-full min-w-[48rem] border-collapse text-sm">
								<thead>
									<tr className="border-b border-line">
										<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
											Venduto il
										</th>
										<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
											Persona
										</th>
										<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
											Abbonamento
										</th>
										<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
											Validità
										</th>
										<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
											Venditore
										</th>
										<th scope="col" className={th}>
											Importo
										</th>
									</tr>
								</thead>
								<tbody>
									{elenco.righe.map((v, i) => (
										<tr key={`${v.vendita}-${i}`} className="border-b border-line last:border-0 hover:bg-surface-2/60">
											<td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{v.vendita ? dataBreve(v.vendita) : "—"}</td>
											<td className="px-3 py-2.5"><NomePersona id={v.persona_id} nome={v.nome} cognome={v.cognome} /></td>
											<td className="px-3 py-2.5">
												<span className="block">{frase(v.abbonamento) || "Abbonamento"}</span>
												<span className="block text-xs text-ink-3">
													{[v.gruppo, v.categoria ? frase(v.categoria) : null, v.durata].filter(Boolean).join(" · ")}
												</span>
											</td>
											<td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-2">
												{v.inizio && v.fine ? `${dataBreve(v.inizio)} → ${dataBreve(v.fine)}` : "—"}
											</td>
											<td className="px-3 py-2.5 text-ink-2">{v.operatore ? nomeCompleto(v.operatore, null) : "—"}</td>
											<td className={`${td} font-medium`}>{v.totale != null ? euro.format(v.totale) : "—"}</td>
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

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Titolo } from "@/components/card";
import { FiltroGruppi } from "@/components/filtro-gruppi";
import { Icone, Kpi } from "@/components/kpi";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { NomePersona } from "@/components/nome-persona";
import { RankedBars } from "@/components/ranked-bars";
import { ScheletroLista } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { RIGHE_PER_PAGINA, leggiDebitori } from "@/lib/data";
import { FASCE_DEBITO, leggiFiltriDebitori, queryDebitori, type FiltriDebitori } from "@/lib/debitori";
import { dataBreve, euro, frase, intero } from "@/lib/format";
import type { FasciaDebito } from "@/lib/types";

export const metadata: Metadata = { title: "Debitori" };

type Cerca = Record<string, string | string[] | undefined>;

export default function Pagina({ searchParams }: { searchParams: Promise<Cerca> }) {
	return (
		<>
			<div className="mb-4">
				<Titolo>Debitori</Titolo>
				<p className="mt-1 max-w-3xl text-sm text-ink-3">
					Le rate di abbonamento non pagate, divise per anzianità, e chi le deve. Una persona sta nella fascia della sua rata
					scaduta più vecchia. Gli stessi numeri dei crediti della pagina Finanza.
				</p>
			</div>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto searchParams={searchParams} />
			</Suspense>
		</>
	);
}

const FASCE_TUTTE: { valore: FiltriDebitori["fascia"]; nome: string }[] = [
	{ valore: "anno", nome: "Ultimo anno" },
	...FASCE_DEBITO.map((x) => ({ valore: x.valore, nome: x.nome.replace("Scaduto da ", "") })),
	{ valore: "tutte", nome: "Tutte" },
];

const TONO: Record<FasciaDebito, string> = {
	g30: "bg-warn-soft text-warn",
	g90: "bg-warn-soft text-warn",
	g180: "bg-bad-soft text-bad",
	g365: "bg-bad-soft text-bad",
	oltre: "bg-surface-2 text-ink-2",
};

async function Contenuto({ searchParams }: { searchParams: Promise<Cerca> }) {
	const cerca = await searchParams;
	const f = leggiFiltriDebitori(cerca);
	const { dati: d, modo, adesso } = await leggiDebitori(f);
	const fx = (x: FasciaDebito | "in_scadenza") => d.fasce[x] ?? { rate: 0, importo: 0, persone: 0 };
	const ultimoAnno = (["g30", "g90", "g180", "g365"] as FasciaDebito[]).reduce(
		(t, x) => ({ importo: t.importo + fx(x).importo, rate: t.rate + fx(x).rate }),
		{ importo: 0, rate: 0 },
	);
	const personeAnno = (["g30", "g90", "g180", "g365"] as FasciaDebito[]).reduce((t, x) => t + (d.fasce_persone[x]?.persone ?? 0), 0);
	const maxImporto = Math.max(1, ...FASCE_DEBITO.map((x) => fx(x.valore).importo));
	const gruppi = d.per_gruppo.map((g) => g.gruppo).sort();
	const altri: Record<string, string> = Object.fromEntries(new URLSearchParams(queryDebitori({ ...f, gruppi: [], pagina: 1 })));
	const link = (extra: Record<string, string>) => `/debitori?${queryDebitori({ ...f, pagina: 1 }, extra)}#elenco`;
	const nPagine = Math.max(1, Math.ceil(d.totale / RIGHE_PER_PAGINA));
	const chip = (attivo: boolean) =>
		`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
			attivo ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface text-ink-2 hover:text-ink"
		}`;

	return (
		<Stagger className="flex flex-col gap-4">
			<StaggerItem className="flex flex-col gap-3">
				<StatoDati modo={modo} aggiornatoAl={d.aggiornato_al} adesso={adesso} />
				<FiltroGruppi percorso="/debitori" gruppi={gruppi} scelti={f.gruppi} altri={altri} />
			</StaggerItem>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Kpi
					etichetta="Scaduto nell'ultimo anno"
					valore={ultimoAnno.importo}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={`${intero.format(ultimoAnno.rate)} rate · ${intero.format(personeAnno)} persone`}
					icona={Icone.rate}
					tono={ultimoAnno.importo > 0 ? "attenzione" : "neutro"}
				/>
				<Kpi
					etichetta="Dovuto da chi è ancora iscritto"
					valore={d.scaduto_iscritti}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={`${intero.format(d.debitori_iscritti)} persone con un abbonamento attivo`}
					icona={Icone.persone}
				/>
				<Kpi
					etichetta="In scadenza nei prossimi 30 giorni"
					valore={fx("in_scadenza").importo}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={`${intero.format(fx("in_scadenza").rate)} rate di ${intero.format(fx("in_scadenza").persone)} persone`}
					icona={Icone.scadenza}
				/>
				<Kpi
					etichetta="Scaduto da oltre un anno"
					valore={fx("oltre").importo}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={`${intero.format(fx("oltre").persone)} persone: probabilmente rate vecchie mai chiuse in Info4U`}
					icona={Icone.valore}
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-5">
				<Card
					className="lg:col-span-3"
					titolo="Importi per anzianità"
					sottotitolo={`Rate scadute e non pagate, per da quanto sono scadute: ${euro.format(d.totale_scaduto)} in tutto. Clicca una riga per vedere chi le deve.`}
				>
					<div className="-mx-2 overflow-x-auto px-2">
						<table className="w-full min-w-[34rem] border-collapse text-sm">
							<thead>
								<tr className="border-b border-line text-left text-xs text-ink-3">
									<th scope="col" className="py-2 pr-2 font-medium">Scaduto da</th>
									<th scope="col" className="w-2/5 px-2 py-2 font-medium" aria-hidden="true" />
									<th scope="col" className="px-2 py-2 text-right font-medium">Importo</th>
									<th scope="col" className="px-2 py-2 text-right font-medium">Rate</th>
									<th scope="col" className="py-2 pl-2 text-right font-medium">Persone</th>
								</tr>
							</thead>
							<tbody>
								{FASCE_DEBITO.map((x) => {
									const v = fx(x.valore);
									return (
										<tr key={x.valore} className={`border-b border-line ${f.fascia === x.valore ? "bg-surface-2" : ""}`}>
											<th scope="row" className="py-2 pr-2 text-left font-medium">
												<Link href={link({ fascia: x.valore })} scroll={false} className="hover:text-accent-strong hover:underline">
													{x.nome.replace("Scaduto da ", "")}
												</Link>
											</th>
											<td className="px-2 py-2" aria-hidden="true">
												<span className="block h-2.5 overflow-hidden rounded-full bg-surface-2">
													<span className={`block h-full rounded-full ${x.valore === "oltre" ? "bg-ink-3" : "bg-bad"}`} style={{ width: `${(v.importo / maxImporto) * 100}%`, opacity: 0.85 }} />
												</span>
											</td>
											<td className="px-2 py-2 text-right font-semibold tabular-nums">{euro.format(v.importo)}</td>
											<td className="px-2 py-2 text-right tabular-nums text-ink-2">{intero.format(v.rate)}</td>
											<td className="py-2 pl-2 text-right tabular-nums text-ink-2">{intero.format(v.persone)}</td>
										</tr>
									);
								})}
								<tr className="border-b border-line">
									<th scope="row" className="py-2 pr-2 text-left font-medium text-ink-2">In scadenza entro 30 giorni</th>
									<td className="px-2 py-2" aria-hidden="true" />
									<td className="px-2 py-2 text-right tabular-nums text-ink-2">{euro.format(fx("in_scadenza").importo)}</td>
									<td className="px-2 py-2 text-right tabular-nums text-ink-3">{intero.format(fx("in_scadenza").rate)}</td>
									<td className="py-2 pl-2 text-right tabular-nums text-ink-3">{intero.format(fx("in_scadenza").persone)}</td>
								</tr>
							</tbody>
						</table>
					</div>
					<h3 className="mb-2 mt-6 text-sm font-semibold">Persone per rata più vecchia</h3>
					<ul className="m-0 grid list-none gap-2 p-0 text-sm sm:grid-cols-2">
						{FASCE_DEBITO.map((x) => {
							const p = d.fasce_persone[x.valore];
							return (
								<li key={x.valore} className="flex items-baseline justify-between gap-3 rounded-lg border border-line px-3 py-2">
									<span className="text-ink-2">{x.nome.replace("Scaduto da ", "")}</span>
									<span className="text-right tabular-nums">
										<b>{intero.format(p?.persone ?? 0)}</b> persone · {euro.format(p?.importo ?? 0)}
										<span className="block text-xs text-ink-3">{intero.format(p?.iscritti ?? 0)} ancora iscritte</span>
									</span>
								</li>
							);
						})}
					</ul>
				</Card>

				<Card className="lg:col-span-2" titolo="Scaduto per gruppo e metodo" sottotitolo="Tutte le rate scadute, di ogni anzianità.">
					<RankedBars euro unita="" righe={d.per_gruppo.map((g) => ({ etichetta: g.gruppo, valore: g.importo }))} />
					<h3 className="mb-3 mt-6 text-sm font-semibold">Metodo di pagamento previsto</h3>
					<RankedBars euro unita="" righe={d.per_metodo.slice(0, 6).map((m) => ({ etichetta: m.metodo, valore: m.importo }))} />
				</Card>
			</div>

			<div id="elenco" className="scroll-mt-4">
				<Card
					titolo={`${intero.format(d.totale)} ${d.totale === 1 ? "debitore" : "debitori"} · ${euro.format(d.totale_importo)}`}
					sottotitolo="Totale scaduto per persona; «prossime» = rate non ancora scadute. Chi ha un abbonamento attivo è segnato: viene ancora e si può fermare alla reception."
				>
					<div className="mb-3 flex flex-wrap items-center gap-2">
						{FASCE_TUTTE.map((x) => (
							<Link key={x.valore} href={link({ fascia: x.valore === "anno" ? "" : x.valore })} scroll={false} className={chip(f.fascia === x.valore)} aria-current={f.fascia === x.valore ? "true" : undefined}>
								{x.nome}
							</Link>
						))}
					</div>
					<form method="get" action="/debitori" className="mb-3 flex flex-wrap items-end gap-3 text-sm">
						{f.fascia !== "anno" && <input type="hidden" name="fascia" value={f.fascia} />}
						{f.gruppi.length > 0 && <input type="hidden" name="gruppi" value={f.gruppi.join("|")} />}
						{f.ordine !== "importo" && <input type="hidden" name="ordine" value={f.ordine} />}
						<label className="flex flex-col gap-1">
							<span className="text-xs text-ink-3">Cerca un nome</span>
							<input type="search" name="q" defaultValue={f.q} className="rounded-xl border border-line bg-surface px-3 py-1.5" />
						</label>
						<label className="flex flex-col gap-1">
							<span className="text-xs text-ink-3">Almeno €</span>
							<input type="number" min={0} step="any" name="min" defaultValue={f.min} className="w-28 rounded-xl border border-line bg-surface px-3 py-1.5" />
						</label>
						<label className="inline-flex items-center gap-2 pb-1.5">
							<input type="checkbox" name="iscritti" value="1" defaultChecked={f.soloIscritti} className="accent-[var(--accent)]" />
							Solo chi è ancora iscritto
						</label>
						<button type="submit" className="rounded-xl bg-accent px-4 py-1.5 font-medium text-white hover:bg-accent-strong">
							Cerca
						</button>
						<span className="ml-auto flex flex-wrap items-center gap-2">
							<span className="text-xs text-ink-3">Ordina per</span>
							{(
								[
									["importo", "Importo"],
									["anzianita", "Anzianità"],
									["nome", "Cognome"],
								] as const
							).map(([v, nome]) => (
								<Link key={v} href={link({ ordine: v === "importo" ? "" : v })} scroll={false} className={chip(f.ordine === v)} aria-current={f.ordine === v ? "true" : undefined}>
									{nome}
								</Link>
							))}
							<a href={`/debitori/export?${queryDebitori({ ...f, pagina: 1 })}`} className="rounded-xl border border-line px-3 py-1 text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink">
								Scarica CSV
							</a>
						</span>
					</form>

					{d.righe.length === 0 ? (
						<p className="py-8 text-center text-sm text-ink-3">Nessun debitore con questi filtri.</p>
					) : (
						<div className="-mx-2 overflow-x-auto px-2">
							<table className="w-full min-w-[58rem] border-collapse text-sm">
								<thead>
									<tr className="border-b border-line text-left text-xs text-ink-3">
										<th scope="col" className="px-3 py-2 font-medium">Persona</th>
										<th scope="col" className="px-3 py-2 text-right font-medium">Scaduto</th>
										<th scope="col" className="px-3 py-2 font-medium">Rata più vecchia</th>
										<th scope="col" className="px-3 py-2 font-medium">Abbonamento</th>
										<th scope="col" className="px-3 py-2 text-right font-medium">Prossime</th>
										<th scope="col" className="px-3 py-2 font-medium">Ultimo accesso</th>
									</tr>
								</thead>
								<tbody>
									{d.righe.map((r) => (
										<tr key={r.persona_id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
											<td className="px-3 py-2.5">
												<NomePersona id={r.persona_id} nome={r.nome} cognome={r.cognome} className="font-medium" />
												<span className="block text-xs text-ink-3">
													{r.cellulare ?? "—"}
													{r.iscritto && <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-px font-medium text-accent-strong">Iscritto</span>}
												</span>
											</td>
											<td className="px-3 py-2.5 text-right">
												<span className="font-semibold tabular-nums">{euro.format(r.scaduto)}</span>
												<span className="block text-xs text-ink-3">
													{r.rate_scadute} {r.rate_scadute === 1 ? "rata" : "rate"}
												</span>
											</td>
											<td className="px-3 py-2.5">
												<span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONO[r.fascia]}`}>{intero.format(r.giorni)} giorni</span>
												<span className="mt-0.5 block text-xs text-ink-3">
													{dataBreve(r.piu_vecchia)}
													{r.metodo ? ` · ${r.metodo}` : ""}
												</span>
												{r.errore && <span className="block text-xs text-bad">{r.errore}</span>}
											</td>
											<td className="px-3 py-2.5">
												<span className="block">{frase(r.abbonamento) || "—"}</span>
												{r.gruppo && <span className="block text-xs text-ink-3">{r.gruppo}</span>}
											</td>
											<td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{r.da_scadere > 0 ? euro.format(r.da_scadere) : "—"}</td>
											<td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink-2">{r.ultimo_accesso ? dataBreve(r.ultimo_accesso) : "—"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{nPagine > 1 && (
						<nav aria-label="Pagine dell'elenco" className="mt-4 flex items-center justify-between gap-3 text-sm">
							{f.pagina > 1 ? (
								<Link href={`/debitori?${queryDebitori(f, { pagina: f.pagina - 1 > 1 ? String(f.pagina - 1) : "" })}#elenco`} className="rounded-xl border border-line px-3 py-1.5 font-medium hover:border-ink-3">
									← Precedenti
								</Link>
							) : (
								<span />
							)}
							<span className="text-ink-3">
								Pagina {f.pagina} di {intero.format(nPagine)}
							</span>
							{f.pagina < nPagine ? (
								<Link href={`/debitori?${queryDebitori(f, { pagina: String(f.pagina + 1) })}#elenco`} className="rounded-xl border border-line px-3 py-1.5 font-medium hover:border-ink-3">
									Successive →
								</Link>
							) : (
								<span />
							)}
						</nav>
					)}
				</Card>
			</div>
		</Stagger>
	);
}

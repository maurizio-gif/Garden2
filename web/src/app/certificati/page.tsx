import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Titolo } from "@/components/card";
import { FiltroGruppi } from "@/components/filtro-gruppi";
import { Icone, Kpi } from "@/components/kpi";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { NomePersona } from "@/components/nome-persona";
import { ScheletroLista } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { FASCE, FILTRI_FASCIA, leggiFiltriCertificati, queryCertificati } from "@/lib/certificati";
import { RIGHE_PER_PAGINA, leggiCertificati } from "@/lib/data";
import { dataBreve, frase, intero } from "@/lib/format";
import type { Certificati, FasciaCertificato } from "@/lib/types";

export const metadata: Metadata = { title: "Certificati medici" };

type Cerca = Record<string, string | string[] | undefined>;

export default function Pagina({ searchParams }: { searchParams: Promise<Cerca> }) {
	return (
		<>
			<div className="mb-4">
				<Titolo>Certificati medici</Titolo>
				<p className="mt-1 max-w-3xl text-sm text-ink-3">
					Gli iscritti con un abbonamento attivo che hanno compiuto 6 anni: chi non ha mai consegnato il certificato, da quanto
					è scaduto e chi scade nei prossimi 30 giorni. Conta il certificato con la scadenza più lontana, di qualunque tipo.
				</p>
			</div>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto searchParams={searchParams} />
			</Suspense>
		</>
	);
}

const SCADUTI: FasciaCertificato[] = ["scaduto_30", "scaduto_90", "scaduto_180", "scaduto_365", "scaduto_oltre"];
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

function tonoFascia(f: FasciaCertificato) {
	if (f === "valido") return "bg-accent-soft text-accent-strong";
	if (f === "in_scadenza") return "bg-warn-soft text-warn";
	return "bg-bad-soft text-bad";
}

async function Contenuto({ searchParams }: { searchParams: Promise<Cerca> }) {
	const cerca = await searchParams;
	const f = leggiFiltriCertificati(cerca);
	const { dati: c, modo, adesso } = await leggiCertificati(f);
	const n = (x: FasciaCertificato) => c.fasce[x] ?? 0;
	const scaduti = SCADUTI.reduce((t, x) => t + n(x), 0);
	const inRegola = n("valido") + n("in_scadenza");
	const gruppi = [...new Set(c.gruppi.map((g) => g.gruppo))].sort();
	const altri: Record<string, string> = Object.fromEntries(new URLSearchParams(queryCertificati({ ...f, gruppi: [], pagina: 1 })));
	const link = (extra: Record<string, string>) => `/certificati?${queryCertificati({ ...f, pagina: 1 }, extra)}#elenco`;
	const nPagine = Math.max(1, Math.ceil(c.totale / RIGHE_PER_PAGINA));
	const maxScaduti = Math.max(1, n("mai"), ...SCADUTI.map(n));

	return (
		<Stagger className="flex flex-col gap-4">
			<StaggerItem className="flex flex-col gap-3">
				<StatoDati modo={modo} aggiornatoAl={c.aggiornato_al} adesso={adesso} fresco="Certificati aggiornati" fermo="Certificati fermi al" />
				<FiltroGruppi percorso="/certificati" gruppi={gruppi} scelti={f.gruppi} altri={altri} />
			</StaggerItem>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Kpi
					etichetta="Mai consegnato"
					valore={n("mai")}
					nota={`${pct(n("mai"), c.attivi)} degli iscritti attivi`}
					icona={Icone.persone}
					tono={n("mai") > 0 ? "attenzione" : "neutro"}
				/>
				<Kpi
					etichetta="Scaduto"
					valore={scaduti}
					nota={`${pct(scaduti, c.attivi)} · ${intero.format(n("scaduto_30"))} da meno di 30 giorni`}
					icona={Icone.scadenza}
					tono={scaduti > 0 ? "attenzione" : "neutro"}
				/>
				<Kpi etichetta="In scadenza entro 30 giorni" valore={n("in_scadenza")} nota="Da avvisare adesso" icona={Icone.rinnovo} tono={n("in_scadenza") > 0 ? "attenzione" : "neutro"} />
				<Kpi etichetta="In regola" valore={inRegola} nota={`${pct(inRegola, c.attivi)} di ${intero.format(c.attivi)} iscritti attivi dai 6 anni`} icona={Icone.valore} />
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card titolo="Certificati da sistemare" sottotitolo="Iscritti attivi senza un certificato valido oggi, per da quanto tempo. Clicca una riga per l'elenco.">
					<ul className="m-0 flex list-none flex-col gap-1 p-0">
						{(["mai", "scaduto_oltre", "scaduto_365", "scaduto_180", "scaduto_90", "scaduto_30", "in_scadenza"] as FasciaCertificato[]).map((x) => {
							const fascia = FASCE.find((y) => y.valore === x)!;
							const v = n(x);
							return (
								<li key={x}>
									<Link href={link({ fascia: x })} scroll={false} className={`grid grid-cols-[11rem_1fr_3.5rem] items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2 ${f.fascia === x ? "bg-surface-2" : ""}`}>
										<span className="font-medium">{fascia.nome}</span>
										<span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
											<span
												className={`block h-full rounded-full ${x === "in_scadenza" ? "bg-warn" : "bg-bad"}`}
												style={{ width: `${(v / maxScaduti) * 100}%`, opacity: x === "in_scadenza" ? 0.8 : 0.85 }}
											/>
										</span>
										<span className="text-right font-semibold tabular-nums">{intero.format(v)}</span>
									</Link>
								</li>
							);
						})}
					</ul>
					{c.senza_data_nascita > 0 && (
						<p className="mt-4 text-xs text-ink-3">
							{intero.format(c.senza_data_nascita)} iscritti non hanno la data di nascita in Info4U: sono contati, perché non si sa se hanno 6 anni.
						</p>
					)}
				</Card>

				<Card titolo="Per gruppo di abbonamento" sottotitolo="Quanti iscritti attivi dai 6 anni sono in regola in ogni gruppo.">
					<PerGruppo c={c} />
					<h3 className="mb-2 mt-6 text-sm font-semibold">Tipo di certificato</h3>
					<ul className="m-0 list-none p-0 text-sm">
						{c.tipi.map((t) => (
							<li key={t.tipo} className="flex justify-between gap-3 border-b border-line py-1.5 last:border-0">
								<span className="text-ink-2">{t.tipo === "Nessuno" ? "Nessun certificato" : t.tipo}</span>
								<span className="tabular-nums">{intero.format(t.n)}</span>
							</li>
						))}
					</ul>
				</Card>
			</div>

			<div id="elenco" className="scroll-mt-4">
				<Card
					titolo={`${intero.format(c.totale)} ${c.totale === 1 ? "persona" : "persone"}`}
					sottotitolo="Prima chi scade a breve, poi chi non l'ha mai consegnato, poi gli scaduti dal più recente. «Respinti» = volte che il tornello l'ha bloccato per il certificato negli ultimi 30 giorni."
				>
					<div className="mb-3 flex flex-wrap items-center gap-2">
						{FILTRI_FASCIA.map((x) => (
							<Link
								key={x.valore}
								href={link({ fascia: x.valore === "da_sistemare" ? "" : x.valore })}
								scroll={false}
								aria-current={f.fascia === x.valore ? "true" : undefined}
								className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
									f.fascia === x.valore ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface text-ink-2 hover:text-ink"
								}`}
							>
								{x.nome}
							</Link>
						))}
						<form method="get" action="/certificati" className="ml-auto flex items-center gap-2">
							{f.fascia !== "da_sistemare" && <input type="hidden" name="fascia" value={f.fascia} />}
							{f.gruppi.length > 0 && <input type="hidden" name="gruppi" value={f.gruppi.join("|")} />}
							<input type="search" name="q" defaultValue={f.q} placeholder="Cerca un nome" className="rounded-xl border border-line bg-surface px-3 py-1.5 text-sm" />
							<button type="submit" className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong">
								Cerca
							</button>
						</form>
						<a href={`/certificati/export?${queryCertificati({ ...f, pagina: 1 })}`} className="rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink">
							Scarica CSV
						</a>
					</div>

					{c.righe.length === 0 ? (
						<p className="py-8 text-center text-sm text-ink-3">Nessuno con questi filtri.</p>
					) : (
						<div className="-mx-2 overflow-x-auto px-2">
							<table className="w-full min-w-[56rem] border-collapse text-sm">
								<thead>
									<tr className="border-b border-line text-left text-xs text-ink-3">
										<th scope="col" className="px-3 py-2 font-medium">Persona</th>
										<th scope="col" className="px-3 py-2 font-medium">Certificato</th>
										<th scope="col" className="px-3 py-2 font-medium">Abbonamento attivo</th>
										<th scope="col" className="px-3 py-2 text-right font-medium">Respinti</th>
										<th scope="col" className="px-3 py-2 font-medium">Ultimo accesso</th>
									</tr>
								</thead>
								<tbody>
									{c.righe.map((r) => {
										const fascia = FASCE.find((x) => x.valore === r.fascia)!;
										return (
											<tr key={r.persona_id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
												<td className="px-3 py-2.5">
													<NomePersona id={r.persona_id} nome={r.nome} cognome={r.cognome} className="font-medium" />
													<span className="block text-xs text-ink-3">
														{[r.eta != null ? `${r.eta} anni` : "età sconosciuta", r.cellulare].filter(Boolean).join(" · ")}
													</span>
												</td>
												<td className="px-3 py-2.5">
													<span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tonoFascia(r.fascia)}`}>
														{r.fascia === "mai" ? "Mai consegnato" : r.fascia === "in_scadenza" ? `Scade il ${dataBreve(r.scadenza!)}` : r.fascia === "valido" ? `Valido fino al ${dataBreve(r.scadenza!)}` : `Scaduto da ${intero.format(r.giorni_scaduto ?? 0)} giorni`}
													</span>
													{r.tipo && <span className="mt-0.5 block text-xs text-ink-3">{r.tipo}{r.fascia.startsWith("scaduto") && r.scadenza ? ` · il ${dataBreve(r.scadenza)}` : ""}</span>}
													<span className="sr-only">{fascia.nome}</span>
												</td>
												<td className="px-3 py-2.5">
													<span className="block">{frase(r.abbonamento) || "—"}</span>
													<span className="block text-xs text-ink-3">
														{r.gruppo}
														{r.fine_abbonamento ? ` · fino al ${dataBreve(r.fine_abbonamento)}` : ""}
													</span>
												</td>
												<td className={`px-3 py-2.5 text-right tabular-nums ${r.respinti_30g > 0 ? "font-semibold text-bad" : "text-ink-3"}`}>{r.respinti_30g || "—"}</td>
												<td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink-2">{r.ultimo_accesso ? dataBreve(r.ultimo_accesso) : "—"}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}

					{nPagine > 1 && (
						<nav aria-label="Pagine dell'elenco" className="mt-4 flex items-center justify-between gap-3 text-sm">
							{f.pagina > 1 ? (
								<Link href={`/certificati?${queryCertificati(f, { pagina: f.pagina - 1 > 1 ? String(f.pagina - 1) : "" })}#elenco`} className="rounded-xl border border-line px-3 py-1.5 font-medium hover:border-ink-3">
									← Precedenti
								</Link>
							) : (
								<span />
							)}
							<span className="text-ink-3">
								Pagina {f.pagina} di {intero.format(nPagine)}
							</span>
							{f.pagina < nPagine ? (
								<Link href={`/certificati?${queryCertificati(f, { pagina: String(f.pagina + 1) })}#elenco`} className="rounded-xl border border-line px-3 py-1.5 font-medium hover:border-ink-3">
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

function PerGruppo({ c }: { c: Certificati }) {
	const righe = new Map<string, Record<string, number>>();
	for (const g of c.gruppi) {
		const r = righe.get(g.gruppo) ?? {};
		r[g.fascia] = (r[g.fascia] ?? 0) + g.n;
		righe.set(g.gruppo, r);
	}
	const elenco = [...righe.entries()]
		.map(([gruppo, r]) => {
			const tot = Object.values(r).reduce((a, b) => a + b, 0);
			const scaduti = SCADUTI.reduce((t, x) => t + (r[x] ?? 0), 0);
			return { gruppo, tot, ok: (r.valido ?? 0) + (r.in_scadenza ?? 0), in_scadenza: r.in_scadenza ?? 0, scaduti, mai: r.mai ?? 0 };
		})
		.sort((a, b) => b.tot - a.tot);
	return (
		<div className="-mx-2 overflow-x-auto px-2">
			<table className="w-full min-w-[30rem] border-collapse text-sm">
				<thead>
					<tr className="border-b border-line text-left text-xs text-ink-3">
						<th scope="col" className="py-2 pr-2 font-medium">Gruppo</th>
						<th scope="col" className="px-2 py-2 text-right font-medium">Iscritti</th>
						<th scope="col" className="px-2 py-2 text-right font-medium">In regola</th>
						<th scope="col" className="px-2 py-2 text-right font-medium">In scadenza</th>
						<th scope="col" className="px-2 py-2 text-right font-medium">Scaduti</th>
						<th scope="col" className="py-2 pl-2 text-right font-medium">Mai</th>
					</tr>
				</thead>
				<tbody>
					{elenco.map((g) => (
						<tr key={g.gruppo} className="border-b border-line last:border-0">
							<th scope="row" className="py-2 pr-2 text-left font-medium">{g.gruppo}</th>
							<td className="px-2 py-2 text-right tabular-nums">{intero.format(g.tot)}</td>
							<td className="px-2 py-2 text-right tabular-nums">{pct(g.ok, g.tot)}</td>
							<td className="px-2 py-2 text-right tabular-nums text-warn">{intero.format(g.in_scadenza)}</td>
							<td className="px-2 py-2 text-right tabular-nums text-bad">{intero.format(g.scaduti)}</td>
							<td className="py-2 pl-2 text-right tabular-nums text-bad">{intero.format(g.mai)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarreImpilate } from "@/components/barre-impilate";
import { Card, Titolo } from "@/components/card";
import { FiltroGruppi } from "@/components/filtro-gruppi";
import { Icone, Kpi } from "@/components/kpi";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { ScheletroLista } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { RIGHE_PER_PAGINA, leggiElencoScadenze, leggiOpzioni, leggiScadenze } from "@/lib/data";
import { dataBreve, euro, frase, intero, meseCorto, meseLungo, nomeCompleto } from "@/lib/format";
import { leggiFiltriScadenze, meseDa, perMese, queryScadenze, tassoRinnovi, type FiltriElencoScadenze } from "@/lib/scadenze";
import type { ElencoScadenze } from "@/lib/types";

export const metadata: Metadata = { title: "Scadenze e rinnovi" };

type Cerca = Record<string, string | string[] | undefined>;

export default function Pagina({ searchParams }: { searchParams: Promise<Cerca> }) {
	return (
		<>
			<div className="mb-4">
				<Titolo>Scadenze e rinnovi</Titolo>
				<p className="mt-1 max-w-3xl text-sm text-ink-3">
					Chi scade nei prossimi mesi, quanto vale e chi ha già rinnovato. Un abbonamento è rinnovato se la stessa persona ne
					inizia un altro dello stesso gruppo entro 30 giorni dalla scadenza.
				</p>
			</div>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto searchParams={searchParams} />
			</Suspense>
		</>
	);
}

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

async function Contenuto({ searchParams }: { searchParams: Promise<Cerca> }) {
	const cerca = await searchParams;
	const [{ dati: s, modo, adesso }, opzioni] = await Promise.all([leggiScadenze(), leggiOpzioni()]);
	// Solo i gruppi che hanno scadenze (le quote associative non ne hanno), nell'ordine dei menu.
	const presenti = new Set(s.mesi.map((m) => m.gruppo));
	const gruppiValidi = [...new Set([...opzioni.gruppi, "Altro"])].filter((g) => presenti.has(g));
	const f = leggiFiltriScadenze(cerca, s.oggi, gruppiValidi);
	const { dati: elenco } = await leggiElencoScadenze(f);

	const meseOggi = meseDa(s.oggi, 0);
	const prossimi = perMese(s.mesi, f.gruppi, meseOggi, meseDa(s.oggi, 3));
	const storico = perMese(s.mesi, f.gruppi, meseDa(s.oggi, -35), meseDa(s.oggi, -1));
	const ultimi24 = storico.slice(-24);
	const rinnovi = tassoRinnovi(s.mesi, s.oggi, f.gruppi);
	const altri: Record<string, string> = f.gruppi.length ? { gruppi: f.gruppi.join("|") } : {};

	const valore24 = ultimi24.reduce((t, m) => t + m.valore, 0);
	const persi24 = ultimi24.reduce((t, m) => t + (m.valore - m.valore_rinnovati), 0);

	return (
		<Stagger className="flex flex-col gap-4">
			<StaggerItem className="flex flex-col gap-3">
				<StatoDati modo={modo} aggiornatoAl={s.aggiornato_al} adesso={adesso} />
				<FiltroGruppi
					percorso="/scadenze"
					gruppi={gruppiValidi}
					scelti={f.gruppi}
					altri={Object.fromEntries(new URLSearchParams(queryScadenze({ ...f, gruppi: [], pagina: 1 })))}
				/>
			</StaggerItem>

			{/* Mese in corso e i tre successivi */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{prossimi.map((m, i) => {
					const daRinnovare = m.scadenze - m.rinnovati;
					const attivo = f.mese === m.mese.slice(0, 7);
					return (
						<StaggerItem key={m.mese} hover="lift">
							<Link
								href={`/scadenze?${new URLSearchParams({ mese: m.mese.slice(0, 7), ...altri })}#elenco`}
								className={`flex h-full flex-col rounded-2xl border bg-surface p-5 shadow-card transition-colors ${
									attivo ? "border-accent" : "border-line hover:border-ink-3"
								}`}
							>
								<span className="flex items-center justify-between text-sm font-medium text-ink-2">
									<span className="first-letter:uppercase">{meseLungo(m.mese)}</span>
									{i === 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-strong">in corso</span>}
								</span>
								<span className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{intero.format(m.scadenze)}</span>
								<span className="text-xs text-ink-3">abbonamenti in scadenza · {euro.format(m.valore)}</span>
								<span className="mt-4 grid gap-1.5 text-xs">
									<span className="flex items-center justify-between gap-2">
										<span className="flex items-center gap-1.5 text-warn">
											<span className="size-2 rounded-full bg-current" aria-hidden="true" /> Da rinnovare
										</span>
										<b className="tabular-nums">
											{intero.format(daRinnovare)} · {euro.format(m.valore - m.valore_rinnovati)}
										</b>
									</span>
									<span className="flex items-center justify-between gap-2">
										<span className="flex items-center gap-1.5 text-accent-strong">
											<span className="size-2 rounded-full bg-current" aria-hidden="true" /> Già rinnovati
										</span>
										<b className="tabular-nums">
											{intero.format(m.rinnovati)} · {euro.format(m.valore_rinnovati)}
										</b>
									</span>
									<span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-warn-soft" aria-hidden="true">
										<span className="block h-full rounded-full bg-accent" style={{ width: pct(m.rinnovati, m.scadenze) === "—" ? 0 : pct(m.rinnovati, m.scadenze) }} />
									</span>
								</span>
								<span className="mt-3 text-xs font-medium text-accent-strong">Vedi l&apos;elenco →</span>
							</Link>
						</StaggerItem>
					);
				})}
			</div>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Kpi
					etichetta="Tasso di rinnovo, 12 mesi chiusi"
					valore={rinnovi.tasso ?? 0}
					opzioni={{ style: "percent", maximumFractionDigits: 0 }}
					nota={`${meseLungo(rinnovi.da)} – ${meseLungo(rinnovi.a)}`}
					icona={Icone.rinnovo}
					delta={
						rinnovi.tasso != null && rinnovi.tassoPrima
							? {
									percentuale: ((rinnovi.tasso - rinnovi.tassoPrima) / rinnovi.tassoPrima) * 100,
									riferimento: `contro il ${Math.round(rinnovi.tassoPrima * 100)}% dell'anno prima`,
								}
							: undefined
					}
				/>
				<Kpi
					etichetta="Scaduti e rinnovati, 12 mesi chiusi"
					valore={rinnovi.rinnovati}
					nota={`su ${intero.format(rinnovi.scadenze)} abbonamenti scaduti`}
					icona={Icone.persone}
				/>
				<Kpi
					etichetta="Valore scaduto, ultimi 24 mesi"
					valore={valore24}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota="Prezzo degli abbonamenti arrivati a scadenza"
					icona={Icone.valore}
				/>
				<Kpi
					etichetta="Valore non rinnovato, ultimi 24 mesi"
					valore={persi24}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={`${pct(persi24, valore24)} del valore in scadenza`}
					icona={Icone.scadenza}
					tono="attenzione"
				/>
			</div>

			<Card
				titolo="Andamento dei rinnovi, ultimi 24 mesi"
				sottotitolo="Per mese di scadenza: in verde chi ha rinnovato entro 30 giorni, in arancio chi no. Sopra ogni colonna la percentuale di rinnovo; passa sopra per l'anno prima. L'ultimo mese può ancora salire: la finestra di 30 giorni è aperta."
			>
				<BarreImpilate
					formato="numero"
					nomeMisura="Abbonamenti scaduti per mese, rinnovati e non"
					serie={[
						{ nome: "Rinnovati", colore: "var(--serie-0)" },
						{ nome: "Non rinnovati", colore: "var(--serie-1)" },
					]}
					colonne={ultimi24.map((m, i) => {
						const prima = storico[storico.length - 24 + i - 12];
						return {
							etichetta: meseCorto(m.mese),
							secondaRiga: m.mese.slice(5, 7) === "01" ? m.mese.slice(0, 4) : undefined,
							nomeCompleto: meseLungo(m.mese),
							valori: [m.rinnovati, m.scadenze - m.rinnovati],
							sopra: pct(m.rinnovati, m.scadenze),
							incompleto: i === 23,
							note: [
								`Rinnovo: ${pct(m.rinnovati, m.scadenze)}`,
								`Valore in scadenza: ${euro.format(m.valore)}`,
								`Valore dei rinnovi: ${euro.format(m.valore_rinnovi)}`,
								prima ? `${meseLungo(prima.mese)}: ${pct(prima.rinnovati, prima.scadenze)} su ${intero.format(prima.scadenze)}` : "",
							].filter(Boolean),
						};
					})}
				/>
			</Card>

			<Card
				titolo="Valore in scadenza, ultimi 24 mesi"
				sottotitolo="Il prezzo degli abbonamenti che scadono ogni mese: in verde la parte rinnovata, in arancio quella persa."
			>
				<BarreImpilate
					formato="euro"
					nomeMisura="Valore in scadenza per mese, rinnovato e perso"
					serie={[
						{ nome: "Rinnovato", colore: "var(--serie-0)" },
						{ nome: "Non rinnovato", colore: "var(--serie-1)" },
					]}
					colonne={ultimi24.map((m, i) => ({
						etichetta: meseCorto(m.mese),
						secondaRiga: m.mese.slice(5, 7) === "01" ? m.mese.slice(0, 4) : undefined,
						nomeCompleto: meseLungo(m.mese),
						valori: [m.valore_rinnovati, m.valore - m.valore_rinnovati],
						incompleto: i === 23,
						note: [`${intero.format(m.scadenze)} abbonamenti`, `I rinnovi valgono ${euro.format(m.valore_rinnovi)}`],
					}))}
				/>
			</Card>

			<Elenco f={f} elenco={elenco} />
		</Stagger>
	);
}

function Elenco({ f, elenco }: { f: FiltriElencoScadenze; elenco: ElencoScadenze }) {
	const nPagine = Math.max(1, Math.ceil(elenco.totale / RIGHE_PER_PAGINA));
	const link = (extra: Record<string, string>) => `/scadenze?${queryScadenze(f, { pagina: "", ...extra })}#elenco`;
	const chip = (attivo: boolean) =>
		`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
			attivo ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink-2 hover:border-ink-3 hover:text-ink"
		}`;

	return (
		<Card
			titolo={`Chi scade dal ${dataBreve(f.da)} al ${dataBreve(f.a)}`}
			sottotitolo={`${intero.format(elenco.totale)} abbonamenti · ${euro.format(elenco.valore)} · ${intero.format(elenco.rinnovati)} già rinnovati, ${euro.format(elenco.valore_da_rinnovare)} ancora da rinnovare`}
		>
			<div id="elenco" className="-mt-2 scroll-mt-6" />
			<form method="get" action="/scadenze" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
				<input type="hidden" name="mese" value={f.mese} />
				{f.gruppi.length > 0 && <input type="hidden" name="gruppi" value={f.gruppi.join("|")} />}
				{f.stato !== "tutti" && <input type="hidden" name="stato" value={f.stato} />}
				<label className="flex flex-col gap-1">
					<span className="text-xs text-ink-3">Scadenza dal</span>
					<input type="date" name="da" defaultValue={f.da} className="rounded-xl border border-line bg-surface px-3 py-1.5" />
				</label>
				<label className="flex flex-col gap-1">
					<span className="text-xs text-ink-3">al</span>
					<input type="date" name="a" defaultValue={f.a} className="rounded-xl border border-line bg-surface px-3 py-1.5" />
				</label>
				<label className="flex min-w-48 flex-1 flex-col gap-1">
					<span className="text-xs text-ink-3">Cerca nome, cellulare o abbonamento</span>
					<input type="search" name="q" defaultValue={f.q} placeholder="es. Rossi, 333…, nuoto" className="rounded-xl border border-line bg-surface px-3 py-1.5" />
				</label>
				<button type="submit" className="rounded-xl bg-accent px-4 py-1.5 font-medium text-white hover:bg-accent-strong">
					Cerca
				</button>
				<a
					href={`/scadenze/export?${queryScadenze(f, { pagina: "" })}`}
					className="rounded-xl border border-line px-4 py-1.5 font-medium text-ink-2 hover:border-ink-3 hover:text-ink"
				>
					Scarica CSV
				</a>
			</form>

			<div className="mb-3 flex flex-wrap items-center gap-2">
				<span className="text-xs text-ink-3">Mostra</span>
				{(
					[
						["tutti", "Tutti"],
						["da_rinnovare", "Da rinnovare"],
						["rinnovati", "Già rinnovati"],
					] as const
				).map(([v, nome]) => (
					<Link key={v} href={link({ stato: v === "tutti" ? "" : v })} scroll={false} className={chip(f.stato === v)} aria-current={f.stato === v ? "true" : undefined}>
						{nome}
					</Link>
				))}
				<span className="ml-3 text-xs text-ink-3">Ordina per</span>
				{(
					[
						["fine", "Scadenza"],
						["importo", "Importo"],
						["nome", "Cognome"],
					] as const
				).map(([v, nome]) => (
					<Link key={v} href={link({ ordine: v === "fine" ? "" : v })} scroll={false} className={chip(f.ordine === v)} aria-current={f.ordine === v ? "true" : undefined}>
						{nome}
					</Link>
				))}
			</div>

			{elenco.righe.length === 0 ? (
				<p className="py-8 text-center text-sm text-ink-3">Nessun abbonamento in scadenza con questi filtri.</p>
			) : (
				<div className="-mx-2 overflow-x-auto px-2">
					<table className="w-full min-w-[56rem] border-collapse text-sm">
						<thead>
							<tr className="border-b border-line text-left text-xs text-ink-3">
								<th scope="col" className="px-3 py-2 font-medium">Scadenza</th>
								<th scope="col" className="px-3 py-2 font-medium">Persona</th>
								<th scope="col" className="px-3 py-2 font-medium">Abbonamento</th>
								<th scope="col" className="px-3 py-2 text-right font-medium">Importo</th>
								<th scope="col" className="px-3 py-2 font-medium">Rinnovo</th>
								<th scope="col" className="px-3 py-2 font-medium">Venditore</th>
							</tr>
						</thead>
						<tbody>
							{elenco.righe.map((r, i) => (
								<tr key={`${r.data_fine}-${r.cognome}-${i}`} className="border-b border-line last:border-0 hover:bg-surface-2/60">
									<td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{dataBreve(r.data_fine)}</td>
									<td className="px-3 py-2.5">
										<span className="block font-medium">{nomeCompleto(r.nome, r.cognome)}</span>
										{r.cellulare && (
											<a href={`tel:${r.cellulare.replace(/[^\d+]/g, "")}`} className="block text-xs text-ink-3 hover:text-accent-strong">
												{r.cellulare}
											</a>
										)}
									</td>
									<td className="px-3 py-2.5">
										<span className="block">{frase(r.abbonamento) || "Abbonamento"}</span>
										<span className="block text-xs text-ink-3">
											{r.gruppo} · dal {dataBreve(r.data_inizio)}
										</span>
									</td>
									<td className="px-3 py-2.5 text-right font-medium tabular-nums">{r.totale != null ? euro.format(r.totale) : "—"}</td>
									<td className="px-3 py-2.5">
										{r.rinnovo_inizio ? (
											<>
												<span className="inline-flex rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">Rinnovato</span>
												<span className="mt-0.5 block text-xs text-ink-3">
													{frase(r.rinnovo_abbonamento)} · dal {dataBreve(r.rinnovo_inizio)}
													{r.rinnovo_totale != null ? ` · ${euro.format(r.rinnovo_totale)}` : ""}
												</span>
											</>
										) : (
											<span className="inline-flex rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">Da rinnovare</span>
										)}
									</td>
									<td className="px-3 py-2.5 text-ink-2">{r.venditore ? nomeCompleto(r.venditore, null) : "—"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

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
	);
}

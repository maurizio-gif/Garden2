import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Titolo } from "@/components/card";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { NomePersona } from "@/components/nome-persona";
import { ScheletroLista } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { StatoBadge } from "@/components/stato-contatto";
import { ORDINI, STATI, leggiFiltriContatti, queryContatti, type FiltriContatti } from "@/lib/contatti";
import { RIGHE_PER_PAGINA, leggiContatti, leggiOpzioni } from "@/lib/data";
import { dataBreve, frase, intero } from "@/lib/format";

export const metadata: Metadata = { title: "Contatti" };

type Cerca = Record<string, string | string[] | undefined>;

export default function Pagina({ searchParams }: { searchParams: Promise<Cerca> }) {
	return (
		<>
			<div className="mb-4">
				<Titolo>Contatti</Titolo>
				<p className="mt-1 max-w-3xl text-sm text-ink-3">
					Tutte le persone di Info4U, iscritte e no. Cerca per nome, telefono, email o codice fiscale, filtra per stato e
					abbonamento, e apri la scheda per vedere abbonamenti, pagamenti e accessi.
				</p>
			</div>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto searchParams={searchParams} />
			</Suspense>
		</>
	);
}

const campo = "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent";
const etichetta = "mb-1.5 block text-xs font-medium text-ink-2";

async function Contenuto({ searchParams }: { searchParams: Promise<Cerca> }) {
	const cerca = await searchParams;
	const f = leggiFiltriContatti(cerca);
	const [{ dati: e, modo, adesso }, opzioni] = await Promise.all([leggiContatti(f), leggiOpzioni()]);
	const gruppi = opzioni.gruppi.filter((g) => g !== "Quote e tessere");
	const nPagine = Math.max(1, Math.ceil(e.totale / RIGHE_PER_PAGINA));
	const link = (extra: Record<string, string>) => `/contatti?${queryContatti({ ...f, pagina: 1 }, extra)}`;
	const contoStato = (v: string) => {
		const s = e.per_stato ?? {};
		if (v === "tutti") return Object.entries(s).reduce((t, [k, n]) => t + (k === "mai" ? 0 : (n ?? 0)), 0);
		if (v === "attivi") return (s.attivo ?? 0) + (s.in_scadenza ?? 0);
		return s[v as keyof typeof s] ?? 0;
	};
	const chip = (attivo: boolean) =>
		`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
			attivo ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface text-ink-2 hover:text-ink"
		}`;

	return (
		<Stagger className="flex flex-col gap-4">
			{modo === "demo" && (
				<StaggerItem>
					<StatoDati modo={modo} aggiornatoAl={null} adesso={adesso} />
				</StaggerItem>
			)}

			<StaggerItem>
				<nav aria-label="Stato" className="flex flex-wrap gap-2">
					{STATI.map((s) => (
						<Link key={s.valore} href={link({ stato: s.valore === "tutti" ? "" : s.valore })} scroll={false} className={chip(f.stato === s.valore)} aria-current={f.stato === s.valore ? "true" : undefined}>
							{s.nome}
							<span className="tabular-nums text-ink-3">{intero.format(contoStato(s.valore))}</span>
						</Link>
					))}
				</nav>
			</StaggerItem>

			<StaggerItem>
				<FiltriForm f={f} gruppi={gruppi} />
			</StaggerItem>

			<Card
				titolo={`${intero.format(e.totale)} ${e.totale === 1 ? "persona" : "persone"}`}
				sottotitolo={e.totale > RIGHE_PER_PAGINA ? `Pagina ${f.pagina} di ${intero.format(nPagine)}` : undefined}
			>
				<div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
					<span className="text-xs text-ink-3">Ordina per</span>
					{ORDINI.map((o) => (
						<Link key={o.valore} href={link({ ordine: o.valore === "nome" ? "" : o.valore })} scroll={false} className={chip(f.ordine === o.valore)} aria-current={f.ordine === o.valore ? "true" : undefined}>
							{o.nome}
						</Link>
					))}
					<a
						href={`/contatti/export?${queryContatti({ ...f, pagina: 1 })}`}
						className="ml-auto rounded-xl border border-line px-3 py-1 text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink"
					>
						Scarica CSV
					</a>
				</div>

				{e.righe.length === 0 ? (
					<p className="py-8 text-center text-sm text-ink-3">Nessuna persona con questi filtri.</p>
				) : (
					<div className="-mx-2 overflow-x-auto px-2">
						<table className="w-full min-w-[56rem] border-collapse text-sm">
							<thead>
								<tr className="border-b border-line text-left text-xs text-ink-3">
									<th scope="col" className="px-3 py-2 font-medium">Persona</th>
									<th scope="col" className="px-3 py-2 font-medium">Stato</th>
									<th scope="col" className="px-3 py-2 font-medium">Ultimo abbonamento</th>
									<th scope="col" className="px-3 py-2 font-medium">Scade</th>
									<th scope="col" className="px-3 py-2 font-medium">Ultimo accesso</th>
									<th scope="col" className="px-3 py-2 font-medium">Cliente dal</th>
								</tr>
							</thead>
							<tbody>
								{e.righe.map((r) => (
									<tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
										<td className="px-3 py-2.5">
											<NomePersona id={r.id} nome={r.nome} cognome={r.cognome} className="font-medium" />
											<span className="block text-xs text-ink-3">
												{[r.cellulare, r.eta != null ? `${r.eta} anni` : null].filter(Boolean).join(" · ") || "—"}
											</span>
										</td>
										<td className="px-3 py-2.5">
											<StatoBadge stato={r.stato} />
											{r.rate_scadute && (
												<span className="ml-1.5 inline-flex rounded-full bg-bad-soft px-2 py-0.5 text-xs font-medium text-bad">Rate scadute</span>
											)}
										</td>
										<td className="px-3 py-2.5">
											<span className="block">{r.abbonamento ? frase(r.abbonamento) : "—"}</span>
											{r.gruppo && <span className="block text-xs text-ink-3">{r.gruppo}</span>}
										</td>
										<td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink-2">{r.ultima_fine ? dataBreve(r.ultima_fine) : "—"}</td>
										<td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink-2">{r.ultimo_accesso ? dataBreve(r.ultimo_accesso) : "—"}</td>
										<td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-ink-2">{r.cliente_dal ? dataBreve(r.cliente_dal) : "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				{nPagine > 1 && (
					<nav aria-label="Pagine dell'elenco" className="mt-4 flex items-center justify-between gap-3 text-sm">
						{f.pagina > 1 ? (
							<Link href={`/contatti?${queryContatti(f, { pagina: f.pagina - 1 > 1 ? String(f.pagina - 1) : "" })}`} className="rounded-xl border border-line px-3 py-1.5 font-medium hover:border-ink-3">
								← Precedenti
							</Link>
						) : (
							<span />
						)}
						<span className="text-ink-3">
							Pagina {f.pagina} di {intero.format(nPagine)}
						</span>
						{f.pagina < nPagine ? (
							<Link href={`/contatti?${queryContatti(f, { pagina: String(f.pagina + 1) })}`} className="rounded-xl border border-line px-3 py-1.5 font-medium hover:border-ink-3">
								Successive →
							</Link>
						) : (
							<span />
						)}
					</nav>
				)}
			</Card>
		</Stagger>
	);
}

/** I filtri: un normale GET, così ogni ricerca è un indirizzo da copiare. */
function FiltriForm({ f, gruppi }: { f: FiltriContatti; gruppi: string[] }) {
	return (
		<form method="get" action="/contatti" className="rounded-2xl border border-line bg-surface p-4 shadow-card">
			{f.stato !== "tutti" && <input type="hidden" name="stato" value={f.stato} />}
			{f.ordine !== "nome" && <input type="hidden" name="ordine" value={f.ordine} />}
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<label className="sm:col-span-2">
					<span className={etichetta}>Cerca</span>
					<input type="search" name="q" defaultValue={f.q} placeholder="Nome, cognome, cellulare, email o codice fiscale" className={campo} autoFocus={!f.q} />
				</label>
				<label>
					<span className={etichetta}>Ultimo abbonamento contiene</span>
					<input type="search" name="abbonamento" defaultValue={f.abbonamento} placeholder="es. family nuoto, open" className={campo} />
				</label>
				<label>
					<span className={etichetta}>Non vengono da</span>
					<select name="assenti" defaultValue={f.assenti} className={campo}>
						<option value="">Qualsiasi</option>
						<option value="14">Almeno 2 settimane</option>
						<option value="30">Almeno 30 giorni</option>
						<option value="60">Almeno 60 giorni</option>
						<option value="90">Almeno 90 giorni</option>
					</select>
				</label>

				<fieldset className="sm:col-span-2">
					<legend className={etichetta}>Gruppo dell&apos;ultimo abbonamento</legend>
					<div className="flex flex-wrap gap-2">
						{gruppi.map((g) => (
							<label key={g} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-strong">
								<input type="checkbox" name="gruppi" value={g} defaultChecked={f.gruppi.includes(g)} className="sr-only" />
								{g}
							</label>
						))}
					</div>
				</fieldset>
				<div className="grid grid-cols-3 gap-2">
					<label>
						<span className={etichetta}>Sesso</span>
						<select name="sesso" defaultValue={f.sesso} className={campo}>
							<option value="">Tutti</option>
							<option value="F">F</option>
							<option value="M">M</option>
						</select>
					</label>
					<label>
						<span className={etichetta}>Età da</span>
						<input type="number" min={0} max={120} name="eta_min" defaultValue={f.etaMin} className={campo} />
					</label>
					<label>
						<span className={etichetta}>a</span>
						<input type="number" min={0} max={120} name="eta_max" defaultValue={f.etaMax} className={campo} />
					</label>
				</div>
				<div className="flex flex-col justify-end gap-2 text-sm">
					<label className="inline-flex items-center gap-2">
						<input type="checkbox" name="rate" value="1" defaultChecked={f.rateScadute} className="accent-[var(--accent)]" />
						Con rate scadute
					</label>
					<label className="inline-flex items-center gap-2">
						<input type="checkbox" name="certificato" value="scaduto" defaultChecked={f.certificatoScaduto} className="accent-[var(--accent)]" />
						Senza certificato valido
					</label>
				</div>
			</div>
			<div className="mt-4 flex flex-wrap items-center gap-2">
				<button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong">
					Cerca
				</button>
				<Link href="/contatti" className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:border-ink-3 hover:text-ink">
					Azzera
				</Link>
			</div>
		</form>
	);
}

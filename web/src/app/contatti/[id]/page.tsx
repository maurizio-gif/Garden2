import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BarreConfronto, type ColonnaConfronto } from "@/components/barre-confronto";
import { Card } from "@/components/card";
import { Icone, Kpi } from "@/components/kpi";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { ScheletroLista } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { StatoBadge } from "@/components/stato-contatto";
import { idValido, statoDaAbbonamenti } from "@/lib/contatti";
import { leggiPersona } from "@/lib/data";
import { dataBreve, dataOra, euro, frase, intero, meseCorto, meseLungo, nomeCompleto } from "@/lib/format";
import type { SchedaPersona } from "@/lib/types";

export const metadata: Metadata = { title: "Scheda cliente" };

export default function Pagina({ params }: { params: Promise<{ id: string }> }) {
	return (
		<>
			<Link href="/contatti" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
				<span aria-hidden="true">←</span> Contatti
			</Link>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto params={params} />
			</Suspense>
		</>
	);
}

const decimale = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const th = "px-3 py-2 text-left text-xs font-medium text-ink-3";
const thR = "px-3 py-2 text-right text-xs font-medium text-ink-3";
const td = "px-3 py-2.5";
const tdR = "px-3 py-2.5 text-right tabular-nums";
const riga = "border-b border-line last:border-0 hover:bg-surface-2/60";
const data = (v: string | null | undefined) => (v ? dataBreve(v) : "—");

const SEZIONI = [
	["abbonamenti", "Abbonamenti"],
	["rate", "Rate"],
	["pagamenti", "Pagamenti"],
	["accessi", "Accessi"],
	["altro", "Certificati e altro"],
	["crm", "CRM ed email"],
] as const;

async function Contenuto({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (!idValido(id)) notFound();
	const { dati: s, modo, adesso } = await leggiPersona(id);
	if (!s) notFound();
	const p = s.persona;
	const r = s.riepilogo;
	const stato = statoDaAbbonamenti(s.abbonamenti, s.oggi);
	const prodotti = s.abbonamenti.filter((a) => !a.quota);
	const clienteDal = prodotti.reduce<string | null>((m, a) => (a.inizio && (!m || a.inizio < m) ? a.inizio : m), null);
	const eta = p.data_nascita ? Math.floor((Date.parse(s.oggi) - Date.parse(p.data_nascita)) / (365.25 * 86_400_000)) : null;

	return (
		<Stagger className="flex flex-col gap-4">
			{modo === "demo" && (
				<StaggerItem>
					<StatoDati modo={modo} aggiornatoAl={null} adesso={adesso} />
				</StaggerItem>
			)}

			{/* Intestazione: chi è e come contattarlo */}
			<StaggerItem as="section" className="rounded-2xl border border-line bg-surface p-5 shadow-card">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{nomeCompleto(p.nome, p.cognome)}</h1>
						<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-2">
							<StatoBadge stato={stato} />
							{eta != null && <span>{eta} anni</span>}
							{p.sesso && <span>· {p.sesso.toUpperCase() === "F" ? "Donna" : p.sesso.toUpperCase() === "M" ? "Uomo" : p.sesso}</span>}
							{clienteDal && <span>· cliente dal {dataBreve(clienteDal)}</span>}
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						{p.cellulare && (
							<a href={`tel:${p.cellulare.replace(/[^\d+]/g, "")}`} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong">
								Chiama {p.cellulare}
							</a>
						)}
						{p.email && (
							<a href={`mailto:${p.email}`} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:border-ink-3 hover:text-ink">
								Scrivi una email
							</a>
						)}
					</div>
				</div>
				<dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
					{(
						[
							["Cellulare", p.cellulare],
							["Telefono", [p.telefono_1, p.telefono_2].filter(Boolean).join(" · ") || null],
							["Email", p.email],
							["Codice fiscale", p.codice_fiscale],
							["Nato/a", [p.data_nascita ? dataBreve(p.data_nascita) : null, p.luogo_nascita].filter(Boolean).join(" a ") || null],
							["Indirizzo", [p.indirizzo, [p.cap, p.citta].filter(Boolean).join(" "), p.provincia ? `(${p.provincia})` : null].filter(Boolean).join(", ") || null],
							["Codice Info4U", p.source_utente_id != null ? String(p.source_utente_id) : null],
							["Note", p.note],
						] as const
					).map(([k, v]) => (
						<div key={k}>
							<dt className="text-xs text-ink-3">{k}</dt>
							<dd className="mt-0.5 break-words">{v || "—"}</dd>
						</div>
					))}
				</dl>
				{p.conflitto_con && (
					<p className="mt-4 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
						Possibile doppione:{" "}
						<Link href={`/contatti/${p.conflitto_con}`} className="font-medium underline">
							apri l&apos;altra scheda con lo stesso nome
						</Link>
						.
					</p>
				)}
				<nav aria-label="Sezioni della scheda" className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
					{SEZIONI.map(([ancora, nome]) => (
						<a key={ancora} href={`#${ancora}`} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-2 hover:border-ink-3 hover:text-ink">
							{nome}
						</a>
					))}
				</nav>
			</StaggerItem>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Kpi etichetta="Speso in abbonamenti" valore={r.venduto} opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }} nota={`${intero.format(s.abbonamenti.length)} acquisti`} icona={Icone.abbonamento} />
				<Kpi etichetta="Pagato in cassa" valore={r.incassato} opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }} nota={`${intero.format(s.pagamenti_totale)} movimenti`} icona={Icone.incassi} />
				<Kpi
					etichetta="Rate da pagare"
					valore={r.da_pagare_scaduto + r.da_pagare_futuro}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={r.da_pagare_scaduto > 0 ? `${euro.format(r.da_pagare_scaduto)} già scadute` : "Nessuna rata scaduta"}
					icona={Icone.rate}
					tono={r.da_pagare_scaduto > 0 ? "attenzione" : "neutro"}
				/>
				<Kpi
					etichetta="Presenze, ultimi 12 mesi"
					valore={r.presenze_12m}
					nota={
						r.ultima_presenza
							? `${r.settimane_12m ? `${decimale.format(r.presenze_12m / r.settimane_12m)} volte a settimana · ` : ""}ultima il ${dataBreve(r.ultima_presenza)}`
							: "Nessun accesso registrato"
					}
					icona={Icone.persone}
				/>
			</div>

			<div id="abbonamenti" className="scroll-mt-4">
				<Abbonamenti s={s} />
			</div>
			<div id="rate" className="scroll-mt-4">
				<Rate s={s} />
			</div>
			<div id="pagamenti" className="scroll-mt-4">
				<Pagamenti s={s} />
			</div>
			<div id="accessi" className="scroll-mt-4">
				<Accessi s={s} />
			</div>
			<div id="altro" className="scroll-mt-4">
				<Altro s={s} />
			</div>
			<div id="crm" className="scroll-mt-4">
				<Crm s={s} />
			</div>
		</Stagger>
	);
}

function Vuoto({ testo }: { testo: string }) {
	return <p className="py-4 text-sm text-ink-3">{testo}</p>;
}

function Tabella({ children, min = "40rem" }: { children: React.ReactNode; min?: string }) {
	return (
		<div className="-mx-2 overflow-x-auto px-2">
			<table className="w-full border-collapse text-sm" style={{ minWidth: min }}>
				{children}
			</table>
		</div>
	);
}

function Abbonamenti({ s }: { s: SchedaPersona }) {
	const statoRiga = (a: SchedaPersona["abbonamenti"][number]) => {
		if (!a.inizio || !a.fine) return null;
		if (a.inizio > s.oggi) return <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">Da iniziare</span>;
		if (a.fine >= s.oggi) return <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">In corso</span>;
		return <span className="text-xs text-ink-3">Finito</span>;
	};
	return (
		<Card titolo="Abbonamenti" sottotitolo={`Tutti gli acquisti, dal più recente: ${intero.format(s.abbonamenti.length)}. Comprese le quote associative.`}>
			{s.abbonamenti.length === 0 ? (
				<Vuoto testo="Nessun abbonamento: è un contatto che non ha mai comprato." />
			) : (
				<Tabella min="52rem">
					<thead>
						<tr className="border-b border-line">
							<th scope="col" className={th}>Abbonamento</th>
							<th scope="col" className={th}>Periodo</th>
							<th scope="col" className={th}>Stato</th>
							<th scope="col" className={th}>Venduto il</th>
							<th scope="col" className={th}>Venditore</th>
							<th scope="col" className={thR}>Importo</th>
						</tr>
					</thead>
					<tbody>
						{s.abbonamenti.map((a) => (
							<tr key={a.source_iscrizione_id} className={riga}>
								<td className={td}>
									<span className="block font-medium">{frase(a.abbonamento) || "Abbonamento"}</span>
									<span className="block text-xs text-ink-3">
										{[a.gruppo, a.giorni_sospensione ? `${a.giorni_sospensione} giorni di sospensione` : null, a.disdetta ? `disdetto il ${dataBreve(a.disdetta)}${a.motivo_disdetta ? ` (${frase(a.motivo_disdetta)})` : ""}` : null]
											.filter(Boolean)
											.join(" · ")}
									</span>
								</td>
								<td className={`${td} whitespace-nowrap text-xs text-ink-2`}>
									{data(a.inizio)} → {data(a.fine)}
								</td>
								<td className={td}>{statoRiga(a)}</td>
								<td className={`${td} whitespace-nowrap tabular-nums text-ink-2`}>{data(a.venduto_il)}</td>
								<td className={`${td} text-ink-2`}>{a.venditore ? nomeCompleto(a.venditore, null) : "—"}</td>
								<td className={tdR}>
									<span className="font-medium">{a.totale != null ? euro.format(a.totale) : "—"}</span>
									{a.listino != null && a.totale != null && a.listino > a.totale && (
										<span className="block text-xs text-ink-3">listino {euro.format(a.listino)}</span>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</Tabella>
			)}
			{s.sospensioni.length > 0 && (
				<>
					<h3 className="mb-2 mt-6 text-sm font-semibold">Sospensioni</h3>
					<Tabella>
						<thead>
							<tr className="border-b border-line">
								<th scope="col" className={th}>Periodo</th>
								<th scope="col" className={th}>Abbonamento</th>
								<th scope="col" className={th}>Causale</th>
								<th scope="col" className={thR}>Giorni</th>
							</tr>
						</thead>
						<tbody>
							{s.sospensioni.map((x, i) => (
								<tr key={`${x.inizio}-${i}`} className={riga}>
									<td className={`${td} whitespace-nowrap text-ink-2`}>
										{data(x.inizio)} → {data(x.fine)}
									</td>
									<td className={td}>{frase(x.abbonamento)}</td>
									<td className={`${td} text-ink-2`}>{frase(x.causale) || "—"}</td>
									<td className={tdR}>{x.giorni ?? "—"}</td>
								</tr>
							))}
						</tbody>
					</Tabella>
				</>
			)}
		</Card>
	);
}

function Rate({ s }: { s: SchedaPersona }) {
	if (s.rate.length === 0) return null;
	return (
		<Card titolo="Rate" sottotitolo="Il piano di pagamento degli abbonamenti, dalla scadenza più lontana.">
			<Tabella>
				<thead>
					<tr className="border-b border-line">
						<th scope="col" className={th}>Scadenza</th>
						<th scope="col" className={th}>Abbonamento</th>
						<th scope="col" className={th}>Stato</th>
						<th scope="col" className={th}>Metodo</th>
						<th scope="col" className={thR}>Importo</th>
					</tr>
				</thead>
				<tbody>
					{s.rate.map((x, i) => {
						const scaduta = !x.pagata_il && x.scadenza < s.oggi;
						return (
							<tr key={`${x.scadenza}-${i}`} className={riga}>
								<td className={`${td} whitespace-nowrap tabular-nums`}>{data(x.scadenza)}</td>
								<td className={td}>{frase(x.abbonamento)}</td>
								<td className={td}>
									{x.pagata_il ? (
										<span className="text-xs text-ink-2">Pagata il {dataBreve(x.pagata_il)}</span>
									) : scaduta ? (
										<span className="rounded-full bg-bad-soft px-2 py-0.5 text-xs font-medium text-bad">Scaduta, non pagata</span>
									) : (
										<span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2">Da pagare</span>
									)}
									{x.errore && <span className="block text-xs text-bad">{x.errore}</span>}
								</td>
								<td className={`${td} text-ink-2`}>{x.metodo ?? "—"}</td>
								<td className={`${tdR} font-medium`}>{euro.format(x.importo)}</td>
							</tr>
						);
					})}
				</tbody>
			</Tabella>
		</Card>
	);
}

function Pagamenti({ s }: { s: SchedaPersona }) {
	return (
		<Card
			titolo="Pagamenti in cassa"
			sottotitolo={`${intero.format(s.pagamenti_totale)} movimenti${s.pagamenti_totale > s.pagamenti.length ? `, qui i ${s.pagamenti.length} più recenti` : ""}. Gli importi negativi sono storni e rimborsi.`}
		>
			{s.pagamenti.length === 0 ? (
				<Vuoto testo="Nessun pagamento registrato in cassa." />
			) : (
				<Tabella>
					<thead>
						<tr className="border-b border-line">
							<th scope="col" className={th}>Quando</th>
							<th scope="col" className={th}>Cosa</th>
							<th scope="col" className={th}>Metodo</th>
							<th scope="col" className={th}>Operatore</th>
							<th scope="col" className={thR}>Importo</th>
						</tr>
					</thead>
					<tbody>
						{s.pagamenti.map((x, i) => (
							<tr key={`${x.quando}-${i}`} className={riga}>
								<td className={`${td} whitespace-nowrap tabular-nums`}>{dataOra(x.quando)}</td>
								<td className={td}>
									<span className="block">{frase(x.descrizione) || "—"}</span>
									{x.causale && <span className="block text-xs text-ink-3">{frase(x.causale)}</span>}
								</td>
								<td className={`${td} text-ink-2`}>{x.metodo ?? "—"}</td>
								<td className={`${td} text-ink-2`}>{x.operatore ? nomeCompleto(x.operatore, null) : "—"}</td>
								<td className={`${tdR} font-medium ${x.importo < 0 ? "text-warn" : ""}`}>{euro.format(x.importo)}</td>
							</tr>
						))}
					</tbody>
				</Tabella>
			)}
		</Card>
	);
}

function Accessi({ s }: { s: SchedaPersona }) {
	const r = s.riepilogo;
	const perMese = new Map(s.presenze_mesi.map((m) => [m.mese.slice(0, 7), m.presenze]));
	const [y, mm] = s.oggi.split("-").map(Number);
	const colonne: ColonnaConfronto[] = Array.from({ length: 12 }, (_, i) => {
		const mese = new Date(Date.UTC(y, mm - 1 - 11 + i, 1)).toISOString().slice(0, 10);
		const prima = `${Number(mese.slice(0, 4)) - 1}${mese.slice(4)}`;
		return {
			etichetta: meseCorto(mese),
			secondaRiga: mese.slice(5, 7) === "01" ? mese.slice(0, 4) : undefined,
			nomeCompleto: meseLungo(mese) + (i === 11 ? " (in corso)" : ""),
			valore: perMese.get(mese.slice(0, 7)) ?? 0,
			confronto: perMese.get(prima.slice(0, 7)) ?? 0,
			nomeConfronto: meseLungo(prima),
		};
	});
	const GIORNI = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
	const maxDow = Math.max(1, ...s.presenze_dow.map((d) => d.presenze));

	return (
		<Card
			titolo="Accessi"
			sottotitolo={
				r.presenze > 0
					? `${intero.format(r.presenze)} presenze in tutto, dal ${data(r.prima_presenza)} al ${data(r.ultima_presenza)}.`
					: "Nessun passaggio ai tornelli."
			}
		>
			{r.presenze > 0 && (
				<div className="grid gap-6 lg:grid-cols-3">
					<div className="lg:col-span-2">
						<h3 className="mb-2 text-sm font-semibold">Presenze per mese, ultimi 12 mesi</h3>
						<BarreConfronto colonne={colonne} formato="numero" nomeMisura="Presenze per mese con l'anno prima" nomeCorrente="Presenze" nomeConfronto="Stesso mese, anno prima" />
					</div>
					<div>
						<h3 className="mb-3 text-sm font-semibold">Giorni preferiti, ultimi 12 mesi</h3>
						<ul className="m-0 flex list-none flex-col gap-2 p-0">
							{GIORNI.map((g, i) => {
								const v = s.presenze_dow.find((d) => d.dow === i + 1)?.presenze ?? 0;
								return (
									<li key={g} className="flex items-center gap-2 text-sm">
										<span className="w-8 text-ink-3">{g}</span>
										<span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
											<span className="block h-full rounded-full bg-accent" style={{ width: `${(v / maxDow) * 100}%` }} />
										</span>
										<span className="w-8 text-right tabular-nums">{v}</span>
									</li>
								);
							})}
						</ul>
					</div>
				</div>
			)}
			{s.accessi.length > 0 && (
				<>
					<h3 className="mb-2 mt-6 text-sm font-semibold">Ultimi {s.accessi.length} passaggi ai tornelli</h3>
					<div className="max-h-96 overflow-y-auto">
						<Tabella>
							<thead className="sticky top-0 bg-surface">
								<tr className="border-b border-line">
									<th scope="col" className={th}>Quando</th>
									<th scope="col" className={th}>Varco</th>
									<th scope="col" className={th}>Esito</th>
								</tr>
							</thead>
							<tbody>
								{s.accessi.map((x, i) => (
									<tr key={`${x.quando}-${i}`} className={riga}>
										<td className={`${td} whitespace-nowrap tabular-nums`}>{dataOra(x.quando)}</td>
										<td className={`${td} text-ink-2`}>{x.varco ?? "—"}</td>
										<td className={td}>
											{x.tipo != null && x.tipo < 0 ? (
												<span className="rounded-full bg-bad-soft px-2 py-0.5 text-xs font-medium text-bad">Rifiutato: {x.esito ?? x.tipo}</span>
											) : (
												<span className="text-ink-2">{x.esito ?? "—"}</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</Tabella>
					</div>
				</>
			)}
		</Card>
	);
}

function Altro({ s }: { s: SchedaPersona }) {
	const vuoto = s.certificati.length + s.quote.length + s.prenotazioni.length + s.corsi.length + s.omaggi.length === 0;
	return (
		<Card titolo="Certificati, quote, prenotazioni, corsi, omaggi">
			{vuoto && <Vuoto testo="Niente da mostrare." />}
			<div className="grid gap-6 lg:grid-cols-2">
				{s.certificati.length > 0 && (
					<div>
						<h3 className="mb-2 text-sm font-semibold">Certificati medici</h3>
						<ul className="m-0 list-none p-0 text-sm">
							{s.certificati.map((c, i) => {
								const valido = c.scadenza && c.scadenza >= s.oggi;
								return (
									<li key={i} className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-0">
										<span>{frase(c.descrizione) || "Certificato"}</span>
										<span className={`whitespace-nowrap text-xs ${valido ? "text-accent-strong" : "text-ink-3"}`}>
											{valido ? "valido fino al" : "scaduto il"} {data(c.scadenza)}
										</span>
									</li>
								);
							})}
						</ul>
					</div>
				)}
				{s.quote.length > 0 && (
					<div>
						<h3 className="mb-2 text-sm font-semibold">Quote associative</h3>
						<ul className="m-0 list-none p-0 text-sm">
							{s.quote.map((q, i) => (
								<li key={i} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
									<span className="text-ink-2">
										{data(q.inizio)} → {data(q.fine)}
									</span>
									<span className="tabular-nums">{q.importo != null ? euro.format(q.importo) : "—"}</span>
								</li>
							))}
						</ul>
					</div>
				)}
				{s.prenotazioni.length > 0 && (
					<div>
						<h3 className="mb-2 text-sm font-semibold">
							Prenotazioni{s.prenotazioni_totale > s.prenotazioni.length ? ` (le ultime ${s.prenotazioni.length} di ${intero.format(s.prenotazioni_totale)})` : ""}
						</h3>
						<ul className="m-0 max-h-72 list-none overflow-y-auto p-0 text-sm">
							{s.prenotazioni.map((x, i) => (
								<li key={i} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
									<span>
										{frase(x.cosa) || "Prenotazione"}
										<span className="block text-xs text-ink-3">{dataOra(x.quando)}</span>
									</span>
									<span className="tabular-nums text-ink-2">{x.totale ? euro.format(x.totale) : ""}</span>
								</li>
							))}
						</ul>
					</div>
				)}
				{s.corsi.length > 0 && (
					<div>
						<h3 className="mb-2 text-sm font-semibold">Iscrizioni ai corsi</h3>
						<ul className="m-0 list-none p-0 text-sm">
							{s.corsi.map((c, i) => (
								<li key={i} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
									<span className="text-ink-2">
										{data(c.inizio)} → {data(c.fine)}
										{c.lezioni ? ` · ${c.lezioni} lezioni` : ""}
										{c.terminato ? " · terminato" : ""}
									</span>
									<span className="tabular-nums">{c.importo ? euro.format(c.importo) : ""}</span>
								</li>
							))}
						</ul>
					</div>
				)}
				{s.omaggi.length > 0 && (
					<div>
						<h3 className="mb-2 text-sm font-semibold">Omaggi</h3>
						<ul className="m-0 list-none p-0 text-sm">
							{s.omaggi.map((o, i) => (
								<li key={i} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
									<span className="text-ink-2">
										{data(o.inizio)} → {data(o.fine)}
									</span>
									<span className="tabular-nums">
										{o.usati ?? 0} usati su {o.totali ?? 0}
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</Card>
	);
}

function Crm({ s }: { s: SchedaPersona }) {
	const vuoto = s.pratiche.length + s.memo.length + s.email.length === 0;
	return (
		<Card titolo="CRM ed email" sottotitolo="Trattative, note e email registrate in Info4U.">
			{vuoto && <Vuoto testo="Niente da mostrare." />}
			{s.memo.length > 0 && (
				<div className="mb-6">
					<h3 className="mb-2 text-sm font-semibold">Note</h3>
					<ul className="m-0 list-none p-0 text-sm">
						{s.memo.map((m, i) => (
							<li key={i} className="border-b border-line py-2 last:border-0">
								<span className="block font-medium">{m.oggetto || "Nota"}</span>
								{m.testo && <span className="block whitespace-pre-line text-ink-2">{m.testo}</span>}
								<span className="block text-xs text-ink-3">{m.quando ? dataOra(m.quando) : ""}</span>
							</li>
						))}
					</ul>
				</div>
			)}
			{s.pratiche.length > 0 && (
				<div className="mb-6">
					<h3 className="mb-2 text-sm font-semibold">Pratiche commerciali</h3>
					<Tabella>
						<thead>
							<tr className="border-b border-line">
								<th scope="col" className={th}>Aperta il</th>
								<th scope="col" className={th}>Pratica</th>
								<th scope="col" className={th}>Stato</th>
								<th scope="col" className={thR}>Valore</th>
							</tr>
						</thead>
						<tbody>
							{s.pratiche.map((x, i) => (
								<tr key={i} className={riga}>
									<td className={`${td} whitespace-nowrap tabular-nums`}>{data(x.creata)}</td>
									<td className={td}>{frase(x.descrizione) || "—"}</td>
									<td className={`${td} text-ink-2`}>
										{x.stato ?? "—"}
										{x.chiusa && <span className="block text-xs text-ink-3">chiusa il {dataBreve(x.chiusa)}</span>}
									</td>
									<td className={tdR}>{x.valore ? euro.format(x.valore) : "—"}</td>
								</tr>
							))}
						</tbody>
					</Tabella>
				</div>
			)}
			{s.email.length > 0 && (
				<div>
					<h3 className="mb-2 text-sm font-semibold">Email inviate da Info4U</h3>
					<ul className="m-0 list-none p-0 text-sm">
						{s.email.map((x, i) => (
							<li key={i} className="flex justify-between gap-3 border-b border-line py-2 last:border-0">
								<span>
									{x.oggetto || "Email"}
									{x.errore && <span className="block text-xs text-bad">{x.errore}</span>}
								</span>
								<span className="whitespace-nowrap text-xs text-ink-3">{dataOra(x.quando)}</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</Card>
	);
}

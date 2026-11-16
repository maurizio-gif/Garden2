import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BarreConfronto, type ColonnaConfronto } from "@/components/barre-confronto";
import { Card, Titolo } from "@/components/card";
import { Delta } from "@/components/delta";
import { Icone, Kpi } from "@/components/kpi";
import { MappaOre } from "@/components/mappa-ore";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { RankedBars } from "@/components/ranked-bars";
import { ListaAccessi } from "@/components/righe";
import { ScheletroLista } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { PRESET, aggiungiAnni, dataValida, periodoDaPreset, type Preset } from "@/lib/analisi";
import { leggiAccessi, leggiAccessiMensile, leggiDashboardAccessi, oggiARoma } from "@/lib/data";
import { dataBreve, frase, intero, meseCorto, meseLungo, nomeCompleto } from "@/lib/format";
import type { DashboardAccessi } from "@/lib/types";

export const metadata: Metadata = { title: "Accessi" };

type Cerca = Record<string, string | string[] | undefined>;

export default function Pagina({ searchParams }: { searchParams: Promise<Cerca> }) {
	return (
		<>
			<div className="mb-4">
				<Titolo>Accessi</Titolo>
				<p className="mt-1 max-w-3xl text-sm text-ink-3">
					Chi entra, quando e da dove, a confronto con lo stesso periodo dell&apos;anno prima. Una <b className="font-medium text-ink-2">presenza</b> è una
					persona in un giorno: chi passa tre volte nello stesso giorno conta una volta.
				</p>
			</div>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto searchParams={searchParams} />
			</Suspense>
		</>
	);
}

const PERIODI: Preset[] = ["mese", "mese_scorso", "90g", "stagione", "anno", "12m", "anno_scorso"];
const primo = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const decimale = new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const GIORNI_CORTI = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

function periodo(cerca: Cerca, oggi: string) {
	const p = PRESET.find((x) => x.valore === primo(cerca.p))?.valore;
	const da0 = primo(cerca.da);
	const a0 = primo(cerca.a);
	if (!p && dataValida(da0) && dataValida(a0)) {
		return da0 <= a0 ? { preset: null, da: da0, a: a0 } : { preset: null, da: a0, a: da0 };
	}
	const preset = p ?? "90g";
	return { preset, ...periodoDaPreset(preset, oggi) };
}

const variazione = (ora: number, prima: number) => (prima > 0 ? ((ora - prima) / prima) * 100 : undefined);
const frequenza = (presenze: number, settimane: number) => (settimane > 0 ? presenze / settimane : 0);

async function Contenuto({ searchParams }: { searchParams: Promise<Cerca> }) {
	const cerca = await searchParams;
	// La pagina si calcola a ogni richiesta: «oggi» non si fissa al momento del build.
	await connection();
	const oggi = oggiARoma();
	const per = periodo(cerca, oggi);
	const prima = { da: aggiungiAnni(per.da, -1), a: aggiungiAnni(per.a > oggi ? oggi : per.a, -1) };

	const [{ dati: d, modo, adesso }, { dati: p }, { dati: m }, { dati: recenti }] = await Promise.all([
		leggiDashboardAccessi(per.da, per.a),
		leggiDashboardAccessi(prima.da, prima.a),
		leggiAccessiMensile(),
		leggiAccessi(),
	]);

	const t = d.totali;
	const tp = p.totali;
	const freq = frequenza(t.presenze, t.settimane_persona);
	const freqPrima = frequenza(tp.presenze, tp.settimane_persona);
	const alGiorno = t.giorni > 0 ? t.presenze / t.giorni : 0;
	const alGiornoPrima = tp.giorni > 0 ? tp.presenze / tp.giorni : 0;
	const nomePeriodo = `${dataBreve(d.da)} – ${dataBreve(d.a)}`;
	const nomePrima = `${dataBreve(p.da)} – ${dataBreve(p.a)}`;
	const passaggi = t.ingressi + t.rifiutati;

	// Mese per mese: gli ultimi 24, ognuno accanto allo stesso mese dell'anno prima.
	const perMese = new Map(m.mesi.map((x) => [x.mese.slice(0, 7), x]));
	const ultimi24 = Array.from({ length: 24 }, (_, i) => {
		const [y, mm] = oggi.split("-").map(Number);
		return new Date(Date.UTC(y, mm - 1 - 23 + i, 1)).toISOString().slice(0, 10);
	});
	const colonneMese = (valore: (x: { presenze: number; persone: number; settimane_persona: number }) => number): ColonnaConfronto[] =>
		ultimi24.map((mese, i) => {
			const cur = perMese.get(mese.slice(0, 7));
			const meseP = `${Number(mese.slice(0, 4)) - 1}${mese.slice(4)}`;
			const pre = perMese.get(meseP.slice(0, 7));
			return {
				etichetta: meseCorto(mese),
				secondaRiga: mese.slice(5, 7) === "01" ? mese.slice(0, 4) : undefined,
				nomeCompleto: meseLungo(mese) + (i === 23 ? " (in corso)" : ""),
				valore: cur ? valore(cur) : 0,
				confronto: pre ? valore(pre) : null,
				nomeConfronto: meseLungo(meseP),
			};
		});

	// Giorni della settimana: presenze medie in un giorno tipo.
	const media = (x: DashboardAccessi, dow: number) => {
		const g = x.giorni_settimana.find((r) => r.dow === dow);
		return g && g.giorni > 0 ? g.presenze / g.giorni : 0;
	};
	const colonneDow: ColonnaConfronto[] = GIORNI.map((nome, i) => ({
		etichetta: GIORNI_CORTI[i],
		nomeCompleto: `${nome}, media`,
		valore: Math.round(media(d, i + 1)),
		confronto: Math.round(media(p, i + 1)),
		nomeConfronto: `${nome} nel ${nomePrima}`,
	}));

	const varchiPrima = new Map(p.varchi.map((v) => [v.varco, v]));
	const gruppiPrima = new Map(p.gruppi.map((g) => [g.gruppo, g]));
	const link = (extra: Record<string, string>) => `/accessi?${new URLSearchParams(extra).toString()}`;

	return (
		<Stagger className="flex flex-col gap-4">
			<StaggerItem className="flex flex-col gap-3">
				<StatoDati
					modo={modo}
					aggiornatoAl={d.ultimo_accesso}
					adesso={adesso}
					fresco="Ultimo accesso"
					fermo="Ultimo accesso registrato il"
					vuoto="Nessun accesso registrato"
				/>
				<nav aria-label="Periodo" className="flex flex-wrap items-center gap-2">
					{PERIODI.map((v) => {
						const attivo = per.preset === v;
						return (
							<Link
								key={v}
								href={link({ p: v })}
								scroll={false}
								aria-current={attivo ? "true" : undefined}
								className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
									attivo ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface text-ink-2 hover:text-ink"
								}`}
							>
								{PRESET.find((x) => x.valore === v)?.nome}
							</Link>
						);
					})}
					<form method="get" action="/accessi" className="ml-auto flex flex-wrap items-center gap-2 text-xs">
						<label className="flex items-center gap-1.5 text-ink-3">
							dal
							<input type="date" name="da" defaultValue={per.da} className="rounded-lg border border-line bg-surface px-2 py-1 text-ink" />
						</label>
						<label className="flex items-center gap-1.5 text-ink-3">
							al
							<input type="date" name="a" defaultValue={per.a} className="rounded-lg border border-line bg-surface px-2 py-1 text-ink" />
						</label>
						<button type="submit" className="rounded-lg bg-accent px-3 py-1 font-medium text-white hover:bg-accent-strong">
							Vai
						</button>
					</form>
				</nav>
				<p className="text-xs text-ink-3">
					{nomePeriodo}, a confronto con {nomePrima}.
				</p>
			</StaggerItem>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Kpi
					etichetta="Presenze"
					valore={t.presenze}
					nota={`${intero.format(t.ingressi)} passaggi ai tornelli`}
					icona={Icone.persone}
					delta={tp.presenze > 0 ? { percentuale: variazione(t.presenze, tp.presenze) ?? 0, riferimento: `contro ${intero.format(tp.presenze)} l'anno prima` } : undefined}
				/>
				<Kpi
					etichetta="Persone diverse"
					valore={t.persone}
					nota="Almeno un ingresso nel periodo"
					icona={Icone.persone}
					delta={tp.persone > 0 ? { percentuale: variazione(t.persone, tp.persone) ?? 0, riferimento: `contro ${intero.format(tp.persone)} l'anno prima` } : undefined}
				/>
				<Kpi
					etichetta="Volte a settimana, in media"
					valore={freq}
					opzioni={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
					nota="Nelle settimane in cui la persona viene"
					icona={Icone.rinnovo}
					delta={freqPrima > 0 ? { percentuale: variazione(freq, freqPrima) ?? 0, riferimento: `contro ${decimale.format(freqPrima)} l'anno prima` } : undefined}
				/>
				<Kpi
					etichetta="Presenze al giorno, in media"
					valore={Math.round(alGiorno)}
					nota={`Su ${intero.format(t.giorni)} giorni di calendario`}
					icona={Icone.scadenza}
					delta={alGiornoPrima > 0 ? { percentuale: variazione(alGiorno, alGiornoPrima) ?? 0, riferimento: `contro ${intero.format(Math.round(alGiornoPrima))} l'anno prima` } : undefined}
				/>
			</div>

			<div className="grid gap-4 xl:grid-cols-2">
				<Card titolo="Presenze, mese per mese" sottotitolo="Ultimi 24 mesi; in grigio lo stesso mese dell'anno prima. Passa sopra una colonna per la differenza.">
					<BarreConfronto
						colonne={colonneMese((x) => x.presenze)}
						formato="numero"
						nomeMisura="Presenze per mese, ultimi 24 mesi, con l'anno prima"
						nomeCorrente="Presenze"
						nomeConfronto="Stesso mese, anno prima"
					/>
				</Card>
				<Card titolo="Volte a settimana, mese per mese" sottotitolo="Quante volte a settimana viene, in media, chi viene. In grigio lo stesso mese dell'anno prima.">
					<BarreConfronto
						colonne={colonneMese((x) => Math.round(frequenza(x.presenze, x.settimane_persona) * 10) / 10)}
						formato="decimale"
						nomeMisura="Frequenza settimanale per mese, ultimi 24 mesi, con l'anno prima"
						nomeCorrente="Volte a settimana"
						nomeConfronto="Stesso mese, anno prima"
					/>
				</Card>
			</div>

			<div className="grid gap-4 xl:grid-cols-5">
				<Card
					className="xl:col-span-2"
					titolo="Giorni della settimana"
					sottotitolo="Presenze in un giorno tipo del periodo; in grigio l'anno prima."
				>
					<BarreConfronto
						colonne={colonneDow}
						formato="numero"
						nomeMisura="Presenze medie per giorno della settimana"
						nomeCorrente={nomePeriodo}
						nomeConfronto={nomePrima}
					/>
				</Card>
				<Card className="xl:col-span-3" titolo="A che ora arrivano" sottotitolo="Ora del primo ingresso della giornata, per giorno della settimana, nel periodo scelto.">
					<MappaOre celle={d.ore} />
				</Card>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card titolo="Varchi e tornelli" sottotitolo="Passaggi validi per varco; la barra chiara è l'anno prima. Accanto, i passaggi rifiutati.">
					<RankedBars
						unita="passaggi"
						righe={d.varchi.map((v) => ({ etichetta: v.varco, valore: v.ingressi, confronto: varchiPrima.get(v.varco)?.ingressi ?? null }))}
					/>
					<table className="mt-5 w-full border-collapse text-sm">
						<thead>
							<tr className="text-left text-xs text-ink-3">
								<th scope="col" className="pb-2 font-medium">Varco</th>
								<th scope="col" className="pb-2 text-right font-medium">Passaggi</th>
								<th scope="col" className="pb-2 text-right font-medium">Anno prima</th>
								<th scope="col" className="pb-2 text-right font-medium">Rifiutati</th>
							</tr>
						</thead>
						<tbody>
							{d.varchi.map((v) => (
								<tr key={v.varco} className="border-t border-line">
									<th scope="row" className="py-2 text-left font-medium">{v.varco}</th>
									<td className="py-2 text-right tabular-nums">{intero.format(v.ingressi)}</td>
									<td className="py-2 text-right">
										<Delta ora={v.ingressi} prima={varchiPrima.get(v.varco)?.ingressi} />
									</td>
									<td className="py-2 text-right tabular-nums text-ink-2">{intero.format(v.rifiutati)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</Card>
				<Card
					titolo="Passaggi rifiutati, per motivo"
					sottotitolo={`${intero.format(t.rifiutati)} rifiutati, ${passaggi > 0 ? decimale.format((t.rifiutati / passaggi) * 100) : "0"}% di tutti i passaggi (anno prima: ${intero.format(tp.rifiutati)}).`}
				>
					<RankedBars unita="rifiuti" righe={d.rifiuti.slice(0, 10).map((r) => ({ etichetta: r.motivo, valore: r.n }))} />
				</Card>
			</div>

			<Card
				titolo="Abbonamenti con più presenze"
				sottotitolo="L'abbonamento che ha aperto il tornello. «Volte a settimana» = presenze ÷ settimane in cui ognuno è venuto con quell'abbonamento."
			>
				<div className="mb-5 grid gap-x-8 gap-y-2 sm:grid-cols-2">
					{d.gruppi
						.filter((g) => g.gruppo !== "Senza abbonamento")
						.map((g) => {
							const gp = gruppiPrima.get(g.gruppo);
							return (
								<div key={g.gruppo} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-sm">
									<span className="font-medium">{g.gruppo}</span>
									<span className="flex items-baseline gap-3 tabular-nums">
										<span>{intero.format(g.presenze)} presenze</span>
										<span className="text-ink-3">{decimale.format(frequenza(g.presenze, g.settimane_persona))}/sett.</span>
										<Delta ora={g.presenze} prima={gp?.presenze} />
									</span>
								</div>
							);
						})}
				</div>
				<div className="-mx-2 overflow-x-auto px-2">
					<table className="w-full min-w-[40rem] border-collapse text-sm">
						<thead>
							<tr className="border-b border-line text-left text-xs text-ink-3">
								<th scope="col" className="px-3 py-2 font-medium">Abbonamento</th>
								<th scope="col" className="px-3 py-2 text-right font-medium">Presenze</th>
								<th scope="col" className="px-3 py-2 text-right font-medium">Persone</th>
								<th scope="col" className="px-3 py-2 text-right font-medium">Presenze a persona</th>
								<th scope="col" className="px-3 py-2 text-right font-medium">Volte a settimana</th>
							</tr>
						</thead>
						<tbody>
							{d.abbonamenti.slice(0, 25).map((a) => (
								<tr key={`${a.abbonamento}-${a.gruppo}`} className="border-b border-line last:border-0 hover:bg-surface-2/60">
									<td className="px-3 py-2.5">
										<span className="block font-medium">{frase(a.abbonamento)}</span>
										<span className="block text-xs text-ink-3">{a.gruppo}</span>
									</td>
									<td className="px-3 py-2.5 text-right tabular-nums">{intero.format(a.presenze)}</td>
									<td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{intero.format(a.persone)}</td>
									<td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{decimale.format(a.persone ? a.presenze / a.persone : 0)}</td>
									<td className="px-3 py-2.5 text-right font-medium tabular-nums">{decimale.format(frequenza(a.presenze, a.settimane_persona))}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Card>

			<Card titolo="Chi viene di più" sottotitolo={`Le 30 persone con più presenze dal ${dataBreve(d.da)} al ${dataBreve(d.a)}.`}>
				<div className="-mx-2 overflow-x-auto px-2">
					<table className="w-full min-w-[36rem] border-collapse text-sm">
						<thead>
							<tr className="border-b border-line text-left text-xs text-ink-3">
								<th scope="col" className="px-3 py-2 font-medium">#</th>
								<th scope="col" className="px-3 py-2 font-medium">Persona</th>
								<th scope="col" className="px-3 py-2 text-right font-medium">Presenze</th>
								<th scope="col" className="px-3 py-2 text-right font-medium">Settimane</th>
								<th scope="col" className="px-3 py-2 text-right font-medium">Volte a settimana</th>
								<th scope="col" className="px-3 py-2 text-right font-medium">Passaggi</th>
							</tr>
						</thead>
						<tbody>
							{d.utenti.map((u, i) => (
								<tr key={`${u.cognome}-${u.nome}-${i}`} className="border-b border-line last:border-0 hover:bg-surface-2/60">
									<td className="px-3 py-2.5 tabular-nums text-ink-3">{i + 1}</td>
									<td className="px-3 py-2.5 font-medium">{nomeCompleto(u.nome, u.cognome)}</td>
									<td className="px-3 py-2.5 text-right tabular-nums">{intero.format(u.presenze)}</td>
									<td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{intero.format(u.settimane)}</td>
									<td className="px-3 py-2.5 text-right font-medium tabular-nums">{decimale.format(frequenza(u.presenze, u.settimane))}</td>
									<td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{intero.format(u.ingressi)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Card>

			<Card titolo="Ultimi passaggi ai tornelli" sottotitolo={recenti.accessi.length > 0 ? `Gli ultimi ${recenti.accessi.length}` : undefined}>
				<ListaAccessi accessi={recenti.accessi} />
			</Card>
		</Stagger>
	);
}

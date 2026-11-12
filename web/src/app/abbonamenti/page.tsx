import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Titolo } from "@/components/card";
import { ConfrontoMensile } from "@/components/confronto-mensile";
import { Delta } from "@/components/delta";
import { Icone, Kpi } from "@/components/kpi";
import { MovimentoChart, type PuntoMovimento } from "@/components/movimento-chart";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { ListaVendite } from "@/components/righe";
import { ScheletroLista } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import type { SerieAnno } from "@/components/linee-anni";
import { leggiAbbonamenti, leggiConfronto } from "@/lib/data";
import { dataBreve, euro, intero, meseCorto, meseLungo } from "@/lib/format";
import type { ConfrontoAnni } from "@/lib/types";

export const metadata: Metadata = { title: "Abbonamenti" };

export default function Pagina() {
	return (
		<>
			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<Titolo>Abbonamenti</Titolo>
				<Link
					href="/analisi"
					className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
				>
					Analisi personalizzata
					<span aria-hidden="true">→</span>
				</Link>
			</div>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto />
			</Suspense>
		</>
	);
}

const cella = "px-3 py-2.5 text-right tabular-nums";
const testa = "px-3 py-2 text-right text-xs font-medium text-ink-3";

function nomeAnno(anniFa: number, giorno: string) {
	return anniFa === 0 ? "Oggi" : `${giorno.slice(0, 4)}`;
}

async function Contenuto() {
	const [{ dati: c, modo, adesso }, { dati: recenti }] = await Promise.all([leggiConfronto(), leggiAbbonamenti()]);

	const annoCorrente = Number(c.oggi.slice(0, 4));
	const meseCorrente = Number(c.oggi.slice(5, 7)) - 1;

	const totIscritti = (k: number) => c.iscritti.find((r) => r.anni_fa === k && r.gruppo === null)?.persone ?? 0;
	const totYtd = (k: number) => c.ytd.find((r) => r.anni_fa === k && r.gruppo === null);
	const ytd0 = totYtd(0);
	const ytd1 = totYtd(1);

	// Serie mensili: un anno per linea. L'anno in corso si ferma al mese in corso.
	const anni = c.anni.map((a) => annoCorrente - a.anni_fa);
	const serie = (campo: "fatturato" | "vendite"): SerieAnno[] =>
		anni.map((anno, k) => ({
			nome: String(anno),
			indice: k,
			valori: Array.from({ length: 12 }, (_, m) => {
				if (anno === annoCorrente && m > meseCorrente) return null;
				const r = c.mensile.find((x) => x.anno === anno && x.mese === m + 1);
				return r ? r[campo] : 0;
			}),
		}));

	// Gruppi, dal più grande oggi.
	const gruppi = Array.from(new Set(c.iscritti.filter((r) => r.gruppo !== null).map((r) => r.gruppo as string)))
		.filter((g) => g !== "Quote e tessere" && g !== "Altro")
		.sort((a, b) => iscrittiGruppo(c, b, 0) - iscrittiGruppo(c, a, 0));

	const movimento: PuntoMovimento[] = c.movimento.map((m, i) => ({
		etichetta: meseCorto(m.mese),
		secondaRiga: m.mese.slice(5, 7) === "01" ? m.mese.slice(0, 4) : undefined,
		nomeCompleto: meseLungo(m.mese),
		nuovi: m.nuovi,
		rientri: m.rientri,
		usciti: m.usciti,
		attivi: m.attivi,
		incompleto: i === c.movimento.length - 1,
	}));

	const stessoGiornoScorso = c.anni.find((a) => a.anni_fa === 1)?.giorno;

	return (
		<Stagger className="flex flex-col gap-4">
			<StaggerItem>
				<StatoDati modo={modo} aggiornatoAl={c.aggiornato_al} adesso={adesso} />
			</StaggerItem>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Kpi
					etichetta="Iscritti oggi"
					valore={totIscritti(0)}
					nota="Persone con un abbonamento in corso, esclusa la quota associativa"
					icona={Icone.persone}
					delta={
						totIscritti(1) > 0
							? {
									percentuale: ((totIscritti(0) - totIscritti(1)) / totIscritti(1)) * 100,
									riferimento: `rispetto al ${stessoGiornoScorso ? dataBreve(stessoGiornoScorso) : "giorno stesso dell'anno scorso"}`,
								}
							: undefined
					}
				/>
				<Kpi
					etichetta="Venduto da inizio anno"
					valore={ytd0?.fatturato ?? 0}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota="Somma dei totali degli abbonamenti venduti, quote escluse"
					icona={Icone.incassi}
					delta={
						ytd1 && ytd1.fatturato > 0
							? {
									percentuale: (((ytd0?.fatturato ?? 0) - ytd1.fatturato) / ytd1.fatturato) * 100,
									riferimento: "rispetto allo stesso periodo dell'anno scorso",
								}
							: undefined
					}
				/>
				<Kpi
					etichetta="Vendite da inizio anno"
					valore={ytd0?.vendite ?? 0}
					nota="Contratti venduti, non persone"
					icona={Icone.rate}
					delta={
						ytd1 && ytd1.vendite > 0
							? {
									percentuale: (((ytd0?.vendite ?? 0) - ytd1.vendite) / ytd1.vendite) * 100,
									riferimento: "rispetto allo stesso periodo dell'anno scorso",
								}
							: undefined
					}
				/>
				<Kpi
					etichetta="Persone che hanno comprato da inizio anno"
					valore={ytd0?.persone ?? 0}
					nota="Persone diverse"
					icona={Icone.scadenza}
					delta={
						ytd1 && ytd1.persone > 0
							? {
									percentuale: (((ytd0?.persone ?? 0) - ytd1.persone) / ytd1.persone) * 100,
									riferimento: "rispetto allo stesso periodo dell'anno scorso",
								}
							: undefined
					}
				/>
			</div>

			<Card
				titolo="Iscritti: oggi e lo stesso giorno degli anni passati"
				sottotitolo="Persone con un abbonamento già venduto, iniziato e non ancora finito a quella data. Accanto a oggi, la differenza con l'anno scorso."
			>
				<div className="-mx-2 overflow-x-auto px-2">
					<table className="w-full min-w-[34rem] border-collapse text-sm">
						<thead>
							<tr className="border-b border-line">
								<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
									Gruppo di prodotti
								</th>
								{c.anni.map((a) => (
									<th key={a.anni_fa} scope="col" className={testa}>
										{nomeAnno(a.anni_fa, a.giorno)}
										<span className="block font-normal">{dataBreve(a.giorno)}</span>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							<tr className="border-b border-line bg-surface-2/60 font-semibold">
								<th scope="row" className="px-3 py-2.5 text-left">
									Totale persone
								</th>
								{c.anni.map((a) => (
									<td key={a.anni_fa} className={cella}>
										{intero.format(totIscritti(a.anni_fa))}
										{a.anni_fa === 0 && (
											<span className="mt-0.5 block font-normal">
												<Delta ora={totIscritti(0)} prima={totIscritti(1)} assoluto />
											</span>
										)}
									</td>
								))}
							</tr>
							{gruppi.map((g) => (
								<tr key={g} className="border-b border-line last:border-0">
									<th scope="row" className="px-3 py-2.5 text-left font-normal text-ink-2">
										{g}
									</th>
									{c.anni.map((a) => (
										<td key={a.anni_fa} className={cella}>
											{intero.format(iscrittiGruppo(c, g, a.anni_fa))}
											{a.anni_fa === 0 && (
												<span className="mt-0.5 block">
													<Delta ora={iscrittiGruppo(c, g, 0)} prima={iscrittiGruppo(c, g, 1)} assoluto />
												</span>
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<p className="mt-3 text-xs text-ink-3">
					Una persona con abbonamenti in due gruppi conta in entrambi, quindi la somma dei gruppi supera il totale. Gli
					abbonamenti cancellati in Info4U non ci sono più: il passato è «com&apos;è oggi in archivio».
				</p>
			</Card>

			<Card
				titolo="Mese per mese, un anno per linea"
				sottotitolo="Quello che si è venduto in ogni mese. Clicca un anno nella legenda per nasconderlo; passa sopra un mese per i valori."
			>
				<ConfrontoMensile fatturato={serie("fatturato")} vendite={serie("vendite")} meseCorrente={meseCorrente} />
				<p className="mt-3 text-xs text-ink-3">
					Il mese in corso è parziale: per questo l&apos;ultimo tratto dell&apos;anno in corso è tratteggiato.
				</p>
			</Card>

			<Card
				titolo="Da inizio anno, anno per anno"
				sottotitolo={`Dal 1 gennaio al ${c.oggi.slice(8, 10).replace(/^0/, "")}/${c.oggi.slice(5, 7).replace(/^0/, "")} di ogni anno. Accanto, la differenza con l'anno prima.`}
			>
				<div className="-mx-2 overflow-x-auto px-2">
					<table className="w-full min-w-[34rem] border-collapse text-sm">
						<thead>
							<tr className="border-b border-line">
								<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
									Anno
								</th>
								<th scope="col" className={testa}>
									Venduto
								</th>
								<th scope="col" className={testa}>
									Vendite
								</th>
								<th scope="col" className={testa}>
									Persone
								</th>
								<th scope="col" className={testa}>
									Spesa media
								</th>
							</tr>
						</thead>
						<tbody>
							{c.anni.map((a) => {
								const r = totYtd(a.anni_fa);
								const p = totYtd(a.anni_fa + 1);
								if (!r) return null;
								return (
									<tr key={a.anni_fa} className={`border-b border-line last:border-0 ${a.anni_fa === 0 ? "font-semibold" : ""}`}>
										<th scope="row" className="px-3 py-2.5 text-left">
											{a.inizio.slice(0, 4)}
										</th>
										<td className={cella}>
											{euro.format(r.fatturato)}
											{p && (
												<span className="ml-2 inline-block font-normal">
													<Delta ora={r.fatturato} prima={p.fatturato} />
												</span>
											)}
										</td>
										<td className={cella}>
											{intero.format(r.vendite)}
											{p && (
												<span className="ml-2 inline-block font-normal">
													<Delta ora={r.vendite} prima={p.vendite} />
												</span>
											)}
										</td>
										<td className={cella}>
											{intero.format(r.persone)}
											{p && (
												<span className="ml-2 inline-block font-normal">
													<Delta ora={r.persone} prima={p.persone} />
												</span>
											)}
										</td>
										<td className={cella}>{r.persone > 0 ? euro.format(r.fatturato / r.persone) : "—"}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				<h3 className="mb-2 mt-6 text-sm font-semibold">Per gruppo di prodotti, venduto da inizio anno</h3>
				<div className="-mx-2 overflow-x-auto px-2">
					<table className="w-full min-w-[34rem] border-collapse text-sm">
						<thead>
							<tr className="border-b border-line">
								<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
									Gruppo
								</th>
								{c.anni.map((a) => (
									<th key={a.anni_fa} scope="col" className={testa}>
										{a.inizio.slice(0, 4)}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{gruppi.map((g) => (
								<tr key={g} className="border-b border-line last:border-0">
									<th scope="row" className="px-3 py-2.5 text-left font-normal text-ink-2">
										{g}
									</th>
									{c.anni.map((a) => {
										const r = c.ytd.find((x) => x.anni_fa === a.anni_fa && x.gruppo === g);
										const p = c.ytd.find((x) => x.anni_fa === 1 && x.gruppo === g);
										return (
											<td key={a.anni_fa} className={cella}>
												{r ? euro.format(r.fatturato) : "—"}
												{a.anni_fa === 0 && r && p && (
													<span className="ml-2 inline-block">
														<Delta ora={r.fatturato} prima={p.fatturato} />
													</span>
												)}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Card>

			<Card
				titolo="Nuovi, rientri e usciti, mese per mese"
				sottotitolo="Ultimi 24 mesi. Una persona resta «dentro» finché il prossimo abbonamento parte entro 30 giorni dalla fine del precedente."
			>
				<MovimentoChart punti={movimento} titolo="Nuovi iscritti, rientri e usciti per mese, ultimi 24 mesi" />
				<p className="mt-3 text-xs text-ink-3">
					Nuovi = prima volta in archivio. Rientri = tornano dopo una pausa di oltre 30 giorni. Usciti = l&apos;ultimo
					abbonamento è finito nel mese e non ne è partito un altro. Il mese in corso è tratteggiato: le uscite si
					conoscono solo a fine mese.
				</p>
			</Card>

			<Card titolo="Ultime vendite" sottotitolo="Le più recenti, escluse le quote associative">
				<ListaVendite vendite={recenti.abbonamenti.slice(0, 15)} adesso={adesso} conDurata />
			</Card>
		</Stagger>
	);
}

function iscrittiGruppo(c: ConfrontoAnni, gruppo: string, anniFa: number) {
	return c.iscritti.find((r) => r.anni_fa === anniFa && r.gruppo === gruppo)?.persone ?? 0;
}

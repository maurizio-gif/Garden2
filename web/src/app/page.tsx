import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BarreConfronto, type ColonnaConfronto } from "@/components/barre-confronto";
import { BarreImpilate } from "@/components/barre-impilate";
import { Card, Titolo } from "@/components/card";
import { Icone, Kpi } from "@/components/kpi";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { RankedBars } from "@/components/ranked-bars";
import { ListaVendite } from "@/components/righe";
import { ScheletroHome } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { TabellaValorizzazione } from "@/components/valorizzazione";
import { leggiDirezionale, leggiHome, leggiScadenze } from "@/lib/data";
import { euro, intero, meseCorto, meseLungo } from "@/lib/format";
import { tassoRinnovi } from "@/lib/scadenze";
import type { MeseDirezionale } from "@/lib/types";

export const metadata: Metadata = { title: "Panoramica" };

export default function Pagina() {
	return (
		<>
			<div className="mb-4">
				<Titolo>Panoramica</Titolo>
				<p className="mt-1 text-sm text-ink-3">
					I numeri della direzione: iscritti, vendite, incassi e rinnovi, sempre a confronto con l&apos;anno prima.
				</p>
			</div>
			<Suspense fallback={<ScheletroHome />}>
				<Contenuto />
			</Suspense>
		</>
	);
}

const variazione = (ora: number, prima: number) => (prima > 0 ? ((ora - prima) / prima) * 100 : undefined);

/** Gli ultimi 24 mesi, ognuno con lo stesso mese dell'anno prima accanto. */
function ventiquattroMesi(mesi: MeseDirezionale[], valore: (m: MeseDirezionale) => number): ColonnaConfronto[] {
	return mesi.slice(-24).map((m, i) => {
		const prima = mesi[mesi.length - 24 + i - 12];
		return {
			etichetta: meseCorto(m.mese),
			secondaRiga: m.mese.slice(5, 7) === "01" ? m.mese.slice(0, 4) : undefined,
			nomeCompleto: meseLungo(m.mese) + (i === 23 ? " (in corso)" : ""),
			valore: valore(m),
			confronto: prima ? valore(prima) : null,
			nomeConfronto: prima ? meseLungo(prima.mese) : undefined,
		};
	});
}

async function Contenuto() {
	const [{ dati: d, modo, adesso }, { dati: h }, { dati: s }] = await Promise.all([leggiDirezionale(), leggiHome(), leggiScadenze()]);

	const periodo = (p: "mtd" | "ytd", anniFa: number) => d.periodi.find((x) => x.periodo === p && x.anni_fa === anniFa);
	const mtd = periodo("mtd", 0);
	const mtdPrima = periodo("mtd", 1);
	const ytd = periodo("ytd", 0);
	const ytdPrima = periodo("ytd", 1);
	const iscritti = (q: "oggi" | "mese_fa" | "anno_fa") => d.iscritti.find((x) => x.quando === q)?.persone ?? 0;
	const totaleValore = d.valorizzazione.find((v) => v.gruppo === null);
	const rinnovi = tassoRinnovi(s.mesi, s.oggi, []);
	const oggiCorto = `${Number(d.oggi.slice(8, 10))}/${Number(d.oggi.slice(5, 7))}`;

	const categorie = h.categorie.slice(0, 8);

	return (
		<Stagger className="flex flex-col gap-4">
			<StaggerItem>
				<StatoDati modo={modo} aggiornatoAl={d.aggiornato_al} adesso={adesso} />
			</StaggerItem>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Kpi
					etichetta="Iscritti oggi"
					valore={iscritti("oggi")}
					nota="Persone con un abbonamento attivo"
					icona={Icone.persone}
					delta={
						iscritti("anno_fa") > 0
							? { percentuale: variazione(iscritti("oggi"), iscritti("anno_fa")) ?? 0, riferimento: `contro ${intero.format(iscritti("anno_fa"))} un anno fa` }
							: undefined
					}
				/>
				<Kpi
					etichetta="Venduto del mese"
					valore={mtd?.venduto ?? 0}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={`${intero.format(mtd?.vendite ?? 0)} vendite`}
					icona={Icone.abbonamento}
					delta={
						mtd && mtdPrima && mtdPrima.venduto > 0
							? { percentuale: variazione(mtd.venduto, mtdPrima.venduto) ?? 0, riferimento: `contro ${euro.format(mtdPrima.venduto)} al ${oggiCorto} dell'anno scorso` }
							: undefined
					}
				/>
				<Kpi
					etichetta="Incassato del mese"
					valore={mtd?.incassato ?? 0}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota="Netto degli storni"
					icona={Icone.incassi}
					delta={
						mtd && mtdPrima && mtdPrima.incassato > 0
							? { percentuale: variazione(mtd.incassato, mtdPrima.incassato) ?? 0, riferimento: `contro ${euro.format(mtdPrima.incassato)} l'anno scorso` }
							: undefined
					}
				/>
				<Kpi
					etichetta="Rinnovi, ultimi 12 mesi chiusi"
					valore={rinnovi.tasso ?? 0}
					opzioni={{ style: "percent", maximumFractionDigits: 0 }}
					nota={`${intero.format(rinnovi.rinnovati)} rinnovati su ${intero.format(rinnovi.scadenze)} scaduti`}
					icona={Icone.rinnovo}
					delta={
						rinnovi.tasso != null && rinnovi.tassoPrima != null && rinnovi.tassoPrima > 0
							? {
									percentuale: variazione(rinnovi.tasso, rinnovi.tassoPrima) ?? 0,
									riferimento: `contro il ${Math.round(rinnovi.tassoPrima * 100)}% dei 12 mesi prima`,
								}
							: undefined
					}
				/>
			</div>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Kpi
					etichetta="Venduto da inizio anno"
					valore={ytd?.venduto ?? 0}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={`${intero.format(ytd?.vendite ?? 0)} vendite`}
					icona={Icone.abbonamento}
					delta={
						ytd && ytdPrima && ytdPrima.venduto > 0
							? { percentuale: variazione(ytd.venduto, ytdPrima.venduto) ?? 0, riferimento: `contro ${euro.format(ytdPrima.venduto)} al ${oggiCorto} dell'anno scorso` }
							: undefined
					}
				/>
				<Kpi
					etichetta="Incassato da inizio anno"
					valore={ytd?.incassato ?? 0}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota="Netto degli storni"
					icona={Icone.incassi}
					delta={
						ytd && ytdPrima && ytdPrima.incassato > 0
							? { percentuale: variazione(ytd.incassato, ytdPrima.incassato) ?? 0, riferimento: `contro ${euro.format(ytdPrima.incassato)} l'anno scorso` }
							: undefined
					}
				/>
				<Kpi
					etichetta="Valore degli abbonamenti attivi"
					valore={totaleValore?.valore ?? 0}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={`${euro.format(totaleValore?.residuo ?? 0)} ancora da godere`}
					icona={Icone.valore}
				/>
				<Kpi
					etichetta="In scadenza nei prossimi 30 giorni"
					valore={h.in_scadenza_30g}
					nota={
						h.rate_scadute_90g.n > 0
							? `Persone da richiamare · ${euro.format(h.rate_scadute_90g.importo)} di rate scadute`
							: "Persone che non hanno ancora rinnovato"
					}
					icona={Icone.scadenza}
					tono={h.in_scadenza_30g > 0 ? "attenzione" : "neutro"}
				/>
			</div>

			<Card
				titolo="Incassi, ultimi 24 mesi"
				sottotitolo="In verde il mese, in grigio lo stesso mese dell'anno prima. Passa sopra una colonna per i valori e la differenza."
			>
				<BarreConfronto
					colonne={ventiquattroMesi(d.mesi, (m) => m.incassato)}
					formato="euro"
					nomeMisura="Incassato per mese, ultimi 24 mesi, con l'anno prima"
					nomeCorrente="Incassato"
					nomeConfronto="Stesso mese, anno prima"
				/>
			</Card>

			<div className="grid gap-4 xl:grid-cols-2">
				<Card
					titolo="Iscritti a fine mese, ultimi 24 mesi"
					sottotitolo="Persone con un abbonamento attivo l'ultimo giorno del mese (oggi per il mese in corso), accanto all'anno prima."
				>
					<BarreConfronto
						colonne={ventiquattroMesi(d.mesi, (m) => m.iscritti)}
						formato="numero"
						nomeMisura="Iscritti a fine mese, ultimi 24 mesi, con l'anno prima"
						nomeCorrente="Iscritti"
						nomeConfronto="Anno prima"
					/>
				</Card>
				<Card
					titolo="Venduto, ultimi 24 mesi: nuovi e rinnovi"
					sottotitolo="Rinnovo = la persona aveva già un abbonamento dello stesso gruppo, finito da non più di 30 giorni."
				>
					<BarreImpilate
						formato="euro"
						nomeMisura="Venduto per mese, nuovi e rinnovi"
						serie={[
							{ nome: "Rinnovi", colore: "var(--serie-0)" },
							{ nome: "Nuovi", colore: "var(--serie-1)" },
						]}
						colonne={d.mesi.slice(-24).map((m, i) => {
							const prima = d.mesi[d.mesi.length - 24 + i - 12];
							const v = variazione(m.venduto, prima?.venduto ?? 0);
							return {
								etichetta: meseCorto(m.mese),
								secondaRiga: m.mese.slice(5, 7) === "01" ? m.mese.slice(0, 4) : undefined,
								nomeCompleto: meseLungo(m.mese) + (i === 23 ? " (in corso)" : ""),
								valori: [m.venduto_rinnovi, m.venduto - m.venduto_rinnovi],
								incompleto: i === 23,
								note: [
									`${intero.format(m.vendite)} vendite, di cui ${intero.format(m.vendite_rinnovi)} rinnovi`,
									prima ? `${meseLungo(prima.mese)}: ${euro.format(prima.venduto)}${v != null ? ` (${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))}%)` : ""}` : "",
								].filter(Boolean),
							};
						})}
					/>
				</Card>
			</div>

			<div className="grid gap-4 lg:grid-cols-5">
				<Card
					className="lg:col-span-3"
					titolo="Valore degli abbonamenti attivi oggi"
					sottotitolo="Quanto valgono, per gruppo: il prezzo pagato, la parte ancora da godere (in proporzione ai giorni che restano) e il valore di un mese."
				>
					<TabellaValorizzazione righe={d.valorizzazione} />
				</Card>
				<Card className="lg:col-span-2" titolo="Persone per categoria" sottotitolo="Con almeno un prodotto attivo oggi">
					<RankedBars unita="persone" righe={categorie.map((c) => ({ etichetta: nomeCategoria(c.categoria), valore: c.persone }))} />
					<p className="mt-4 text-xs text-ink-3">
						Scadenze e rinnovi nel dettaglio in{" "}
						<Link href="/scadenze" className="font-medium text-accent-strong underline-offset-2 hover:underline">
							Scadenze
						</Link>
						.
					</p>
				</Card>
			</div>

			<Card titolo="Ultimi abbonamenti venduti" sottotitolo="Escluse le quote associative">
				<ListaVendite vendite={h.ultime_vendite} adesso={adesso} />
			</Card>
		</Stagger>
	);
}

/** «FAMILY NUOTO» → «Family nuoto»; «GARDEN+STEVEN» resta riconoscibile. */
function nomeCategoria(testo: string) {
	const t = testo.trim().toLowerCase();
	return t.charAt(0).toUpperCase() + t.slice(1).replace(/\+(\w)/g, (_, c: string) => ` + ${c.toUpperCase()}`);
}

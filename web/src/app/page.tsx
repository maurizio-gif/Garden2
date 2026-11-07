import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart, type PuntoBarre } from "@/components/bar-chart";
import { Card, Titolo } from "@/components/card";
import { Icone, Kpi } from "@/components/kpi";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { RankedBars } from "@/components/ranked-bars";
import { ListaVendite } from "@/components/righe";
import { ScheletroHome } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { leggiHome } from "@/lib/data";
import { euro, meseCorto, meseLungo } from "@/lib/format";
import type { Home } from "@/lib/types";

export const metadata: Metadata = { title: "Panoramica" };

export default function Pagina() {
	return (
		<>
			<div className="mb-4">
				<Titolo>Panoramica</Titolo>
			</div>
			{/* I dati si leggono a richiesta: il resto della pagina parte subito, questo arriva a flusso. */}
			<Suspense fallback={<ScheletroHome />}>
				<Contenuto />
			</Suspense>
		</>
	);
}

/** I dodici mesi che finiscono nel mese di `oggi`, con zero dove non c'è stato nessun incasso. */
function ultimiDodiciMesi(oggi: string, incassi: Home["incassi_mesi"]): PuntoBarre[] {
	const perMese = new Map(incassi.map((m) => [m.mese.slice(0, 7), m.incassi]));
	const anno = Number(oggi.slice(0, 4));
	const mese = Number(oggi.slice(5, 7)) - 1;
	return Array.from({ length: 12 }, (_, i) => {
		const d = new Date(Date.UTC(anno, mese - (11 - i), 1));
		const iso = d.toISOString().slice(0, 10);
		return {
			etichetta: meseCorto(iso),
			secondaRiga: d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : undefined,
			nomeCompleto: meseLungo(iso),
			valore: perMese.get(iso.slice(0, 7)) ?? 0,
			incompleto: i === 11,
		};
	});
}

async function Contenuto() {
	const { dati: d, modo, adesso } = await leggiHome();

	const corrente = d.incassi_mese.corrente;
	const precedente = d.incassi_mese.precedente_stesso_periodo;
	const meseScorso = new Date(Date.UTC(Number(d.oggi.slice(0, 4)), Number(d.oggi.slice(5, 7)) - 2, 1));
	const nomeMeseScorso = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" }).format(meseScorso);

	const categorie = d.categorie.slice(0, 8);
	const altre = d.categorie.length - categorie.length;

	return (
		<Stagger className="flex flex-col gap-4">
			<StaggerItem>
				<StatoDati modo={modo} aggiornatoAl={d.aggiornato_al} adesso={adesso} />
			</StaggerItem>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<Kpi
					etichetta="Persone con abbonamento attivo"
					valore={d.attivi}
					nota="Esclusa la quota associativa"
					icona={Icone.persone}
				/>
				<Kpi
					etichetta="In scadenza nei prossimi 30 giorni"
					valore={d.in_scadenza_30g}
					nota="Persone che non hanno ancora rinnovato"
					icona={Icone.scadenza}
				/>
				<Kpi
					etichetta="Rate scadute, ultimi 90 giorni"
					valore={d.rate_scadute_90g.n}
					nota={d.rate_scadute_90g.n > 0 ? `${euro.format(d.rate_scadute_90g.importo)} da incassare` : "Nessuna rata in ritardo"}
					icona={Icone.rate}
					tono={d.rate_scadute_90g.n > 0 ? "attenzione" : "neutro"}
				/>
				<Kpi
					etichetta="Incassi del mese"
					valore={corrente}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota="Netto degli storni"
					icona={Icone.incassi}
					delta={
						precedente > 0
							? {
									percentuale: ((corrente - precedente) / precedente) * 100,
									riferimento: `rispetto agli stessi giorni di ${nomeMeseScorso}`,
								}
							: undefined
					}
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-5">
				<Card
					className="lg:col-span-3"
					titolo="Incassi degli ultimi 12 mesi"
					sottotitolo="Netto degli storni. Il mese in corso è tratteggiato perché non è finito."
				>
					<BarChart titolo="Incassi per mese, ultimi 12 mesi" punti={ultimiDodiciMesi(d.oggi, d.incassi_mesi)} />
				</Card>

				<Card
					className="lg:col-span-2"
					titolo="Persone per categoria"
					sottotitolo="Con almeno un prodotto attivo oggi"
				>
					<RankedBars
						unita="persone"
						righe={categorie.map((c) => ({ etichetta: nomeCategoria(c.categoria), valore: c.persone }))}
					/>
					{altre > 0 && (
						<p className="mt-4 text-xs text-ink-3">
							e altre {altre} {altre === 1 ? "categoria" : "categorie"} più piccole
						</p>
					)}
				</Card>
			</div>

			<Card titolo="Ultimi abbonamenti venduti" sottotitolo="Escluse le quote associative">
				<ListaVendite vendite={d.ultime_vendite} adesso={adesso} />
			</Card>
		</Stagger>
	);
}

/** «FAMILY NUOTO» → «Family nuoto»; «GARDEN+STEVEN» resta riconoscibile. */
function nomeCategoria(testo: string) {
	const t = testo.trim().toLowerCase();
	return t.charAt(0).toUpperCase() + t.slice(1).replace(/\+(\w)/g, (_, c: string) => ` + ${c.toUpperCase()}`);
}

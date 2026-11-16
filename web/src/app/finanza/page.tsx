import type { Metadata } from "next";
import { Suspense } from "react";
import { BarreConfronto } from "@/components/barre-confronto";
import { Card, Titolo } from "@/components/card";
import { ConfrontoMensile } from "@/components/confronto-mensile";
import { ConfrontoPeriodi, type RigaPeriodo } from "@/components/confronto-periodi";
import { Delta } from "@/components/delta";
import { Icone, Kpi } from "@/components/kpi";
import type { SerieAnno } from "@/components/linee-anni";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { RankedBars } from "@/components/ranked-bars";
import { ScheletroLista } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { leggiFinanza } from "@/lib/data";
import { dataBreve, euro, intero, meseCorto, meseLungo } from "@/lib/format";
import type { PeriodoFin } from "@/lib/types";
import { NomePersona } from "@/components/nome-persona";

export const metadata: Metadata = { title: "Finanza" };

export default function Pagina() {
	return (
		<>
			<div className="mb-4">
				<Titolo>Finanza</Titolo>
				<p className="mt-1 max-w-3xl text-sm text-ink-3">
					Venduto, incassato e crediti verso i clienti, con il mese e l&apos;anno in corso messi accanto agli stessi giorni degli
					anni scorsi.
				</p>
			</div>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto />
			</Suspense>
		</>
	);
}

const N_ANNI = 4; // anno in corso + tre precedenti

/** Valori per anno (indice = anni fa) da righe già filtrate, con zero dove manca. */
function perAnno<T extends { anni_fa: number }>(righe: T[], valore: (r: T) => number): number[] {
	const v = Array<number>(N_ANNI).fill(0);
	for (const r of righe) if (r.anni_fa < N_ANNI) v[r.anni_fa] += valore(r);
	return v;
}

/** Righe «una per nome» ordinate dal valore più alto dell'anno in corso, con il totale in testa. */
function righeOrdinate(
	voci: { nome: string; anni_fa: number; valore: number }[],
	nomeTotale = "Totale",
): RigaPeriodo[] {
	const mappa = new Map<string, number[]>();
	for (const v of voci) {
		const a = mappa.get(v.nome) ?? Array<number>(N_ANNI).fill(0);
		if (v.anni_fa < N_ANNI) a[v.anni_fa] += v.valore;
		mappa.set(v.nome, a);
	}
	const righe = [...mappa.entries()]
		.map(([nome, valori]) => ({ nome, valori }))
		.filter((r) => r.valori.some((x) => x !== 0))
		.sort((a, b) => b.valori[0] - a.valori[0] || b.valori[1] - a.valori[1]);
	const totale = Array<number>(N_ANNI).fill(0);
	for (const r of righe) r.valori.forEach((x, i) => (totale[i] += x));
	return [{ nome: nomeTotale, valori: totale, totale: true }, ...righe];
}

async function Contenuto() {
	const { dati: d, modo, adesso } = await leggiFinanza();
	const anno = Number(d.oggi.slice(0, 4));
	const meseCorrente = Number(d.oggi.slice(5, 7)) - 1;
	const anni = Array.from({ length: N_ANNI }, (_, k) => String(anno - k));

	// ── intervalli sotto le intestazioni degli anni: «1–12 nov», «1 gen–12 nov»
	const intervallo = (p: PeriodoFin, k: number) => {
		const x = d.periodi.find((r) => r.periodo === p && r.anni_fa === k);
		if (!x) return "";
		const giorno = (s: string) => String(Number(s.slice(8, 10)));
		return p === "mtd"
			? `${giorno(x.da)}–${giorno(x.a)} ${meseCorto(x.a)}`
			: `${giorno(x.da)} ${meseCorto(x.da)}–${giorno(x.a)} ${meseCorto(x.a)}`;
	};
	const intervalli = {
		mtd: anni.map((_, k) => intervallo("mtd", k)),
		ytd: anni.map((_, k) => intervallo("ytd", k)),
	};

	// ── venduto: per gruppo, in euro e in numero di vendite
	const vendutoDi = (p: PeriodoFin) => d.venduto.filter((r) => r.periodo === p);
	const vendutoRighe = (p: PeriodoFin, campo: "fatturato" | "vendite") => {
		const tutte = vendutoDi(p);
		const gruppi = tutte
			.filter((r) => r.gruppo !== null)
			.map((r) => ({ nome: r.gruppo as string, anni_fa: r.anni_fa, valore: r[campo] }));
		const base = righeOrdinate(gruppi);
		// il totale è quello calcolato dal database (conta una volta ogni vendita)
		const tot = perAnno(tutte.filter((r) => r.gruppo === null), (r) => r[campo]);
		base[0] = { ...base[0], valori: tot };
		return base;
	};

	// ── incassato: per tipologia e per metodo
	const incTipDi = (p: PeriodoFin) => d.incassato_tipologia.filter((r) => r.periodo === p);
	const incTipRighe = (p: PeriodoFin) =>
		righeOrdinate(incTipDi(p).map((r) => ({ nome: r.tipologia, anni_fa: r.anni_fa, valore: r.importo })), "Incassato totale");
	const incMetodoRighe = (p: PeriodoFin) =>
		righeOrdinate(
			d.incassato_metodo.filter((r) => r.periodo === p).map((r) => ({ nome: r.metodo, anni_fa: r.anni_fa, valore: r.importo })),
			"Incassato totale",
		);

	// ── venduto contro incassato (abbonamenti)
	const confrontoRighe = (p: PeriodoFin): RigaPeriodo[] => {
		const venduto = perAnno(vendutoDi(p).filter((r) => r.gruppo === null), (r) => r.fatturato);
		const incAbb = perAnno(incTipDi(p).filter((r) => r.da_abbonamento), (r) => r.importo);
		const incAltro = perAnno(incTipDi(p).filter((r) => !r.da_abbonamento), (r) => r.importo);
		const incTot = incAbb.map((x, i) => x + incAltro[i]);
		return [
			{ nome: "Venduto (abbonamenti e quote)", valori: venduto },
			{ nome: "Incassato sugli abbonamenti", valori: incAbb },
			{ nome: "Differenza: venduto − incassato", valori: venduto.map((v, i) => v - incAbb[i]), totale: true, senzaDelta: true },
			{ nome: "Incassato altro (ingressi, agenda, cauzioni…)", valori: incAltro },
			{ nome: "Incassato totale", valori: incTot, totale: true },
		];
	};

	const incTot = (p: PeriodoFin) => perAnno(incTipDi(p), (r) => r.importo);
	const vendTot = (p: PeriodoFin) => perAnno(vendutoDi(p).filter((r) => r.gruppo === null), (r) => r.fatturato);
	const incAbbTot = (p: PeriodoFin) => perAnno(incTipDi(p).filter((r) => r.da_abbonamento), (r) => r.importo);

	const incMtd = incTot("mtd");
	const incYtd = incTot("ytd");
	const vendYtd = vendTot("ytd");
	const diffYtd = vendYtd[0] - incAbbTot("ytd")[0];
	const diffYtdPrima = vendYtd[1] - incAbbTot("ytd")[1];
	const pct = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : undefined);

	// ── mese per mese
	const mesePer = (a: number, m: number) => d.mesi.find((x) => x.anno === a && x.mese === m);
	const ultimi12 = Array.from({ length: 12 }, (_, i) => {
		const dt = new Date(Date.UTC(anno, meseCorrente - (11 - i), 1));
		const iso = dt.toISOString().slice(0, 10);
		const r = mesePer(dt.getUTCFullYear(), dt.getUTCMonth() + 1);
		return {
			etichetta: meseCorto(iso),
			secondaRiga: dt.getUTCMonth() === 0 ? String(dt.getUTCFullYear()) : undefined,
			nomeCompleto: meseLungo(iso),
			valore: r?.incassato ?? 0,
			confronto: r?.venduto ?? 0,
			nomeConfronto: "Venduto",
		};
	});
	const serieAnni = (campo: "incassato" | "venduto"): SerieAnno[] =>
		anni.map((_, k) => ({
			nome: String(anno - k),
			indice: k,
			valori: Array.from({ length: 12 }, (_, m) => {
				if (k === 0 && m > meseCorrente) return null;
				return mesePer(anno - k, m + 1)?.[campo] ?? 0;
			}),
		}));

	// ── crediti
	const f = (k: string) => d.crediti.fasce[k] ?? { n: 0, importo: 0 };
	const scaduto365 = ["s1", "s2", "s3", "s4"].reduce(
		(t, k) => ({ n: t.n + f(k).n, importo: t.importo + f(k).importo }),
		{ n: 0, importo: 0 },
	);
	const scadute = [
		{ k: "s1", nome: "Scaduto da 1 a 30 giorni" },
		{ k: "s2", nome: "Scaduto da 31 a 90 giorni" },
		{ k: "s3", nome: "Scaduto da 91 a 180 giorni" },
		{ k: "s4", nome: "Scaduto da 181 a 365 giorni" },
		{ k: "s5", nome: "Scaduto da oltre un anno (storico)" },
	];
	const future = [
		{ k: "f1", nome: "In scadenza entro 30 giorni" },
		{ k: "f2", nome: "In scadenza tra 31 e 90 giorni" },
		{ k: "f3", nome: "In scadenza tra oltre 90 giorni" },
	];
	const storico0 = d.crediti.storico.find((s) => s.anni_fa === 0);

	return (
		<Stagger className="flex flex-col gap-4">
			<StaggerItem>
				<StatoDati modo={modo} aggiornatoAl={d.aggiornato_al} adesso={adesso} />
			</StaggerItem>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
				<Kpi
					etichetta="Incassato nel mese (dal 1 a oggi)"
					valore={incMtd[0]}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota="Cassa netta degli storni"
					icona={Icone.incassi}
					delta={pct(incMtd[0], incMtd[1]) !== undefined ? { percentuale: pct(incMtd[0], incMtd[1]) as number, riferimento: `su ${euro.format(incMtd[1])} dello stesso periodo ${anno - 1}` } : undefined}
				/>
				<Kpi
					etichetta="Incassato da inizio anno"
					valore={incYtd[0]}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota="Cassa netta degli storni"
					icona={Icone.incassi}
					delta={pct(incYtd[0], incYtd[1]) !== undefined ? { percentuale: pct(incYtd[0], incYtd[1]) as number, riferimento: `su ${euro.format(incYtd[1])} dello stesso periodo ${anno - 1}` } : undefined}
				/>
				<Kpi
					etichetta="Venduto da inizio anno"
					valore={vendYtd[0]}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota="Abbonamenti e quote associative"
					icona={Icone.rate}
					delta={pct(vendYtd[0], vendYtd[1]) !== undefined ? { percentuale: pct(vendYtd[0], vendYtd[1]) as number, riferimento: `su ${euro.format(vendYtd[1])} dello stesso periodo ${anno - 1}` } : undefined}
				/>
				<Kpi
					etichetta="Differenza venduto − incassato (abbonamenti, da inizio anno)"
					valore={diffYtd}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={diffYtd >= 0 ? "Venduto non ancora incassato" : "Si incassa anche il venduto dell'anno scorso"}
					icona={Icone.scadenza}
					delta={undefined}
				/>
				<Kpi
					etichetta="Rate scadute da meno di un anno"
					valore={scaduto365.importo}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={`${intero.format(scaduto365.n)} rate non pagate`}
					icona={Icone.rate}
					tono={scaduto365.importo > 0 ? "attenzione" : "neutro"}
				/>
				<Kpi
					etichetta="Rate in scadenza nei prossimi 30 giorni"
					valore={f("f1").importo}
					opzioni={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
					nota={`${intero.format(f("f1").n)} rate da incassare`}
					icona={Icone.persone}
				/>
			</div>
			{diffYtd !== 0 && (
				<StaggerItem className="-mt-2 text-xs text-ink-3">
					Un anno fa, alla stessa data, la differenza era di {euro.format(diffYtdPrima)}.
				</StaggerItem>
			)}

			<Card
				titolo="Venduto e incassato, ultimi 12 mesi"
				sottotitolo="In verde quello che è entrato in cassa, in grigio quello che si è venduto. Il venduto che non si incassa subito (le rate) fa la differenza."
			>
				<BarreConfronto
					colonne={ultimi12}
					formato="euro"
					nomeMisura="Incassato e venduto per mese, ultimi 12 mesi"
					nomeCorrente="Incassato"
					nomeConfronto="Venduto"
				/>
				<p className="mt-3 text-xs text-ink-3">
					Il venduto è abbonamenti e quote associative; l&apos;incassato comprende anche ingressi singoli, agenda e cauzioni. Il
					mese in corso non è finito.
				</p>
			</Card>

			<Card
				titolo="Venduto contro incassato"
				sottotitolo="Sugli abbonamenti: quanto si è venduto, quanto è entrato davvero e la differenza. Vale per il mese o per l'anno, a confronto con gli stessi giorni degli anni scorsi."
			>
				<ConfrontoPeriodi
					anni={anni}
					intervalli={intervalli}
					misure={[
						{
							id: "confronto",
							nome: "Venduto e incassato",
							formato: "euro",
							righe: { mtd: confrontoRighe("mtd"), ytd: confrontoRighe("ytd") },
						},
					]}
					nota="Differenza positiva: si è venduto più di quanto si è incassato, il resto arriva con le rate. Negativa: nel periodo sono arrivati soldi di vendite fatte prima."
				/>
			</Card>

			<Card
				titolo="Abbonamenti venduti, per tipologia"
				sottotitolo="Mese in corso e anno in corso contro gli stessi giorni degli anni scorsi. Comprende le quote associative (gruppo «Quote e tessere»)."
			>
				<ConfrontoPeriodi
					anni={anni}
					intervalli={intervalli}
					misure={[
						{
							id: "euro",
							nome: "Venduto (€)",
							formato: "euro",
							righe: { mtd: vendutoRighe("mtd", "fatturato"), ytd: vendutoRighe("ytd", "fatturato") },
						},
						{
							id: "n",
							nome: "Numero di vendite",
							formato: "numero",
							righe: { mtd: vendutoRighe("mtd", "vendite"), ytd: vendutoRighe("ytd", "vendite") },
						},
					]}
				/>
			</Card>

			<Card
				titolo="Incassato, per tipologia e per metodo di pagamento"
				sottotitolo="I pagamenti di abbonamenti sono divisi per gruppo di prodotti; il resto (ingressi singoli, agenda, cauzioni) ha una riga a parte."
			>
				<ConfrontoPeriodi
					anni={anni}
					intervalli={intervalli}
					misure={[
						{
							id: "tipologia",
							nome: "Per tipologia",
							formato: "euro",
							righe: { mtd: incTipRighe("mtd"), ytd: incTipRighe("ytd") },
						},
						{
							id: "metodo",
							nome: "Per metodo di pagamento",
							formato: "euro",
							righe: { mtd: incMetodoRighe("mtd"), ytd: incMetodoRighe("ytd") },
						},
					]}
					nota="Gli importi sono netti degli storni. «Abbonamenti non attribuiti» sono pagamenti il cui abbonamento non è più in archivio."
				/>
			</Card>

			<Card
				titolo="Mese per mese, un anno per linea"
				sottotitolo="Quanto si incassa o si vende in ogni mese, a confronto con gli anni scorsi."
			>
				<ConfrontoMensile
					fatturato={serieAnni("incassato")}
					vendite={serieAnni("venduto")}
					meseCorrente={meseCorrente}
					nomi={{ fatturato: "Incassato (€)", vendite: "Venduto (€)" }}
					titoli={{ fatturato: "Incassato per mese, un anno per linea", vendite: "Venduto per mese, un anno per linea" }}
					formatoVendite="euro"
				/>
			</Card>

			<Card
				titolo="Crediti verso i clienti: rate da incassare"
				sottotitolo="Rate di abbonamento non ancora pagate, per quanto sono scadute o tra quanto scadono."
			>
				<div className="grid gap-6 lg:grid-cols-2">
					<div className="-mx-2 overflow-x-auto px-2">
						<table className="w-full border-collapse text-sm">
							<thead>
								<tr className="border-b border-line">
									<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
										Fascia
									</th>
									<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
										Rate
									</th>
									<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
										Importo
									</th>
								</tr>
							</thead>
							<tbody>
								{scadute.map((s) => (
									<tr key={s.k} className={`border-b border-line ${s.k === "s5" ? "text-ink-3" : ""}`}>
										<th scope="row" className="px-3 py-2.5 text-left font-normal">
											{s.nome}
										</th>
										<td className="px-3 py-2.5 text-right tabular-nums">{intero.format(f(s.k).n)}</td>
										<td className="px-3 py-2.5 text-right tabular-nums">{euro.format(f(s.k).importo)}</td>
									</tr>
								))}
								{future.map((s) => (
									<tr key={s.k} className="border-b border-line last:border-0">
										<th scope="row" className="px-3 py-2.5 text-left font-normal text-ink-2">
											{s.nome}
										</th>
										<td className="px-3 py-2.5 text-right tabular-nums">{intero.format(f(s.k).n)}</td>
										<td className="px-3 py-2.5 text-right tabular-nums">{euro.format(f(s.k).importo)}</td>
									</tr>
								))}
							</tbody>
						</table>
						<p className="mt-3 text-xs text-ink-3">
							Le rate scadute da oltre un anno sono quasi tutte storico mai chiuso in Info4U: non sono contate nei totali
							in alto.
						</p>
					</div>

					<div>
						<h3 className="mb-2 text-sm font-semibold">Scaduto da meno di 90 giorni, nello stesso giorno degli anni scorsi</h3>
						<table className="w-full border-collapse text-sm">
							<thead>
								<tr className="border-b border-line">
									<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
										Giorno
									</th>
									<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
										Rate
									</th>
									<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
										Importo
									</th>
								</tr>
							</thead>
							<tbody>
								{d.crediti.storico.map((s) => (
									<tr key={s.anni_fa} className={`border-b border-line last:border-0 ${s.anni_fa === 0 ? "font-semibold" : ""}`}>
										<th scope="row" className="px-3 py-2.5 text-left font-normal">
											{dataBreve(s.giorno)}
										</th>
										<td className="px-3 py-2.5 text-right tabular-nums">{intero.format(s.n)}</td>
										<td className="px-3 py-2.5 text-right tabular-nums">
											{euro.format(s.importo)}
											{s.anni_fa === 0 && storico0 && d.crediti.storico[1] && (
												<span className="mt-0.5 block font-normal">
													<Delta ora={s.importo} prima={d.crediti.storico[1].importo} inverso />
												</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
						<p className="mt-3 text-xs text-ink-3">
							Ricostruito dalle date di scadenza e di pagamento di ogni rata: una rata conta se era già scaduta e non ancora
							pagata in quel giorno.
						</p>
					</div>
				</div>
			</Card>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card titolo="Rate scadute per gruppo di prodotti" sottotitolo="Scadute da meno di un anno">
					<RankedBars
						unita="euro"
						euro
						righe={d.crediti.per_gruppo.map((g) => ({ etichetta: `${g.gruppo} (${intero.format(g.n)})`, valore: g.importo }))}
					/>
				</Card>
				<Card titolo="Rate scadute per metodo previsto" sottotitolo="Come il cliente avrebbe dovuto pagare">
					<RankedBars
						unita="euro"
						euro
						righe={d.crediti.per_metodo.map((g) => ({ etichetta: `${g.metodo} (${intero.format(g.n)})`, valore: g.importo }))}
					/>
				</Card>
			</div>

			<Card titolo="Chi deve di più" sottotitolo="Le quindici persone con più rate scadute da meno di un anno">
				{d.crediti.debitori.length === 0 ? (
					<p className="text-sm text-ink-3">Nessuna rata scaduta.</p>
				) : (
					<div className="-mx-2 overflow-x-auto px-2">
						<table className="w-full min-w-[30rem] border-collapse text-sm">
							<thead>
								<tr className="border-b border-line">
									<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
										Persona
									</th>
									<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
										Rate
									</th>
									<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
										Scaduta dal
									</th>
									<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
										Importo
									</th>
								</tr>
							</thead>
							<tbody>
								{d.crediti.debitori.map((p, i) => (
									<tr key={i} className="border-b border-line last:border-0">
										<th scope="row" className="px-3 py-2.5 text-left font-normal">
											<NomePersona id={p.persona_id} nome={p.nome} cognome={p.cognome} />
										</th>
										<td className="px-3 py-2.5 text-right tabular-nums">{p.rate}</td>
										<td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{dataBreve(p.piu_vecchia)}</td>
										<td className="px-3 py-2.5 text-right font-medium tabular-nums">{euro.format(p.importo)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				<p className="mt-3 text-xs text-ink-3">
					Qui ci sono i crediti verso i clienti. I debiti verso fornitori, stipendi e banche non sono in Info4U: per quelli serve
					il gestionale contabile.
				</p>
			</Card>
		</Stagger>
	);
}

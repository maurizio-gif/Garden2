import { BarreConfronto } from "@/components/barre-confronto";
import { Card } from "@/components/card";
import { Delta } from "@/components/delta";
import { leggiRisconti } from "@/lib/data";
import { dataBreve, euro, meseCorto, meseLungo } from "@/lib/format";
import type { RigaRisconto } from "@/lib/types";

/**
 * Risconti passivi: la parte degli abbonamenti già venduti che riguarda i
 * giorni che devono ancora venire. Due riquadri:
 *  · la situazione di oggi contro un anno fa, a ogni fine mese degli ultimi 12
 *    (contro la stessa fine mese dell'anno prima) e per gruppo;
 *  · il valore al 31 dicembre di ogni anno, quello da bilancio, su tutto lo
 *    storico, anche per gruppo. L'anno in corso è una stima con il venduto
 *    fino a oggi.
 */
export async function RiscontiPassivi() {
	const { dati: d } = await leggiRisconti();
	const annoCorrente = Number(d.oggi.slice(0, 4));

	const totale = (tipo: RigaRisconto["tipo"]) => d.righe.find((r) => r.tipo === tipo && r.gruppo === null);
	const oggi = totale("oggi");
	const annoFa = totale("anno_fa");

	// ── fine mese → totale
	const fineMese = new Map(d.righe.filter((r) => r.tipo === "mese" && r.gruppo === null).map((r) => [r.giorno, r.risconto]));
	const giorni = [...fineMese.keys()].sort();
	const unAnnoPrima = (iso: string) => {
		const [a, m] = iso.split("-").map(Number);
		return new Date(Date.UTC(a - 1, m, 0)).toISOString().slice(0, 10); // ultimo giorno dello stesso mese
	};
	const colonneMesi = giorni.slice(-12).map((g) => {
		const prima = unAnnoPrima(g);
		return {
			etichetta: meseCorto(g),
			secondaRiga: g.slice(5, 7) === "01" ? g.slice(0, 4) : undefined,
			nomeCompleto: `Fine ${meseLungo(g)}`,
			valore: fineMese.get(g) ?? 0,
			confronto: fineMese.get(prima) ?? null,
			nomeConfronto: `Fine ${meseLungo(prima)}`,
		};
	});

	// ── per gruppo: oggi e un anno fa
	const perGruppo = (filtro: (r: RigaRisconto) => boolean) =>
		new Map(d.righe.filter((r) => filtro(r) && r.gruppo !== null).map((r) => [r.gruppo as string, r.risconto]));
	const gOggi = perGruppo((r) => r.tipo === "oggi");
	const gAnnoFa = perGruppo((r) => r.tipo === "anno_fa");
	const gruppiOggi = [...new Set([...gOggi.keys(), ...gAnnoFa.keys()])]
		.map((nome) => ({ nome, ora: gOggi.get(nome) ?? 0, prima: gAnnoFa.get(nome) ?? 0 }))
		.filter((g) => g.ora > 0 || g.prima > 0)
		.sort((a, b) => b.ora - a.ora);
	const maxGruppo = Math.max(...gruppiOggi.map((g) => g.ora), 1);

	// ── 31 dicembre di ogni anno (dal primo con un valore)
	const fineAnno = d.righe
		.filter((r) => r.tipo === "fine_anno" && r.gruppo === null && r.risconto > 0)
		.map((r) => ({ anno: Number(r.giorno.slice(0, 4)), valore: r.risconto, riga: r }))
		.sort((a, b) => a.anno - b.anno);
	const valoreAnno = new Map(fineAnno.map((a) => [a.anno, a.valore]));
	const gruppiAnno = new Map<number, Map<string, number>>();
	for (const r of d.righe) {
		if (r.tipo !== "fine_anno" || r.gruppo === null) continue;
		const a = Number(r.giorno.slice(0, 4));
		const m = gruppiAnno.get(a) ?? new Map<string, number>();
		m.set(r.gruppo, r.risconto);
		gruppiAnno.set(a, m);
	}
	// colonne dei gruppi: ordinate dal valore dell'ultimo bilancio chiuso
	const ultimoChiuso = annoCorrente - 1;
	const nomiGruppi = [...new Set([...gruppiAnno.values()].flatMap((m) => [...m.keys()]))].sort(
		(a, b) => (gruppiAnno.get(ultimoChiuso)?.get(b) ?? 0) - (gruppiAnno.get(ultimoChiuso)?.get(a) ?? 0),
	);
	// una barra per anno: la precedente è già l'anno prima, niente barre grigie
	const colonneAnni = fineAnno.map((a) => {
		const stima = a.anno === annoCorrente;
		return {
			etichetta: `${String(a.anno).slice(2)}${stima ? "*" : ""}`,
			nomeCompleto: stima ? `31 dicembre ${a.anno}: stima con il venduto fino a oggi` : `31 dicembre ${a.anno}`,
			valore: a.valore,
		};
	});
	const bilancioChiuso = valoreAnno.get(ultimoChiuso);

	return (
		<>
			<Card
				titolo="Risconti passivi"
				sottotitolo="La parte degli abbonamenti già venduti che riguarda giorni ancora da venire: ricavi incassati o fatturati in anticipo che competono ai periodi successivi."
			>
				<div className="mb-6 grid gap-4 sm:grid-cols-2">
					<div>
						<p className="text-xs text-ink-3">Oggi, {oggi ? dataBreve(oggi.giorno) : ""}</p>
						<p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{euro.format(oggi?.risconto ?? 0)}</p>
						<p className="mt-1 text-sm text-ink-2">
							<Delta ora={oggi?.risconto ?? 0} prima={annoFa?.risconto} assoluto />{" "}
							<span className="text-ink-3">su {euro.format(annoFa?.risconto ?? 0)} un anno fa</span>
						</p>
					</div>
					<div className="text-sm text-ink-2 sm:pt-5">
						<p>
							Di cui <b className="tabular-nums text-ink">{euro.format(oggi?.non_iniziati ?? 0)}</b> di abbonamenti venduti
							che non sono ancora iniziati.
						</p>
					</div>
				</div>

				<h3 className="mb-2 text-sm font-semibold">A fine mese, ultimi 12 mesi</h3>
				<BarreConfronto
					colonne={colonneMesi}
					formato="euro"
					nomeMisura="Risconti passivi a fine mese, ultimi 12 mesi, con la stessa fine mese dell'anno prima"
					nomeCorrente="Fine mese"
					nomeConfronto="Un anno prima"
				/>

				<h3 className="mb-2 mt-8 text-sm font-semibold">Per gruppo di prodotti, oggi e un anno fa</h3>
				<div className="-mx-2 overflow-x-auto px-2">
					<table className="w-full min-w-[30rem] border-collapse text-sm">
						<thead>
							<tr className="border-b border-line">
								<th scope="col" className="px-3 py-2 text-left text-xs font-medium text-ink-3">
									Gruppo
								</th>
								<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
									Oggi
								</th>
								<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
									Un anno fa
								</th>
								<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
									Variazione
								</th>
							</tr>
						</thead>
						<tbody>
							{gruppiOggi.map((g) => (
								<tr key={g.nome} className="border-b border-line last:border-0">
									<th scope="row" className="px-3 py-2.5 text-left font-normal">
										{g.nome}
										<span className="mt-1 block h-1.5 rounded-full bg-surface-2" aria-hidden="true">
											<span className="block h-full rounded-full bg-accent" style={{ width: `${(g.ora / maxGruppo) * 100}%` }} />
										</span>
									</th>
									<td className="px-3 py-2.5 text-right font-medium tabular-nums">{euro.format(g.ora)}</td>
									<td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{euro.format(g.prima)}</td>
									<td className="px-3 py-2.5 text-right">
										<Delta ora={g.ora} prima={g.prima || null} />
									</td>
								</tr>
							))}
						</tbody>
						{oggi && (
							<tfoot>
								<tr className="border-t-2 border-line font-semibold">
									<th scope="row" className="px-3 py-2.5 text-left">
										Totale
									</th>
									<td className="px-3 py-2.5 text-right tabular-nums">{euro.format(oggi.risconto)}</td>
									<td className="px-3 py-2.5 text-right tabular-nums">{euro.format(annoFa?.risconto ?? 0)}</td>
									<td className="px-3 py-2.5 text-right font-normal">
										<Delta ora={oggi.risconto} prima={annoFa?.risconto} />
									</td>
								</tr>
							</tfoot>
						)}
					</table>
				</div>
				<Nota />
			</Card>

			<Card
				titolo="Risconti passivi al 31 dicembre"
				sottotitolo="Il valore a fine anno, quello da mettere a bilancio, per ogni anno dello storico (anni sull'asse: 15 = 2015)."
			>
				{bilancioChiuso !== undefined && (
					<div className="mb-6">
						<p className="text-xs text-ink-3">Bilancio {ultimoChiuso}, al 31 dicembre</p>
						<p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{euro.format(bilancioChiuso)}</p>
						<p className="mt-1 text-sm text-ink-2">
							<Delta ora={bilancioChiuso} prima={valoreAnno.get(ultimoChiuso - 1)} assoluto />{" "}
							<span className="text-ink-3">
								su {euro.format(valoreAnno.get(ultimoChiuso - 1) ?? 0)} al 31 dicembre {ultimoChiuso - 1}
							</span>
						</p>
					</div>
				)}

				<BarreConfronto
					colonne={colonneAnni}
					formato="euro"
					nomeMisura="Risconti passivi al 31 dicembre di ogni anno"
					nomeCorrente="31 dicembre"
				/>

				<h3 className="mb-2 mt-8 text-sm font-semibold">Anno per anno, anche per gruppo di prodotti</h3>
				<div className="-mx-2 overflow-x-auto px-2">
					<table className="w-full border-collapse text-sm" style={{ minWidth: `${22 + nomiGruppi.length * 8}rem` }}>
						<thead>
							<tr className="border-b border-line">
								<th scope="col" className="sticky left-0 bg-surface px-3 py-2 text-left text-xs font-medium text-ink-3">
									31 dicembre
								</th>
								<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
									Totale
								</th>
								<th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
									Sull&apos;anno prima
								</th>
								{nomiGruppi.map((g) => (
									<th key={g} scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-3">
										{g}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{[...fineAnno].reverse().map((a) => {
								const stima = a.anno === annoCorrente;
								return (
									<tr key={a.anno} className={`border-b border-line last:border-0 ${stima ? "text-ink-3" : ""}`}>
										<th scope="row" className="sticky left-0 bg-surface px-3 py-2.5 text-left font-medium">
											{a.anno}
											{stima && <span className="block text-xs font-normal">stima, venduto finora</span>}
										</th>
										<td className={`px-3 py-2.5 text-right tabular-nums ${stima ? "" : "font-semibold"}`}>{euro.format(a.valore)}</td>
										<td className="px-3 py-2.5 text-right">
											{stima ? <span className="text-xs">—</span> : <Delta ora={a.valore} prima={valoreAnno.get(a.anno - 1)} />}
										</td>
										{nomiGruppi.map((g) => (
											<td key={g} className="px-3 py-2.5 text-right tabular-nums text-ink-2">
												{euro.format(gruppiAnno.get(a.anno)?.get(g) ?? 0)}
											</td>
										))}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<p className="mt-3 text-xs text-ink-3">
					* L&apos;anno in corso non è chiuso: è il valore al 31 dicembre degli abbonamenti venduti fino a oggi, crescerà con le
					vendite di qui a fine anno. Prima del 2015 in Info4U ci sono poche vendite: quegli anni non sono completi.
				</p>
				<Nota />
			</Card>
		</>
	);
}

function Nota() {
	return (
		<p className="mt-3 text-xs text-ink-3">
			Per ogni abbonamento: prezzo × giorni che restano dopo la data ÷ giorni totali; se non è ancora iniziato conta per intero.
			Comprende le quote associative; le sospensioni non spostano la fine. È una stima dai dati di Info4U, da confrontare con
			quella del commercialista.
		</p>
	);
}

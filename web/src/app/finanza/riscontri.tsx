import { BarreConfronto } from "@/components/barre-confronto";
import { Card } from "@/components/card";
import { Delta } from "@/components/delta";
import { leggiRiscontri } from "@/lib/data";
import { dataBreve, euro, meseCorto, meseLungo } from "@/lib/format";

/**
 * Riscontri passivi: la parte degli abbonamenti già venduti che riguarda i
 * giorni che devono ancora venire. Oggi contro un anno fa, la situazione a
 * ogni fine mese degli ultimi 12 (contro la stessa fine mese dell'anno prima)
 * e la divisione per gruppo di prodotti.
 */
export async function RiscontriPassivi() {
	const { dati: d } = await leggiRiscontri();

	const totale = (tipo: "oggi" | "anno_fa") => d.righe.find((r) => r.tipo === tipo && r.gruppo === null);
	const oggi = totale("oggi");
	const annoFa = totale("anno_fa");

	// fine mese → totale
	const fineMese = new Map(d.righe.filter((r) => r.tipo === "mese" && r.gruppo === null).map((r) => [r.giorno, r.riscontro]));
	const giorni = [...fineMese.keys()].sort();
	const unAnnoPrima = (iso: string) => {
		const [a, m] = iso.split("-").map(Number);
		return new Date(Date.UTC(a - 1, m, 0)).toISOString().slice(0, 10); // ultimo giorno dello stesso mese
	};
	const colonne = giorni.slice(-12).map((g) => {
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

	// per gruppo: oggi e un anno fa
	const perGruppo = (tipo: "oggi" | "anno_fa") =>
		new Map(d.righe.filter((r) => r.tipo === tipo && r.gruppo !== null).map((r) => [r.gruppo as string, r.riscontro]));
	const gOggi = perGruppo("oggi");
	const gAnnoFa = perGruppo("anno_fa");
	const gruppi = [...new Set([...gOggi.keys(), ...gAnnoFa.keys()])]
		.map((nome) => ({ nome, ora: gOggi.get(nome) ?? 0, prima: gAnnoFa.get(nome) ?? 0 }))
		.filter((g) => g.ora > 0 || g.prima > 0)
		.sort((a, b) => b.ora - a.ora);
	const max = Math.max(...gruppi.map((g) => g.ora), 1);

	return (
		<Card
			titolo="Riscontri passivi"
			sottotitolo="La parte degli abbonamenti già venduti che riguarda giorni ancora da venire: ricavi incassati o fatturati in anticipo che competono ai mesi successivi."
		>
			<div className="mb-6 grid gap-4 sm:grid-cols-2">
				<div>
					<p className="text-xs text-ink-3">Oggi, {oggi ? dataBreve(oggi.giorno) : ""}</p>
					<p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{euro.format(oggi?.riscontro ?? 0)}</p>
					<p className="mt-1 text-sm text-ink-2">
						<Delta ora={oggi?.riscontro ?? 0} prima={annoFa?.riscontro} assoluto />{" "}
						<span className="text-ink-3">su {euro.format(annoFa?.riscontro ?? 0)} un anno fa</span>
					</p>
				</div>
				<div className="text-sm text-ink-2 sm:pt-5">
					<p>
						Di cui <b className="tabular-nums text-ink">{euro.format(oggi?.non_iniziati ?? 0)}</b> di abbonamenti venduti che
						non sono ancora iniziati.
					</p>
				</div>
			</div>

			<h3 className="mb-2 text-sm font-semibold">A fine mese, ultimi 12 mesi</h3>
			<BarreConfronto
				colonne={colonne}
				formato="euro"
				nomeMisura="Riscontri passivi a fine mese, ultimi 12 mesi, con la stessa fine mese dell'anno prima"
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
						{gruppi.map((g) => (
							<tr key={g.nome} className="border-b border-line last:border-0">
								<th scope="row" className="px-3 py-2.5 text-left font-normal">
									{g.nome}
									<span className="mt-1 block h-1.5 rounded-full bg-surface-2" aria-hidden="true">
										<span className="block h-full rounded-full bg-accent" style={{ width: `${(g.ora / max) * 100}%` }} />
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
								<td className="px-3 py-2.5 text-right tabular-nums">{euro.format(oggi.riscontro)}</td>
								<td className="px-3 py-2.5 text-right tabular-nums">{euro.format(annoFa?.riscontro ?? 0)}</td>
								<td className="px-3 py-2.5 text-right font-normal">
									<Delta ora={oggi.riscontro} prima={annoFa?.riscontro} />
								</td>
							</tr>
						</tfoot>
					)}
				</table>
			</div>

			<p className="mt-3 text-xs text-ink-3">
				Per ogni abbonamento: prezzo × giorni che restano dopo la data ÷ giorni totali; se non è ancora iniziato conta per
				intero. Comprende le quote associative; le sospensioni non spostano la fine. È una stima dai dati di Info4U, non il
				dato del bilancio.
			</p>
		</Card>
	);
}

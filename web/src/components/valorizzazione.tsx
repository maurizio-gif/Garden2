import { euro, intero } from "@/lib/format";
import type { Valorizzazione } from "@/lib/types";

/** Valore degli abbonamenti attivi oggi, per gruppo, con una barra della quota sul totale. */
export function TabellaValorizzazione({ righe }: { righe: Valorizzazione[] }) {
	const totale = righe.find((r) => r.gruppo === null);
	const gruppi = righe.filter((r) => r.gruppo !== null && r.valore > 0);
	const max = Math.max(...gruppi.map((g) => g.valore), 1);

	return (
		<div className="-mx-1 overflow-x-auto">
			<table className="w-full min-w-[34rem] border-collapse text-sm">
				<thead>
					<tr className="text-left text-xs text-ink-3">
						<th scope="col" className="px-1 pb-2 font-medium">Gruppo</th>
						<th scope="col" className="px-1 pb-2 text-right font-medium">Persone</th>
						<th scope="col" className="px-1 pb-2 text-right font-medium">Valore</th>
						<th scope="col" className="px-1 pb-2 text-right font-medium">Da godere</th>
						<th scope="col" className="px-1 pb-2 text-right font-medium">Al mese</th>
						<th scope="col" className="px-1 pb-2 text-right font-medium">Medio a persona</th>
					</tr>
				</thead>
				<tbody>
					{gruppi.map((g) => (
						<tr key={g.gruppo} className="border-t border-line">
							<th scope="row" className="px-1 py-2 text-left font-medium">
								{g.gruppo}
								<span className="mt-1 block h-1.5 rounded-full bg-surface-2" aria-hidden="true">
									<span className="block h-full rounded-full bg-accent" style={{ width: `${(g.valore / max) * 100}%` }} />
								</span>
							</th>
							<td className="px-1 py-2 text-right tabular-nums">{intero.format(g.persone)}</td>
							<td className="px-1 py-2 text-right font-medium tabular-nums">{euro.format(g.valore)}</td>
							<td className="px-1 py-2 text-right tabular-nums text-ink-2">{euro.format(g.residuo)}</td>
							<td className="px-1 py-2 text-right tabular-nums text-ink-2">{euro.format(g.mensile)}</td>
							<td className="px-1 py-2 text-right tabular-nums text-ink-2">{euro.format(g.persone ? g.valore / g.persone : 0)}</td>
						</tr>
					))}
				</tbody>
				{totale && (
					<tfoot>
						<tr className="border-t-2 border-line font-semibold">
							<th scope="row" className="px-1 py-2 text-left">Totale</th>
							<td className="px-1 py-2 text-right tabular-nums">{intero.format(totale.persone)}</td>
							<td className="px-1 py-2 text-right tabular-nums">{euro.format(totale.valore)}</td>
							<td className="px-1 py-2 text-right tabular-nums">{euro.format(totale.residuo)}</td>
							<td className="px-1 py-2 text-right tabular-nums">{euro.format(totale.mensile)}</td>
							<td className="px-1 py-2 text-right tabular-nums">{euro.format(totale.persone ? totale.valore / totale.persone : 0)}</td>
						</tr>
					</tfoot>
				)}
			</table>
			<p className="mt-3 px-1 text-xs text-ink-3">
				Le persone del totale sono contate una volta sola anche se hanno abbonamenti in più gruppi.
			</p>
		</div>
	);
}

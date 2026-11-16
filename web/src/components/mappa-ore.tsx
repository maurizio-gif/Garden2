const intero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: "always" });
const GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

/**
 * Griglia giorno × ora: più è scura la casella, più persone arrivano in
 * quell'ora di quel giorno. Il numero esatto è nel titolo della casella e
 * nella tabella (è una tabella vera, leggibile anche dai lettori di schermo).
 */
export function MappaOre({ celle }: { celle: { dow: number; ora: number; presenze: number }[] }) {
	const conDati = celle.filter((c) => c.presenze > 0);
	if (conDati.length === 0) return <p className="text-sm text-ink-3">Nessun ingresso nel periodo.</p>;
	const prima = Math.max(0, Math.min(...conDati.map((c) => c.ora)));
	const ultima = Math.min(23, Math.max(...conDati.map((c) => c.ora)));
	const ore = Array.from({ length: ultima - prima + 1 }, (_, i) => prima + i);
	const valore = new Map(celle.map((c) => [`${c.dow}-${c.ora}`, c.presenze]));
	const max = Math.max(...conDati.map((c) => c.presenze));
	const totaleOra = ore.map((o) => [1, 2, 3, 4, 5, 6, 7].reduce((s, d) => s + (valore.get(`${d}-${o}`) ?? 0), 0));
	const oraPicco = ore[totaleOra.indexOf(Math.max(...totaleOra))];

	return (
		<div>
			<div className="-mx-1 overflow-x-auto px-1">
				<table className="w-full min-w-[40rem] border-separate border-spacing-[3px] text-xs">
					<caption className="sr-only">Persone arrivate per giorno della settimana e ora del primo ingresso</caption>
					<thead>
						<tr>
							<th scope="col" className="w-20" />
							{ore.map((o) => (
								<th key={o} scope="col" className="pb-1 text-center font-normal text-ink-3 tabular-nums">
									{o}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{GIORNI.map((nome, i) => (
							<tr key={nome}>
								<th scope="row" className="pr-2 text-left font-normal text-ink-2">
									{nome}
								</th>
								{ore.map((o) => {
									const v = valore.get(`${i + 1}-${o}`) ?? 0;
									const quota = v / max;
									return (
										<td
											key={o}
											title={`${nome}, ${o}:00–${o}:59: ${intero.format(v)} arrivi`}
											className="h-8 min-w-7 rounded-[5px] text-center tabular-nums"
											style={{
												background: v > 0 ? `color-mix(in srgb, var(--accent) ${Math.round(8 + quota * 92)}%, var(--surface-2))` : "var(--surface-2)",
												color: quota > 0.55 ? "var(--bg)" : "transparent",
											}}
										>
											<span className="sr-only">{intero.format(v)}</span>
											<span aria-hidden="true" className="text-[10px]">
												{quota > 0.55 ? intero.format(v) : ""}
											</span>
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<p className="mt-3 text-xs text-ink-3">
				L&apos;ora più affollata è dalle {oraPicco}:00 alle {oraPicco}:59. Passa sopra una casella per il numero esatto.
			</p>
		</div>
	);
}

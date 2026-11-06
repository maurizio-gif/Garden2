import { formatGiornoBreve, formatOrario } from '@/lib/format';

/** L'intestazione di una sezione: titolo, spiegazione e quando sono arrivati i dati. */
export function Testata({
	titolo,
	frase,
	evidenza,
	sotto,
	aggiornamento,
}: {
	titolo: string;
	/** La prima parte del titolo, in scuro. */
	frase: string;
	/** La parte finale, colorata. */
	evidenza: string;
	sotto: string;
	aggiornamento: string | null;
}) {
	return (
		<header className="hero entra">
			<div>
				<div className="eyebrow">{titolo}</div>
				<h1>
					{frase} <em>{evidenza}</em>
				</h1>
				<p className="sotto">{sotto}</p>
			</div>
			{aggiornamento && (
				<div className="live" title="Ultima sincronizzazione dei dati del gestionale">
					<i aria-hidden />
					<span>
						Dati del gestionale
						<b>
							{formatGiornoBreve(aggiornamento)}, ore {formatOrario(aggiornamento)}
						</b>
					</span>
				</div>
			)}
		</header>
	);
}

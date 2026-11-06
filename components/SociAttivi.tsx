import { Numero } from '@/components/Numero';
import { Variazione } from '@/components/Variazione';
import { formatData, formatIntero } from '@/lib/format';

/** Soci di oggi, di un mese fa e di un anno fa: tre barre in scala, che crescono all'apertura. */
export function SociAttivi({ oggi, meseFa, annoFa, giorno, conQuote }: { oggi: number; meseFa: number; annoFa: number; giorno: string; conQuote: boolean }) {
	const massimo = Math.max(oggi, meseFa, annoFa, 1);
	const righe = [
		{ etichetta: 'Oggi', valore: oggi, nota: formatData(giorno), principale: true },
		{ etichetta: 'Un mese fa', valore: meseFa, confronto: true },
		{ etichetta: 'Un anno fa', valore: annoFa, confronto: true },
	];
	return (
		<div className="scheda soci entra" style={{ '--ritardo': '320ms' } as React.CSSProperties}>
			<h3>
				<i className="tinta" style={{ background: 'var(--verde-vivo)' }} />
				Soci attivi
			</h3>
			<div className="grande enorme">
				<Numero valore={oggi} />
			</div>
			<p className="piccolo">
				Persone con almeno un abbonamento in corso{conQuote ? '' : ', senza contare le quote associative'}.
			</p>
			<div className="soci-barre">
				{righe.map((r, i) => (
					<div key={r.etichetta} className="soci-riga" style={{ '--i': i } as React.CSSProperties}>
						<div className="soci-testa">
							<span>{r.etichetta}</span>
							<span>
								<b>{formatIntero(r.valore)}</b>
								{r.confronto && <Variazione ora={oggi} prima={r.valore} />}
							</span>
						</div>
						<div className="soci-traccia">
							<span className={`soci-pieno ${r.principale ? 'principale' : ''}`} style={{ width: `${(r.valore / massimo) * 100}%` }} />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

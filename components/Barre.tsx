import { Variazione } from '@/components/Variazione';

export type VoceBarra = {
	etichetta: string;
	/** Lunghezza della barra, in scala sul massimo dell'elenco. */
	valore: number;
	/** Cosa si legge a destra (di solito il valore formattato). */
	testo: string;
	nota?: string;
	colore?: string;
	/** Il valore dell'anno prima: compare il bollino di variazione. */
	prima?: number;
	inverso?: boolean;
	/** Per barre fatte a pezzi: la loro somma e' `valore`. */
	parti?: { valore: number; colore: string; etichetta: string }[];
};

/** Barre orizzontali: una riga per voce, in scala sul massimo; crescono all'apertura. */
export function Barre({ voci, massimo }: { voci: VoceBarra[]; massimo?: number }) {
	const alto = Math.max(massimo ?? 0, ...voci.map((v) => v.valore), 1);
	if (voci.length === 0) return <p className="nota">Nessun dato per questo periodo.</p>;
	return (
		<div className="barre">
			{voci.map((v, i) => (
				<div key={v.etichetta} className="barra-riga" style={{ '--i': i } as React.CSSProperties}>
					<div className="barra-testa">
						<span className="barra-nome" title={v.etichetta}>
							{v.etichetta}
						</span>
						<span className="barra-valore">
							<b>{v.testo}</b>
							{v.prima !== undefined && <Variazione ora={v.valore} prima={v.prima} inverso={v.inverso} />}
						</span>
					</div>
					<div className="barra-traccia" title={v.parti?.map((p) => `${p.etichetta}: ${p.valore}`).join(' · ')}>
						{v.parti ? (
							<span className="barra-pezzi" style={{ width: `${(v.valore / alto) * 100}%` }}>
								{v.parti
									.filter((p) => p.valore > 0)
									.map((p) => (
										<span key={p.etichetta} style={{ flexGrow: p.valore, background: p.colore }} />
									))}
							</span>
						) : (
							<span className="barra-pieno" style={{ width: `${(v.valore / alto) * 100}%`, background: v.colore ?? 'var(--verde)' }} />
						)}
					</div>
					{v.nota && <div className="barra-nota">{v.nota}</div>}
				</div>
			))}
		</div>
	);
}

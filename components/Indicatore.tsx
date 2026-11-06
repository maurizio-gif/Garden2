import { Numero } from '@/components/Numero';
import { Sparkline } from '@/components/Sparkline';
import { Variazione } from '@/components/Variazione';
import { formattaPer, type Formato } from '@/lib/format';

/** Un valore con il confronto allo stesso punto dell'anno scorso e l'andamento degli ultimi mesi. */
export function Indicatore({
	titolo,
	periodo,
	ora,
	prima,
	annoPrima,
	formato,
	serie,
	colore,
	nota,
	inverso,
	ritardo = 0,
}: {
	titolo: string;
	periodo: string;
	ora: number;
	prima?: number;
	/** Come si chiama il termine di confronto (es. «2025»); senza, non c'e' confronto. */
	annoPrima?: string;
	formato: Formato;
	serie?: number[];
	colore: string;
	nota?: string;
	/** Salire e' un male (sconti, sospensioni). */
	inverso?: boolean;
	ritardo?: number;
}) {
	return (
		<div className="scheda indicatore entra" style={{ '--ritardo': `${ritardo}ms`, '--tinta': colore } as React.CSSProperties}>
			<h3>
				<i className="tinta" />
				{titolo}
			</h3>
			<div className="grande">
				<Numero valore={ora} formato={formato} />
			</div>
			<div className="piccolo">{periodo}</div>
			{serie && <Sparkline serie={serie} colore={colore} />}
			{prima !== undefined && annoPrima ? (
				<div className="confronto">
					<span>
						{annoPrima} · <b>{formattaPer(formato, prima)}</b>
					</span>
					<Variazione ora={ora} prima={prima} inverso={inverso} />
				</div>
			) : (
				nota && <div className="confronto solo-nota">{nota}</div>
			)}
		</div>
	);
}

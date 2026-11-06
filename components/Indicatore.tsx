import { Variazione } from '@/components/Variazione';

/** Un valore con il confronto allo stesso punto dell'anno scorso. */
export function Indicatore({
	titolo,
	periodo,
	ora,
	prima,
	annoPrima,
	formato,
}: {
	titolo: string;
	periodo: string;
	ora: number;
	prima: number;
	annoPrima: string;
	formato: (n: number) => string;
}) {
	return (
		<div className="scheda">
			<h3>{titolo}</h3>
			<div className="grande">{formato(ora)}</div>
			<div className="piccolo">{periodo}</div>
			<div className="confronto">
				<span>
					{annoPrima} · <b>{formato(prima)}</b>
				</span>
				<Variazione ora={ora} prima={prima} />
			</div>
		</div>
	);
}

import { formatVariazione, variazione } from '@/lib/format';

/** «▲ +3,3%»: verde se sale, rosso se scende. Con `inverso` e' il contrario (sconti, sospensioni: salire non e' una buona notizia). */
export function Variazione({ ora, prima, inverso = false }: { ora: number; prima: number; inverso?: boolean }) {
	const v = variazione(ora, prima);
	const fermo = v === null || Math.abs(v) < 0.05;
	const sale = (v ?? 0) > 0;
	const classe = fermo ? 'nd' : sale !== inverso ? 'su' : 'giu';
	const freccia = fermo ? '' : sale ? '▲' : '▼';
	return (
		<span className={`variazione ${classe}`}>
			{freccia} {formatVariazione(v)}
		</span>
	);
}

import { formatVariazione, variazione } from '@/lib/format';

export function Variazione({ ora, prima }: { ora: number; prima: number }) {
	const v = variazione(ora, prima);
	const classe = v === null || Math.abs(v) < 0.05 ? 'nd' : v > 0 ? 'su' : 'giu';
	const freccia = classe === 'su' ? '▲' : classe === 'giu' ? '▼' : '';
	return (
		<span className={`variazione ${classe}`}>
			{freccia} {formatVariazione(v)}
		</span>
	);
}

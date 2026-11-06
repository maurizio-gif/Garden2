/** La linea degli ultimi mesi in piccolo, con l'area sotto. Si disegna da sinistra a destra all'apertura. */
export function Sparkline({ serie, colore = 'var(--verde-vivo)' }: { serie: number[]; colore?: string }) {
	if (serie.length < 2) return null;
	const L = 160;
	const A = 44;
	const margine = 4;
	const max = Math.max(...serie, 1);
	const min = Math.min(...serie, 0);
	const x = (i: number) => (i / (serie.length - 1)) * L;
	const y = (v: number) => margine + (A - margine * 2) * (1 - (v - min) / (max - min || 1));
	const linea = serie.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
	const area = `${linea} L${L} ${A} L0 ${A} Z`;
	const idGradiente = `sp-${colore.replace(/[^a-z0-9]/gi, '')}`;
	return (
		<svg className="spark" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden>
			<defs>
				<linearGradient id={idGradiente} x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stopColor={colore} stopOpacity="0.22" />
					<stop offset="1" stopColor={colore} stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={area} fill={`url(#${idGradiente})`} className="spark-area" />
			<path d={linea} fill="none" stroke={colore} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="spark-linea" vectorEffect="non-scaling-stroke" />
			<circle cx={x(serie.length - 1)} cy={y(serie[serie.length - 1])} r="3" fill={colore} className="spark-punto" vectorEffect="non-scaling-stroke" />
		</svg>
	);
}

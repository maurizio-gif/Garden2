import { coloreGruppo } from '@/lib/gruppi';
import { annoDi, meseBreve } from '@/lib/format';

type Punto = { mese_da: string; gruppo: string; valore: number };

const L = 720;
const A = 280;
const SX = 52;
const SUP = 12;
const GIU = 40;

/** Estremo «tondo» dell'asse e passo dei riferimenti orizzontali. */
function scala(max: number): { top: number; passo: number } {
	if (max <= 0) return { top: 1, passo: 1 };
	const grezzo = max / 4;
	const base = Math.pow(10, Math.floor(Math.log10(grezzo)));
	const passo = [1, 2, 2.5, 5, 10].map((m) => m * base).find((p) => p >= grezzo) ?? 10 * base;
	return { top: Math.ceil(max / passo) * passo, passo };
}

/** Barre impilate per mese e gruppo. L'ultimo mese, ancora in corso, e' piu' chiaro. */
export function BarreImpilate({
	dati,
	gruppi,
	formato,
	formatoAsse,
}: {
	dati: Punto[];
	gruppi: string[];
	formato: (n: number) => string;
	formatoAsse: (n: number) => string;
}) {
	const mesi = [...new Set(dati.map((d) => d.mese_da))].sort();
	if (mesi.length === 0) return <p className="nota">Nessun dato per questo periodo.</p>;

	const valore = (mese: string, gruppo: string) =>
		dati.find((d) => d.mese_da === mese && d.gruppo === gruppo)?.valore ?? 0;
	const usati = gruppi.filter((g) => dati.some((d) => d.gruppo === g));
	const totali = mesi.map((m) => usati.reduce((s, g) => s + valore(m, g), 0));
	const { top, passo } = scala(Math.max(...totali));
	const w = (L - SX) / mesi.length;
	const largBarra = Math.min(34, w * 0.62);
	const y = (v: number) => SUP + (A - SUP - GIU) * (1 - v / top);

	const riferimenti: number[] = [];
	for (let v = 0; v <= top + 1e-9; v += passo) riferimenti.push(v);

	return (
		<>
			<svg className="grafico" viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Grafico a barre per mese">
				{riferimenti.map((v) => (
					<g key={v}>
						<line className="asse" x1={SX} x2={L} y1={y(v)} y2={y(v)} />
						<text x={SX - 8} y={y(v) + 4} textAnchor="end">
							{formatoAsse(v)}
						</text>
					</g>
				))}
				{mesi.map((m, i) => {
					const x = SX + w * i + (w - largBarra) / 2;
					const inCorso = i === mesi.length - 1;
					let base = 0;
					return (
						<g key={m} className="barra" opacity={inCorso ? 0.55 : 1}>
							{usati.map((g) => {
								const v = valore(m, g);
								if (v <= 0) return null;
								const y0 = y(base);
								base += v;
								const y1 = y(base);
								return (
									<rect key={g} x={x} y={y1} width={largBarra} height={Math.max(y0 - y1, 0.5)} fill={coloreGruppo(g)}>
										<title>{`${meseBreve(m)} ${annoDi(m)} · ${g}: ${formato(v)}`}</title>
									</rect>
								);
							})}
							<text x={x + largBarra / 2} y={A - GIU + 16} textAnchor="middle">
								{meseBreve(m)}
							</text>
							{(i === 0 || m.slice(5, 7) === '01') && (
								<text x={x + largBarra / 2} y={A - GIU + 30} textAnchor="middle">
									{annoDi(m)}
								</text>
							)}
						</g>
					);
				})}
			</svg>
			<div className="legenda">
				{usati.map((g) => (
					<span key={g}>
						<i style={{ background: coloreGruppo(g) }} />
						{g}
					</span>
				))}
				<span>Colonna chiara: mese in corso</span>
			</div>
		</>
	);
}

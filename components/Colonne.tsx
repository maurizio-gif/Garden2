'use client';

import { useState } from 'react';
import { Variazione } from '@/components/Variazione';
import { coloreGruppo } from '@/lib/gruppi';
import { formattaPer, type Formato } from '@/lib/format';

export type Punto = {
	chiave: string;
	etichetta: string;
	anno?: string;
	titolo: string;
	/** I pezzi della colonna, dal basso verso l'alto. */
	parti: { gruppo: string; valore: number }[];
	/** Lo stesso mese un anno prima: un trattino sulla colonna e una riga nel riquadro. */
	confronto?: { valore: number; etichetta: string };
	/** Il mese in corso: la colonna e' tratteggiata, il numero puo' ancora cambiare. */
	inCorso?: boolean;
};

const ALTEZZA = 232;

/** Estremo «tondo» dell'asse e passo dei riferimenti orizzontali. */
function scala(max: number): { top: number; passo: number } {
	if (max <= 0) return { top: 1, passo: 1 };
	const grezzo = max / 4;
	const base = Math.pow(10, Math.floor(Math.log10(grezzo)));
	const passo = [1, 2, 2.5, 5, 10].map((m) => m * base).find((p) => p >= grezzo) ?? 10 * base;
	return { top: Math.ceil(max / passo) * passo, passo };
}

/** Colonne impilate per mese e gruppo. Al passaggio (o al tocco) si apre il riquadro con i numeri di quel mese. */
export function Colonne({
	punti,
	gruppi,
	formato,
	unita,
	colori,
}: {
	punti: Punto[];
	gruppi: string[];
	formato: Formato;
	unita?: string;
	/** Colori per serie che non ne hanno uno fisso (gli operatori). */
	colori?: Record<string, string>;
}) {
	const colore = (g: string) => colori?.[g] ?? coloreGruppo(g);
	const [scelta, setScelta] = useState<number | null>(null);
	if (punti.length === 0) return <p className="nota">Nessun dato per questo periodo.</p>;

	const totale = (p: Punto) => p.parti.reduce((s, x) => s + x.valore, 0);
	const alti = punti.flatMap((p) => [totale(p), p.confronto?.valore ?? 0]);
	const { top, passo } = scala(Math.max(...alti));
	const pct = (v: number) => `${(v / top) * 100}%`;
	const tacche: number[] = [];
	for (let v = 0; v <= top + 1e-9; v += passo) tacche.push(v);
	const usati = gruppi.filter((g) => punti.some((p) => p.parti.some((x) => x.gruppo === g && x.valore > 0)));

	return (
		<>
			<div className="colonne" style={{ '--altezza': `${ALTEZZA}px` } as React.CSSProperties} onMouseLeave={() => setScelta(null)}>
				<div className="colonne-asse" aria-hidden>
					{tacche.map((v) => (
						<span key={v} style={{ bottom: pct(v) }}>
							{formattaPer(formato === 'intero' || formato === 'percento' ? 'intero' : 'euroBreve', v)}
						</span>
					))}
				</div>
				<div className="colonne-area">
					{tacche.map((v) => (
						<i key={v} className="colonne-linea" style={{ bottom: pct(v) }} aria-hidden />
					))}
					{punti.map((p, i) => {
						const aperta = scelta === i;
						const lato = i < 3 ? 'sx' : i > punti.length - 4 ? 'dx' : 'centro';
						return (
							<button
								key={p.chiave}
								type="button"
								className={`colonna ${aperta ? 'aperta' : ''} ${p.inCorso ? 'in-corso' : ''}`}
								style={{ '--i': i } as React.CSSProperties}
								onMouseEnter={() => setScelta(i)}
								onFocus={() => setScelta(i)}
								onClick={() => setScelta(aperta ? null : i)}
								aria-label={`${p.titolo}: ${formattaPer(formato, totale(p))}`}
							>
								<span className="colonna-pila" style={{ height: pct(totale(p)) }}>
									{p.parti
										.filter((x) => x.valore > 0)
										.map((x) => (
											<span key={x.gruppo} className="pezzo" style={{ flexGrow: x.valore, background: colore(x.gruppo) }} />
										))}
								</span>
								{p.confronto && <span className="colonna-prima" style={{ bottom: pct(p.confronto.valore) }} aria-hidden />}
								<span className="colonna-nome">
									{p.etichetta}
									{p.anno && <small>{p.anno}</small>}
								</span>
								{aperta && (
									<span className={`riquadro ${lato}`} role="tooltip">
										<b className="riquadro-titolo">{p.titolo}</b>
										{[...p.parti]
											.filter((x) => x.valore > 0)
											.sort((a, b) => b.valore - a.valore)
											.map((x) => (
												<span key={x.gruppo} className="riquadro-riga">
													<i style={{ background: colore(x.gruppo) }} />
													{x.gruppo}
													<em>{formattaPer(formato, x.valore)}</em>
												</span>
											))}
										<span className="riquadro-riga totale">
											Totale{unita ? ` ${unita}` : ''}
											<em>{formattaPer(formato, totale(p))}</em>
										</span>
										{p.confronto && (
											<span className="riquadro-riga confronto-riga">
												{p.confronto.etichetta}
												<em>
													{formattaPer(formato, p.confronto.valore)} <Variazione ora={totale(p)} prima={p.confronto.valore} />
												</em>
											</span>
										)}
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>
			<div className="legenda">
				{usati.map((g) => (
					<span key={g}>
						<i style={{ background: colore(g) }} />
						{g}
					</span>
				))}
				{punti.some((p) => p.confronto) && (
					<span>
						<i className="trattino" /> anno scorso
					</span>
				)}
				{punti.some((p) => p.inCorso) && <span>Colonna tratteggiata: mese in corso</span>}
			</div>
		</>
	);
}

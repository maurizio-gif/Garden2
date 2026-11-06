import { Colonne, type Punto } from '@/components/Colonne';
import { GruppiFiltro } from '@/components/GruppiFiltro';
import { Indicatore } from '@/components/Indicatore';
import { SociAttivi } from '@/components/SociAttivi';
import { caricaDirezione } from '@/lib/direzione';
import {
	annoDi,
	formatEuro,
	formatGiornoBreve,
	formatGiornoLungo,
	formatIntero,
	formatOrario,
	meseBreve,
	saluto,
} from '@/lib/format';
import { coloreGruppo } from '@/lib/gruppi';

export const dynamic = 'force-dynamic';

const ordina = <T extends { mese_da: string }>(a: T[]) => [...a].sort((x, y) => x.mese_da.localeCompare(y.mese_da));

export default async function Direzione({ searchParams }: { searchParams: { gruppi?: string } }) {
	const { riepilogo: r, gruppi, scelti, calcolato_il, sincronizzato_il } = await caricaDirezione(searchParams.gruppi);

	const annoPrima = String(Number(annoDi(r.oggi)) - 1);
	const k = r.kpi;
	const ordine = scelti ?? gruppi;
	const mesi = ordina(r.mensile_prec).map((m) => m.mese_da);

	// Totali per mese, per le linee piccole dei numeri.
	const perMese = (campo: 'fatturato' | 'vendite') =>
		mesi.map((m) => r.fatturato_mensile.filter((d) => d.mese_da === m).reduce((s, d) => s + Number(d[campo]), 0));
	const cumulata = (serie: number[]) => serie.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []);
	const fatturatoMese = perMese('fatturato');
	const venditeMese = perMese('vendite');

	const puntiFatturato: Punto[] = mesi.map((m, i) => {
		const prec = r.mensile_prec.find((x) => x.mese_da === m);
		return {
			chiave: m,
			etichetta: meseBreve(m),
			anno: i === 0 || m.slice(5, 7) === '01' ? annoDi(m) : undefined,
			titolo: `${meseBreve(m)} ${annoDi(m)}${i === mesi.length - 1 ? ' · finora' : ''}`,
			inCorso: i === mesi.length - 1,
			parti: ordine.map((g) => ({
				gruppo: g,
				valore: Number(r.fatturato_mensile.find((d) => d.mese_da === m && d.gruppo === g)?.fatturato ?? 0),
			})),
			confronto: prec ? { valore: Number(prec.fatturato), etichetta: `${meseBreve(m)} ${Number(annoDi(m)) - 1}` } : undefined,
		};
	});
	const puntiSoci: Punto[] = mesi.map((m, i) => ({
		chiave: m,
		etichetta: meseBreve(m),
		anno: i === 0 || m.slice(5, 7) === '01' ? annoDi(m) : undefined,
		titolo: `${meseBreve(m)} ${annoDi(m)}${i === mesi.length - 1 ? ' · oggi' : ' · fine mese'}`,
		inCorso: i === mesi.length - 1,
		parti: ordine.map((g) => ({
			gruppo: g,
			valore: Number(r.soci_mensili.find((d) => d.mese_da === m && d.gruppo === g)?.soci ?? 0),
		})),
	}));

	const aggiornamento = sincronizzato_il ?? calcolato_il;

	return (
		<div className="contenitore">
			<header className="hero entra">
				<div>
					<div className="eyebrow">{formatGiornoLungo(new Date())}</div>
					<h1>
						{saluto()}, ecco come va <em>Garden</em>.
					</h1>
					<p className="sotto">
						Vendite, fatturato e soci attivi di oggi, confrontati con lo stesso punto del {annoPrima}.
					</p>
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

			<GruppiFiltro gruppi={gruppi} scelti={scelti} />

			<div className="griglia quattro">
				<Indicatore
					titolo="Vendite da inizio mese"
					periodo="confronto a pari giorni"
					ora={k.vendite_mese}
					prima={k.vendite_mese_prec}
					annoPrima={annoPrima}
					formato="intero"
					serie={venditeMese}
					colore="#0f9d6b"
					ritardo={0}
				/>
				<Indicatore
					titolo="Fatturato da inizio mese"
					periodo="confronto a pari giorni"
					ora={k.fatturato_mese}
					prima={k.fatturato_mese_prec}
					annoPrima={annoPrima}
					formato="euro"
					serie={fatturatoMese}
					colore="#1ba8e0"
					ritardo={70}
				/>
				<Indicatore
					titolo="Vendite da inizio anno"
					periodo="dal 1 gennaio, a pari giorni"
					ora={k.vendite_anno}
					prima={k.vendite_anno_prec}
					annoPrima={annoPrima}
					formato="intero"
					serie={cumulata(venditeMese)}
					colore="#f2a516"
					ritardo={140}
				/>
				<Indicatore
					titolo="Fatturato da inizio anno"
					periodo="dal 1 gennaio, a pari giorni"
					ora={k.fatturato_anno}
					prima={k.fatturato_anno_prec}
					annoPrima={annoPrima}
					formato="euro"
					serie={cumulata(fatturatoMese)}
					colore="#7c5cff"
					ritardo={210}
				/>
			</div>

			<div className="griglia principale">
				<SociAttivi oggi={r.soci.oggi} meseFa={r.soci.mese_fa} annoFa={r.soci.anno_fa} giorno={r.oggi} conQuote={scelti !== null} />
				<div className="scheda entra" style={{ '--ritardo': '400ms' } as React.CSSProperties}>
					<h3>Fatturato mensile per gruppo</h3>
					<p className="nota">Ultimi 12 mesi, con lo stesso mese dell&apos;anno scorso. Passa sopra una colonna per i dettagli.</p>
					<Colonne punti={puntiFatturato} gruppi={ordine} formato="euro" />
				</div>
			</div>

			<div className="griglia secondaria">
				<div className="scheda entra" style={{ '--ritardo': '480ms' } as React.CSSProperties}>
					<h3>Soci attivi per mese</h3>
					<p className="nota">A fine mese, per gruppo: un socio con più abbonamenti compare in ciascuno.</p>
					<Colonne punti={puntiSoci} gruppi={ordine} formato="intero" />
				</div>
				<div className="scheda entra" style={{ '--ritardo': '560ms' } as React.CSSProperties}>
					<h3 className="con-live">
						<i className="punto-live" aria-hidden />
						Ultime vendite
					</h3>
					<p className="nota">Le quattro più recenti dal gestionale, senza nomi.</p>
					<ul className="feed">
						{r.ultime_vendite.map((v, i) => (
							<li key={v.data_vendita + v.abbonamento} style={{ '--i': i } as React.CSSProperties}>
								<span className="feed-barra" style={{ background: coloreGruppo(v.gruppo) }} />
								<span className="feed-corpo">
									<b>{v.abbonamento}</b>
									<small>
										{v.gruppo} · {formatGiornoBreve(v.data_vendita)}, {formatOrario(v.data_vendita)}
									</small>
								</span>
								<span className="feed-importo">{formatEuro(Number(v.totale))}</span>
							</li>
						))}
					</ul>
				</div>
			</div>

			<p className="piede">
				Vendite e fatturato per data di vendita, dal 2016: il fatturato è il totale degli abbonamenti venduti, non la cassa. Numeri ricalcolati ogni dieci
				minuti{calcolato_il ? `, l’ultima volta alle ${formatOrario(calcolato_il)}` : ''}.
			</p>
		</div>
	);
}

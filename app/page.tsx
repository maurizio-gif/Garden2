import { BarreImpilate } from '@/components/BarreImpilate';
import { GruppiFiltro } from '@/components/GruppiFiltro';
import { Indicatore } from '@/components/Indicatore';
import { Variazione } from '@/components/Variazione';
import { caricaDirezione } from '@/lib/direzione';
import {
	annoDi,
	formatData,
	formatEuro,
	formatGiornoBreve,
	formatIntero,
	formatOrario,
} from '@/lib/format';
import { coloreGruppo } from '@/lib/gruppi';

export const dynamic = 'force-dynamic';

const SEZIONI = ['Direzione', 'Abbonamenti', 'Incassato', 'Vendite', 'Accessi', 'Soci', 'Operatori'];

const formatoMigliaia = (n: number) => (n >= 1000 ? `${formatIntero(n / 1000)}k` : formatIntero(n));
const formatoEuroAsse = (n: number) => (n >= 1000 ? `${formatIntero(n / 1000)}k €` : `${formatIntero(n)} €`);

export default async function Direzione({ searchParams }: { searchParams: { gruppi?: string } }) {
	const { riepilogo: r, gruppi, scelti, aggiornato_il } = await caricaDirezione(searchParams.gruppi);

	const anno = annoDi(r.oggi);
	const annoPrima = String(Number(anno) - 1);
	const k = r.kpi;
	const ordine = scelti ?? gruppi;

	return (
		<div className="contenitore">
			<header className="testata">
				<div className="eyebrow">Cruscotto club</div>
				<h1>
					Garden, <em>come stiamo andando</em>.
				</h1>
				<p className="sotto">
					Vendite, fatturato e soci attivi di oggi, confrontati con lo stesso punto dell&apos;anno scorso.
				</p>
				{aggiornato_il && (
					<span className="stato">
						Ultimo aggiornamento {formatGiornoBreve(aggiornato_il)}, ore {formatOrario(aggiornato_il)} · sincronizzazione ogni 5 minuti
					</span>
				)}
			</header>

			<nav className="sezioni" aria-label="Sezioni del cruscotto">
				{SEZIONI.map((s) => (
					<span key={s} className={`sezione ${s === 'Direzione' ? 'attiva' : ''}`} aria-current={s === 'Direzione' ? 'page' : undefined}>
						{s}
					</span>
				))}
			</nav>

			<h2 className="titolo-sezione">Dashboard direzionale</h2>
			<p className="nota">
				Aggiornata a oggi, {formatData(r.oggi)}: da inizio mese e da inizio anno, confrontati a parità di giorni con il {annoPrima}.
			</p>

			<GruppiFiltro gruppi={gruppi} scelti={scelti} />

			<div className="griglia quattro">
				<Indicatore
					titolo="Vendite da inizio mese"
					periodo="confronto a pari giorni"
					ora={k.vendite_mese}
					prima={k.vendite_mese_prec}
					annoPrima={annoPrima}
					formato={formatIntero}
				/>
				<Indicatore
					titolo="Fatturato da inizio mese"
					periodo="confronto a pari giorni"
					ora={k.fatturato_mese}
					prima={k.fatturato_mese_prec}
					annoPrima={annoPrima}
					formato={formatEuro}
				/>
				<Indicatore
					titolo="Vendite da inizio anno"
					periodo="dal 1 gennaio"
					ora={k.vendite_anno}
					prima={k.vendite_anno_prec}
					annoPrima={annoPrima}
					formato={formatIntero}
				/>
				<Indicatore
					titolo="Fatturato da inizio anno"
					periodo="dal 1 gennaio"
					ora={k.fatturato_anno}
					prima={k.fatturato_anno_prec}
					annoPrima={annoPrima}
					formato={formatEuro}
				/>
			</div>

			<section className="sezione-blocco">
				<h2>Soci attivi</h2>
				<p className="nota">
					Persone con almeno un abbonamento in corso, non scaduto
					{scelti ? '' : '. Le quote associative non contano.'}
				</p>
				<div className="scheda soci">
					<div className="principale">
						<h3>Oggi</h3>
						<div className="grande">{formatIntero(r.soci.oggi)}</div>
						<div className="piccolo">{formatData(r.oggi)}</div>
					</div>
					<div>
						<h3>Un mese fa</h3>
						<div className="grande">{formatIntero(r.soci.mese_fa)}</div>
						<div className="piccolo">
							rispetto a oggi <Variazione ora={r.soci.oggi} prima={r.soci.mese_fa} />
						</div>
					</div>
					<div>
						<h3>Un anno fa</h3>
						<div className="grande">{formatIntero(r.soci.anno_fa)}</div>
						<div className="piccolo">
							rispetto a oggi <Variazione ora={r.soci.oggi} prima={r.soci.anno_fa} />
						</div>
					</div>
				</div>
			</section>

			<div className="griglia due sezione-blocco">
				<div className="scheda">
					<h3>Fatturato mensile per gruppo</h3>
					<p className="nota">ultimi 12 mesi</p>
					<BarreImpilate
						dati={r.fatturato_mensile.map((d) => ({ mese_da: d.mese_da, gruppo: d.gruppo, valore: Number(d.fatturato) }))}
						gruppi={ordine}
						formato={formatEuro}
						formatoAsse={formatoEuroAsse}
					/>
				</div>
				<div className="scheda">
					<h3>Soci attivi per mese</h3>
					<p className="nota">a fine mese, per gruppo (un socio con più gruppi compare in ciascuno)</p>
					<BarreImpilate
						dati={r.soci_mensili.map((d) => ({ mese_da: d.mese_da, gruppo: d.gruppo, valore: Number(d.soci) }))}
						gruppi={ordine}
						formato={formatIntero}
						formatoAsse={formatoMigliaia}
					/>
				</div>
			</div>

			<section className="sezione-blocco">
				<h2>Ultime vendite dal gestionale</h2>
				<p className="nota">le quattro più recenti, senza nomi dei clienti</p>
				<div className="vendite-recenti">
					{r.ultime_vendite.map((v) => (
						<div key={v.data_vendita + v.abbonamento} className="vendita">
							<div className="riga">
								<span>
									{formatGiornoBreve(v.data_vendita)} · {formatOrario(v.data_vendita)}
								</span>
								<b>{formatEuro(Number(v.totale))}</b>
							</div>
							<div className="nome">{v.abbonamento}</div>
							<div className="gruppo">
								<i style={{ background: coloreGruppo(v.gruppo) }} />
								{v.gruppo}
							</div>
						</div>
					))}
				</div>
			</section>

			<p className="piede">
				Vendite e fatturato per data di vendita, dal 2016. Il fatturato è il totale degli abbonamenti venduti, non la cassa incassata.
			</p>
		</div>
	);
}

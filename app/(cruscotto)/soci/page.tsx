import { Barre } from '@/components/Barre';
import { Colonne } from '@/components/Colonne';
import { Indicatore } from '@/components/Indicatore';
import { Testata } from '@/components/Testata';
import { caricaSezione, type Soci } from '@/lib/cruscotto';
import { annoDi, capitalizza, formatIntero, formatOrario } from '@/lib/format';
import { puntiMensili, ultimiMesi } from '@/lib/punti';

export const dynamic = 'force-dynamic';

const COLORE_SESSO: Record<string, string> = { Donne: '#e0559b', Uomini: '#1ba8e0', 'Non indicato': '#c9d1cc' };

export default async function PaginaSoci() {
	const { dati: s, calcolato_il, sincronizzato_il } = await caricaSezione<Soci>('soci');
	const mesi = ultimiMesi(s.oggi);
	const annoPrima = String(Number(annoDi(s.oggi)) - 1);
	const donne = s.sesso.find((x) => x.sesso === 'Donne')?.n ?? 0;
	const uomini = s.sesso.find((x) => x.sesso === 'Uomini')?.n ?? 0;
	const ultimoMese = s.nuovi.at(-1);
	const conEta = s.totale - s.eta_nota;

	const puntiEta = s.fasce_eta.map((f) => ({
		chiave: f.fascia,
		etichetta: f.fascia,
		titolo: f.fascia === 'Non indicata' ? 'Età non indicata' : `${f.fascia} anni`,
		parti: [{ gruppo: 'Soci', valore: f.n }],
	}));

	return (
		<div className="contenitore">
			<Testata
				titolo="Soci"
				frase="Chi sono"
				evidenza="i soci del club."
				sotto="Età, sesso e zona dei soci con un abbonamento in corso, e i nuovi iscritti. Solo numeri aggregati: nessun nome e nessun recapito."
				aggiornamento={sincronizzato_il ?? calcolato_il}
			/>

			<div className="griglia quattro">
				<Indicatore titolo="Soci attivi" periodo="abbonamento in corso, senza le quote" ora={s.totale} formato="intero" colore="#0f9d6b" nota="Le persone, contate una volta sola" ritardo={0} />
				<Indicatore
					titolo="Età media"
					periodo="anni"
					ora={s.eta_media ?? 0}
					formato="intero"
					colore="#1ba8e0"
					nota={`Calcolata su ${formatIntero(conEta)} soci con la data di nascita`}
					ritardo={70}
				/>
				<Indicatore
					titolo="Donne"
					periodo="sul totale dei soci con il sesso indicato"
					ora={donne + uomini ? (donne / (donne + uomini)) * 100 : 0}
					formato="percento"
					colore="#e0559b"
					nota={`${formatIntero(donne)} donne, ${formatIntero(uomini)} uomini`}
					ritardo={140}
				/>
				<Indicatore
					titolo="Nuovi iscritti"
					periodo="da inizio mese, a pari giorni"
					ora={ultimoMese?.n ?? 0}
					prima={ultimoMese?.n_prec}
					annoPrima={annoPrima}
					formato="intero"
					serie={s.nuovi.map((x) => x.n)}
					colore="#f2a516"
					ritardo={210}
				/>
			</div>

			<div className="griglia meta">
				<div className="scheda entra" style={{ '--ritardo': '300ms' } as React.CSSProperties}>
					<h3>Soci per età</h3>
					<p className="nota">Fasce di età dei soci attivi.</p>
					<Colonne punti={puntiEta} gruppi={['Soci']} formato="intero" />
				</div>
				<div className="scheda entra" style={{ '--ritardo': '380ms' } as React.CSSProperties}>
					<h3>Nuovi iscritti per mese</h3>
					<p className="nota">Chi ha preso il suo primo abbonamento, con lo stesso mese dell&apos;anno scorso.</p>
					<Colonne
						punti={puntiMensili(mesi, ['Nuovi iscritti'], (m) => s.nuovi.find((x) => x.mese_da === m)?.n ?? 0, {
							confronto: (m) => s.nuovi.find((x) => x.mese_da === m)?.n_prec,
						})}
						gruppi={['Nuovi iscritti']}
						formato="intero"
					/>
				</div>
			</div>

			<div className="griglia tre">
				<div className="scheda entra" style={{ '--ritardo': '460ms' } as React.CSSProperties}>
					<h3>Uomini e donne</h3>
					<div style={{ marginTop: 14 }}>
						<Barre
							voci={s.sesso.map((x) => ({
								etichetta: x.sesso,
								valore: x.n,
								testo: formatIntero(x.n),
								nota: `${s.totale ? Math.round((x.n / s.totale) * 100) : 0}% dei soci`,
								colore: COLORE_SESSO[x.sesso] ?? '#c9d1cc',
							}))}
						/>
					</div>
				</div>
				<div className="scheda entra" style={{ '--ritardo': '540ms' } as React.CSSProperties}>
					<h3>Zona di residenza</h3>
					<div style={{ marginTop: 14 }}>
						<Barre
							voci={s.zone.map((x) => ({
								etichetta: x.zona === 'Altre zone' || x.zona === 'Non indicata' ? x.zona : capitalizza(x.zona),
								valore: x.n,
								testo: formatIntero(x.n),
								colore: x.zona === 'Altre zone' || x.zona === 'Non indicata' ? '#c9d1cc' : '#0f9d6b',
							}))}
						/>
					</div>
				</div>
				<div className="scheda entra" style={{ '--ritardo': '620ms' } as React.CSSProperties}>
					<h3>Da quanto sono soci</h3>
					<p className="nota">Dal primo abbonamento nello storico (2016).</p>
					<Barre voci={s.anzianita.map((x) => ({ etichetta: x.fascia, valore: x.n, testo: formatIntero(x.n), colore: '#7c5cff' }))} />
				</div>
			</div>
			<p className="piede">
				Soci attivi come nella Direzione: almeno un abbonamento in corso oggi, escluse le quote associative. L&apos;anzianità non può risalire a prima del 2016. Numeri ricalcolati ogni mezz&apos;ora{calcolato_il ? `, l’ultima volta alle ${formatOrario(calcolato_il)}` : ''}.
			</p>
		</div>
	);
}

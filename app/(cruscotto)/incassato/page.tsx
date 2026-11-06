import { Barre } from '@/components/Barre';
import { Colonne, type Punto } from '@/components/Colonne';
import { Indicatore } from '@/components/Indicatore';
import { Testata } from '@/components/Testata';
import { caricaSezione, type Incassato } from '@/lib/cruscotto';
import { annoDi, formatEuro, formatGiornoBreve, formatIntero, formatOrario } from '@/lib/format';
import { puntiMensili, sommaMese, ultimiMesi } from '@/lib/punti';

export const dynamic = 'force-dynamic';

const METODI = ['Contanti', 'Carte e bancomat', 'RID e bonifici', 'Assegni', 'Altro'];
const SERVIZI = ['Abbonamenti', 'Corsi', 'Campi e prenotazioni', 'Shop', 'Bar e borsellino', 'Altro'];

export default async function PaginaIncassato() {
	const { dati: d, calcolato_il, sincronizzato_il } = await caricaSezione<Incassato>('incassato');
	const mesi = ultimiMesi(d.oggi);
	const annoPrima = String(Number(annoDi(d.oggi)) - 1);
	const k = d.kpi;
	const valore = (righe: typeof d.metodi) => (m: string, g: string) => righe.find((r) => r.mese_da === m && r.gruppo === g)?.valore ?? 0;
	const totaleMese = mesi.map((m) => sommaMese(d.metodi, m, (r) => r.valore));
	const prec = (m: string) => d.mensile_prec.find((x) => x.mese_da === m)?.valore;

	const quota = (a: number, b: number) => (b ? (a / b) * 100 : 0);
	const scadute = d.rate.filter((r) => r.fascia.startsWith('Scadute') && !r.fascia.includes('oltre'));
	const scaduteImporto = scadute.reduce((s, r) => s + Number(r.importo), 0);
	const scaduteN = scadute.reduce((s, r) => s + r.n, 0);

	// Gli ultimi 30 giorni, anche quelli senza incassi: l'asse non deve saltare.
	const giorni = Array.from({ length: 30 }, (_, i) => new Date(Date.parse(`${d.oggi}T12:00:00Z`) - (29 - i) * 86_400_000).toISOString().slice(0, 10));
	const puntiGiorni: Punto[] = giorni.map((g, i) => ({
		chiave: g,
		etichetta: String(Number(g.slice(8, 10))),
		anno: i === 0 || g.slice(8, 10) === '01' ? ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'][Number(g.slice(5, 7)) - 1] : undefined,
		titolo: formatGiornoBreve(`${g}T12:00:00`) + (i === giorni.length - 1 ? ' · oggi' : ''),
		inCorso: i === giorni.length - 1,
		parti: METODI.map((m) => ({ gruppo: m, valore: Math.max(Number(d.giornaliero.find((x) => x.mese_da === g && x.gruppo === m)?.valore ?? 0), 0) })),
	}));

	return (
		<div className="contenitore">
			<Testata
				titolo="Incassato"
				frase="Cosa è entrato in cassa,"
				evidenza="e cosa manca."
				sotto={`La cassa per metodo di pagamento e per servizio, confrontata con il venduto e con lo stesso punto del ${annoPrima}.`}
				aggiornamento={sincronizzato_il ?? calcolato_il}
			/>

			<div className="griglia quattro">
				<Indicatore titolo="Incassato da inizio mese" periodo="tutta la cassa, a pari giorni" ora={k.incassato_mese} prima={k.incassato_mese_prec} annoPrima={annoPrima} formato="euro" serie={totaleMese} colore="#0f9d6b" ritardo={0} />
				<Indicatore titolo="Incassato da inizio anno" periodo="dal 1 gennaio, a pari giorni" ora={k.incassato_anno} prima={k.incassato_anno_prec} annoPrima={annoPrima} formato="euro" colore="#1ba8e0" ritardo={70} />
				<Indicatore
					titolo="Incassato su venduto"
					periodo="abbonamenti, da inizio anno"
					ora={quota(k.incassato_abb_anno, k.venduto_anno)}
					prima={quota(k.incassato_abb_anno_prec, k.venduto_anno_prec)}
					annoPrima={annoPrima}
					formato="percento"
					colore="#f2a516"
					ritardo={140}
				/>
				<Indicatore
					titolo="Rate scadute non pagate"
					periodo={`${formatIntero(scaduteN)} rate negli ultimi 12 mesi`}
					ora={scaduteImporto}
					formato="euro"
					colore="#ff7a59"
					nota="Da richiamare: vedi il dettaglio più sotto"
					ritardo={210}
				/>
			</div>

			<div className="griglia meta">
				<div className="scheda entra" style={{ '--ritardo': '300ms' } as React.CSSProperties}>
					<h3>Incassato per metodo di pagamento</h3>
					<p className="nota">Ultimi 12 mesi, con lo stesso mese dell&apos;anno scorso.</p>
					<Colonne punti={puntiMensili(mesi, METODI, valore(d.metodi), { confronto: prec })} gruppi={METODI} formato="euro" />
				</div>
				<div className="scheda entra" style={{ '--ritardo': '380ms' } as React.CSSProperties}>
					<h3>Incassato per servizio</h3>
					<p className="nota">Abbonamenti, corsi, campi, shop e bar.</p>
					<Colonne punti={puntiMensili(mesi, SERVIZI, valore(d.servizi))} gruppi={SERVIZI} formato="euro" />
				</div>
			</div>

			<div className="griglia sei">
				<div className="scheda entra" style={{ '--ritardo': '460ms' } as React.CSSProperties}>
					<h3>Gli ultimi 30 giorni, giorno per giorno</h3>
					<p className="nota">Incassato di ogni giorno, per metodo.</p>
					<Colonne punti={puntiGiorni} gruppi={METODI} formato="euro" />
				</div>
				<div className="scheda entra" style={{ '--ritardo': '540ms' } as React.CSSProperties}>
					<h3>Rate non pagate</h3>
					<p className="nota">Rate dei piani di pagamento non ancora incassate.</p>
					<Barre
						voci={d.rate.map((r) => ({
							etichetta: r.fascia,
							valore: Number(r.importo),
							testo: formatEuro(Number(r.importo)),
							nota: `${formatIntero(r.n)} rate${r.con_errore ? ` · ${formatIntero(r.con_errore)} con errore di addebito` : ''}`,
							colore: r.fascia.startsWith('Prossimi') ? '#1ba8e0' : r.fascia.includes('oltre') ? '#c9d1cc' : '#ff7a59',
						}))}
					/>
				</div>
			</div>
			<p className="piede">
				Cassa dal 2016, per data dell&apos;operazione. Il venduto è il totale degli abbonamenti, quindi il rapporto «incassato su venduto» considera solo gli abbonamenti. Le rate scadute da oltre un anno sono quasi sempre storiche e restano in grigio. Numeri ricalcolati ogni mezz&apos;ora{calcolato_il ? `, l’ultima volta alle ${formatOrario(calcolato_il)}` : ''}.
			</p>
		</div>
	);
}

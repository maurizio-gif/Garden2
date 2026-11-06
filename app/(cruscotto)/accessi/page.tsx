import { Barre } from '@/components/Barre';
import { Colonne } from '@/components/Colonne';
import { Indicatore } from '@/components/Indicatore';
import { Testata } from '@/components/Testata';
import { caricaSezione, type Accessi } from '@/lib/cruscotto';
import { annoDi, formatData, formatIntero, formatOrario } from '@/lib/format';
import { coloreGruppo } from '@/lib/gruppi';
import { puntiMensili, ultimiMesi } from '@/lib/punti';

export const dynamic = 'force-dynamic';

const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export default async function PaginaAccessi() {
	const { dati: d, calcolato_il, sincronizzato_il } = await caricaSezione<Accessi>('accessi');
	const mesi = ultimiMesi(d.fine);
	const annoPrima = String(Number(annoDi(d.fine)) - 1);
	const k = d.kpi;
	const i = d.inattivi;
	const fermi = i.da_31_60 + i.da_61_90 + i.oltre_90;
	const indietro = (new Date(d.oggi).getTime() - new Date(d.fine).getTime()) / 86_400_000;

	const ore = Array.from({ length: 19 }, (_, x) => x + 5);
	const puntiOre = ore.map((o) => ({
		chiave: String(o),
		etichetta: `${o}`,
		titolo: `Ore ${o}:00-${o}:59`,
		parti: [{ gruppo: 'Accessi', valore: d.ore.find((x) => x.ora === o)?.n ?? 0 }],
	}));
	const puntiSett = GIORNI.map((g, x) => ({
		chiave: g,
		etichetta: g.slice(0, 3),
		titolo: g,
		parti: [{ gruppo: 'Accessi', valore: d.settimana.find((s) => s.giorno === x + 1)?.n ?? 0 }],
	}));

	return (
		<div className="contenitore">
			<Testata
				titolo="Accessi"
				frase="Chi viene, quando,"
				evidenza="e chi ha smesso."
				sotto={`Ingressi al club per giorno e fascia oraria, e i soci con un abbonamento in corso che non si vedono più. Confronto con lo stesso punto del ${annoPrima}.`}
				aggiornamento={sincronizzato_il ?? calcolato_il}
			/>
			{indietro > 7 && (
				<p className="avviso" role="status">
					<span>
						<b>Lo storico degli accessi si sta ancora caricando.</b> I numeri qui sotto arrivano fino al {formatData(d.fine)} e si aggiorneranno da soli
						fino a oggi.
					</span>
				</p>
			)}

			<div className="griglia quattro">
				<Indicatore titolo="Accessi ultimi 7 giorni" periodo={`fino al ${formatData(d.fine)}`} ora={k.sette} prima={k.sette_prec} annoPrima={annoPrima} formato="intero" colore="#0f9d6b" ritardo={0} />
				<Indicatore titolo="Accessi ultimi 30 giorni" periodo="ingressi consentiti" ora={k.trenta} prima={k.trenta_prec} annoPrima={annoPrima} formato="intero" colore="#1ba8e0" ritardo={70} />
				<Indicatore titolo="Soci diversi, ultimi 30 giorni" periodo="persone entrate almeno una volta" ora={k.soci_30} prima={k.soci_30_prec} annoPrima={annoPrima} formato="intero" colore="#f2a516" ritardo={140} />
				<Indicatore
					titolo="Soci attivi che non vengono"
					periodo="abbonamento in corso, nessun accesso da 30 giorni"
					ora={fermi}
					formato="intero"
					colore="#ff7a59"
					nota={`su ${formatIntero(i.attivi)} soci attivi`}
					ritardo={210}
				/>
			</div>

			<div className="griglia principale">
				<div className="scheda entra" style={{ '--ritardo': '300ms' } as React.CSSProperties}>
					<h3>Chi ha smesso di venire</h3>
					<p className="nota">Soci con un abbonamento in corso, per giorni dall&apos;ultimo accesso.</p>
					<Barre
						voci={[
							{ etichetta: 'Entrati negli ultimi 30 giorni', valore: i.entrati_30, testo: formatIntero(i.entrati_30), colore: '#0f9d6b' },
							{ etichetta: 'Ultimo accesso 31-60 giorni fa', valore: i.da_31_60, testo: formatIntero(i.da_31_60), colore: '#f2a516' },
							{ etichetta: 'Ultimo accesso 61-90 giorni fa', valore: i.da_61_90, testo: formatIntero(i.da_61_90), colore: '#ff7a59' },
							{ etichetta: 'Oltre 90 giorni, o mai', valore: i.oltre_90, testo: formatIntero(i.oltre_90), colore: '#c8472f' },
						]}
						massimo={i.attivi}
					/>
					<h3 style={{ marginTop: 22 }}>Fermi da oltre 30 giorni, per gruppo</h3>
					<div style={{ marginTop: 12 }}>
						<Barre
							voci={d.inattivi_gruppi.map((g) => ({
								etichetta: g.gruppo,
								valore: g.inattivi,
								testo: formatIntero(g.inattivi),
								nota: `su ${formatIntero(g.attivi)} attivi (${g.attivi ? Math.round((g.inattivi / g.attivi) * 100) : 0}%)`,
								colore: coloreGruppo(g.gruppo),
							}))}
						/>
					</div>
				</div>
				<div className="scheda entra" style={{ '--ritardo': '380ms' } as React.CSSProperties}>
					<h3>Accessi per mese</h3>
					<p className="nota">Ultimi 12 mesi, con lo stesso mese dell&apos;anno scorso.</p>
					<Colonne
						punti={puntiMensili(mesi, ['Accessi'], (m) => d.mensile.find((x) => x.mese_da === m)?.n ?? 0, {
							confronto: (m) => d.mensile.find((x) => x.mese_da === m)?.n_prec,
						})}
						gruppi={['Accessi']}
						formato="intero"
					/>
				</div>
			</div>

			<div className="griglia meta">
				<div className="scheda entra" style={{ '--ritardo': '460ms' } as React.CSSProperties}>
					<h3>Affluenza per fascia oraria</h3>
					<p className="nota">Ingressi degli ultimi tre mesi, ora per ora.</p>
					<Colonne punti={puntiOre} gruppi={['Accessi']} formato="intero" />
				</div>
				<div className="scheda entra" style={{ '--ritardo': '540ms' } as React.CSSProperties}>
					<h3>Affluenza per giorno della settimana</h3>
					<p className="nota">Ingressi degli ultimi tre mesi.</p>
					<Colonne punti={puntiSett} gruppi={['Accessi']} formato="intero" />
				</div>
			</div>
			<p className="piede">
				Si contano gli ingressi consentiti (abbonamento, prenotazione, omaggio, gold card); i rifiuti e i lettori di uscita no. «Oltre 90 giorni, o mai» comprende chi non risulta con accessi negli ultimi tre mesi. Numeri ricalcolati ogni ora{calcolato_il ? `, l’ultima volta alle ${formatOrario(calcolato_il)}` : ''}.
			</p>
		</div>
	);
}

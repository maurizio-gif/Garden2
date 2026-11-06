import { Barre } from '@/components/Barre';
import { Colonne } from '@/components/Colonne';
import { Testata } from '@/components/Testata';
import { caricaSezione, type Operatori } from '@/lib/cruscotto';
import { annoDi, capitalizza, formatEuro, formatIntero, formatOrario } from '@/lib/format';
import { PALETTE } from '@/lib/gruppi';
import { puntiMensili, ultimiMesi } from '@/lib/punti';

export const dynamic = 'force-dynamic';

export default async function PaginaOperatori() {
	const { dati: o, calcolato_il, sincronizzato_il } = await caricaSezione<Operatori>('operatori');
	const mesi = ultimiMesi(o.oggi);
	const annoPrima = String(Number(annoDi(o.oggi)) - 1);
	const nome = (t: string) => (t === 'Non indicato' || t === 'Altri' ? t : capitalizza(t));

	// Un colore per ciascuno dei primi sei, grigio per gli altri.
	const serie = [...o.ordine, 'Altri'];
	const colori = Object.fromEntries(serie.map((g, i) => [g, i < o.ordine.length ? PALETTE[i] : '#c9d1cc']));
	const etichette = Object.fromEntries(serie.map((g) => [g, nome(g)]));
	const puntiMensile = puntiMensili(mesi, serie, (m, g) => o.mensile.find((x) => x.mese_da === m && x.gruppo === g)?.valore ?? 0).map((p) => ({
		...p,
		parti: p.parti.map((x) => ({ ...x, gruppo: etichette[x.gruppo] ?? x.gruppo })),
	}));
	const coloriEtichette = Object.fromEntries(serie.map((g) => [etichette[g], colori[g]]));

	return (
		<div className="contenitore">
			<Testata
				titolo="Operatori"
				frase="Il lavoro"
				evidenza="della segreteria."
				sotto={`Vendite, operazioni di cassa e azioni CRM per operatore, da inizio anno. Vendite confrontate con lo stesso punto del ${annoPrima}.`}
				aggiornamento={sincronizzato_il ?? calcolato_il}
			/>

			<div className="griglia meta">
				<div className="scheda entra" style={{ '--ritardo': '100ms' } as React.CSSProperties}>
					<h3>Vendite per venditore</h3>
					<p className="nota">Da inizio anno, con la variazione sullo stesso periodo del {annoPrima}.</p>
					<Barre
						voci={o.vendite.map((x, i) => ({
							etichetta: nome(x.operatore),
							valore: x.vendite,
							testo: `${formatIntero(x.vendite)} vendite`,
							nota: formatEuro(Number(x.fatturato)),
							colore: PALETTE[i < o.ordine.length ? i : PALETTE.length - 1],
							prima: x.vendite_prec,
						}))}
					/>
				</div>
				<div className="scheda entra" style={{ '--ritardo': '180ms' } as React.CSSProperties}>
					<h3>Vendite per mese e venditore</h3>
					<p className="nota">I sei che vendono di più; gli altri sono raggruppati.</p>
					<Colonne punti={puntiMensile} gruppi={serie.map((g) => etichette[g])} formato="intero" unita="vendite" colori={coloriEtichette} />
				</div>
			</div>

			<div className="griglia meta">
				<div className="scheda entra" style={{ '--ritardo': '260ms' } as React.CSSProperties}>
					<h3>Operazioni di cassa</h3>
					<p className="nota">Incassi registrati da ciascun operatore, da inizio anno.</p>
					<Barre
						voci={o.cassa.map((x) => ({
							etichetta: nome(x.operatore),
							valore: x.operazioni,
							testo: `${formatIntero(x.operazioni)} operazioni`,
							nota: `${formatEuro(Number(x.importo))} incassati`,
							colore: '#1ba8e0',
						}))}
					/>
				</div>
				<div className="scheda entra" style={{ '--ritardo': '340ms' } as React.CSSProperties}>
					<h3>Azioni CRM</h3>
					<p className="nota">Appuntamenti e contatti registrati per operatore, da inizio anno. Molte sono automatiche.</p>
					<Barre
						voci={o.crm.map((x) => ({
							etichetta: nome(x.operatore),
							valore: x.azioni,
							testo: `${formatIntero(x.azioni)} azioni`,
							nota: `${formatIntero(x.evase)} evase (${x.azioni ? Math.round((x.evase / x.azioni) * 100) : 0}%)`,
							colore: '#7c5cff',
						}))}
					/>
				</div>
			</div>
			<p className="piede">
				L&apos;operatore è quello registrato nel gestionale su ciascuna vendita, incasso o azione. Numeri ricalcolati ogni mezz&apos;ora{calcolato_il ? `, l’ultima volta alle ${formatOrario(calcolato_il)}` : ''}.
			</p>
		</div>
	);
}

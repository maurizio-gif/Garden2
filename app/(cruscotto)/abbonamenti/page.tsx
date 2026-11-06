import { Barre } from '@/components/Barre';
import { Colonne } from '@/components/Colonne';
import { GruppiFiltro } from '@/components/GruppiFiltro';
import { Indicatore } from '@/components/Indicatore';
import { Numero } from '@/components/Numero';
import { Testata } from '@/components/Testata';
import { caricaSezione, type Abbonamenti } from '@/lib/cruscotto';
import { annoDi, formatIntero, formatOrario, meseBreve } from '@/lib/format';
import { coloreGruppo } from '@/lib/gruppi';
import { puntiMensili, ultimiMesi } from '@/lib/punti';

export const dynamic = 'force-dynamic';

const FASCE = ['Entro 7 giorni', '7-13 giorni', '14-20 giorni', '21-27 giorni', 'Oltre 27 giorni'];

export default async function PaginaAbbonamenti({ searchParams }: { searchParams: { gruppi?: string } }) {
	const { dati: a, gruppi, scelti, calcolato_il, sincronizzato_il } = await caricaSezione<Abbonamenti>('abbonamenti', searchParams.gruppi);
	const mesi = ultimiMesi(a.oggi);
	const annoPrima = String(Number(annoDi(a.oggi)) - 1);
	const k = a.kpi;
	const n = (mese: string, tipo: string) => a.mensile.find((x) => x.mese_da === mese && x.tipo === tipo)?.n ?? 0;
	const serie = (tipo: string) => mesi.map((m) => n(m, tipo));

	// Tasso di rinnovo: l'ultimo mese completo e' il penultimo (l'ultimo ha ancora 30 giorni per rinnovare).
	const tasso = a.tasso;
	const ultimoCompleto = tasso.at(-2);
	const stessoAnnoPrima = tasso.at(-14);
	const perc = (t?: { scadenze: number; rinnovati: number }) => (t && t.scadenze ? (t.rinnovati / t.scadenze) * 100 : 0);

	const puntiTasso = tasso.slice(-12).map((t, i, tutti) => ({
		chiave: t.mese_da,
		etichetta: meseBreve(t.mese_da),
		anno: i === 0 || t.mese_da.slice(5, 7) === '01' ? annoDi(t.mese_da) : undefined,
		titolo: `Scadenze di ${meseBreve(t.mese_da)} ${annoDi(t.mese_da)}${i === tutti.length - 1 ? ' · provvisorio' : ''}`,
		inCorso: i === tutti.length - 1,
		parti: [
			{ gruppo: 'Rinnovati', valore: t.rinnovati },
			{ gruppo: 'Non rinnovati', valore: Math.max(t.scadenze - t.rinnovati, 0) },
		],
	}));

	const sc = a.scadenze;
	const voceSett = sc.settimane.map((s) => ({
		etichetta: FASCE[s.settimana] ?? `Settimana ${s.settimana}`,
		valore: s.totale,
		testo: `${formatIntero(s.totale - s.rinnovati)} da rinnovare`,
		nota: `${formatIntero(s.rinnovati)} già rinnovati`,
		parti: [
			{ valore: s.rinnovati, colore: coloreGruppo('Rinnovati'), etichetta: 'Già rinnovati' },
			{ valore: s.totale - s.rinnovati, colore: coloreGruppo('Da rinnovare'), etichetta: 'Da rinnovare' },
		],
	}));

	return (
		<div className="contenitore">
			<Testata
				titolo="Abbonamenti"
				frase="Chi arriva, chi rinnova,"
				evidenza="chi sta per scadere."
				sotto={`Nuovi abbonamenti, rinnovi e scadenze, confrontati con lo stesso punto del ${annoPrima}. Le quote associative non contano.`}
				aggiornamento={sincronizzato_il ?? calcolato_il}
			/>
			<GruppiFiltro gruppi={gruppi} scelti={scelti} />

			<div className="griglia quattro">
				<Indicatore titolo="Nuovi abbonamenti" periodo="da inizio mese, a pari giorni" ora={k.nuovi_mese} prima={k.nuovi_mese_prec} annoPrima={annoPrima} formato="intero" serie={serie('Nuovi')} colore="#0f9d6b" ritardo={0} />
				<Indicatore titolo="Rinnovi" periodo="da inizio mese, a pari giorni" ora={k.rinnovi_mese} prima={k.rinnovi_mese_prec} annoPrima={annoPrima} formato="intero" serie={serie('Rinnovi')} colore="#1ba8e0" ritardo={70} />
				<Indicatore titolo="Ritorni" periodo="chi era fermo da oltre 30 giorni" ora={k.ritorni_mese} prima={k.ritorni_mese_prec} annoPrima={annoPrima} formato="intero" serie={serie('Ritorni')} colore="#f2a516" ritardo={140} />
				<Indicatore
					titolo="Tasso di rinnovo"
					periodo={ultimoCompleto ? `scadenze di ${meseBreve(ultimoCompleto.mese_da)}, rinnovate entro 30 giorni` : 'ultimo mese completo'}
					ora={perc(ultimoCompleto)}
					prima={stessoAnnoPrima ? perc(stessoAnnoPrima) : undefined}
					annoPrima={stessoAnnoPrima ? `${meseBreve(stessoAnnoPrima.mese_da)} ${annoPrima}` : undefined}
					formato="percento"
					serie={tasso.slice(-12).map(perc)}
					colore="#7c5cff"
					ritardo={210}
				/>
			</div>

			<div className="griglia principale">
				<div className="scheda entra" style={{ '--ritardo': '300ms' } as React.CSSProperties}>
					<h3>In scadenza nei prossimi 30 giorni</h3>
					<div className="grande enorme">
						<Numero valore={sc.totale} />
					</div>
					<p className="piccolo">
						{formatIntero(sc.gia_rinnovati)} già rinnovati, <b>{formatIntero(sc.totale - sc.gia_rinnovati)}</b> da rinnovare.
					</p>
					<div style={{ marginTop: 18 }}>
						<Barre voci={voceSett} />
					</div>
				</div>
				<div className="scheda entra" style={{ '--ritardo': '380ms' } as React.CSSProperties}>
					<h3>Nuovi, rinnovi e ritorni per mese</h3>
					<p className="nota">Per data di vendita. Rinnovo: la persona aveva lo stesso tipo di abbonamento finito da meno di 30 giorni.</p>
					<Colonne
						punti={puntiMensili(mesi, ['Nuovi', 'Rinnovi', 'Ritorni'], (m, g) => n(m, g))}
						gruppi={['Nuovi', 'Rinnovi', 'Ritorni']}
						formato="intero"
					/>
				</div>
			</div>

			<div className="griglia secondaria">
				<div className="scheda entra" style={{ '--ritardo': '460ms' } as React.CSSProperties}>
					<h3>Tasso di rinnovo per mese di scadenza</h3>
					<p className="nota">Rinnovato = nuovo abbonamento dello stesso tipo entro 30 giorni dalla fine. L&apos;ultimo mese è provvisorio.</p>
					<Colonne punti={puntiTasso} gruppi={['Rinnovati', 'Non rinnovati']} formato="intero" unita="scadenze" />
				</div>
				<div className="scheda entra" style={{ '--ritardo': '540ms' } as React.CSSProperties}>
					<h3>Scaduti da poco e non tornati</h3>
					<p className="nota">Scaduti negli ultimi 30 giorni, senza un nuovo abbonamento: da richiamare.</p>
					<Barre
						voci={sc.da_recuperare.map((g) => ({ etichetta: g.gruppo, valore: g.n, testo: formatIntero(g.n), colore: coloreGruppo(g.gruppo) }))}
					/>
					<h3 style={{ marginTop: 22 }}>In scadenza per gruppo</h3>
					<div style={{ marginTop: 12 }}>
						<Barre
							voci={sc.gruppi.map((g) => ({
								etichetta: g.gruppo,
								valore: g.totale,
								testo: `${formatIntero(g.totale - g.rinnovati)} da rinnovare`,
								nota: `su ${formatIntero(g.totale)} in scadenza`,
								colore: coloreGruppo(g.gruppo),
							}))}
						/>
					</div>
				</div>
			</div>
			<p className="piede">
				Numeri ricalcolati ogni mezz&apos;ora{calcolato_il ? `, l’ultima volta alle ${formatOrario(calcolato_il)}` : ''}. Chi aveva un abbonamento prima del 2016 può risultare «nuovo» nei primi mesi di storico.
			</p>
		</div>
	);
}

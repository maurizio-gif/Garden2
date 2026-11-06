import { Barre } from '@/components/Barre';
import { Colonne } from '@/components/Colonne';
import { GruppiFiltro } from '@/components/GruppiFiltro';
import { Indicatore } from '@/components/Indicatore';
import { Testata } from '@/components/Testata';
import { caricaSezione, type Vendite } from '@/lib/cruscotto';
import { annoDi, formatEuro, formatIntero, formatOrario } from '@/lib/format';
import { coloreGruppo } from '@/lib/gruppi';
import { puntiMensili, ultimiMesi } from '@/lib/punti';

export const dynamic = 'force-dynamic';

export default async function PaginaVendite({ searchParams }: { searchParams: { gruppi?: string } }) {
	const { dati: v, gruppi, scelti, calcolato_il, sincronizzato_il } = await caricaSezione<Vendite>('vendite', searchParams.gruppi);
	const mesi = ultimiMesi(v.oggi);
	const annoPrima = String(Number(annoDi(v.oggi)) - 1);
	const k = v.kpi;
	const medio = (fatt: number, n: number) => (n ? fatt / n : 0);
	const quota = (a: number, b: number) => (b ? (a / b) * 100 : 0);

	return (
		<div className="contenitore">
			<Testata
				titolo="Vendite"
				frase="Cosa si vende,"
				evidenza="a che prezzo."
				sotto={`Prodotti, gruppi, sconti e sospensioni dall'inizio dell'anno, confrontati con lo stesso punto del ${annoPrima}.`}
				aggiornamento={sincronizzato_il ?? calcolato_il}
			/>
			<GruppiFiltro gruppi={gruppi} scelti={scelti} />

			<div className="griglia quattro">
				<Indicatore titolo="Valore medio di una vendita" periodo="da inizio anno" ora={medio(k.fatturato_anno, k.vendite_anno)} prima={medio(k.fatturato_anno_prec, k.vendite_anno_prec)} annoPrima={annoPrima} formato="euro" colore="#0f9d6b" ritardo={0} />
				<Indicatore titolo="Vendite scontate" periodo="quota delle vendite non-corso, da inizio anno" ora={quota(k.scontate_anno, k.vendite_sc_anno)} prima={quota(k.scontate_anno_prec, k.vendite_sc_anno_prec)} annoPrima={annoPrima} formato="percento" colore="#1ba8e0" inverso ritardo={70} />
				<Indicatore titolo="Sconti concessi" periodo="sconti applicati, da inizio anno" ora={k.sconto_anno} prima={k.sconto_anno_prec} annoPrima={annoPrima} formato="euro" colore="#f2a516" inverso ritardo={140} />
				<Indicatore titolo="Sospensioni" periodo="da inizio anno, a pari giorni" ora={k.sospensioni_anno} prima={k.sospensioni_anno_prec} annoPrima={annoPrima} formato="intero" colore="#7c5cff" inverso serie={v.sospensioni_mensili.map((s) => s.n)} ritardo={210} />
			</div>

			<div className="griglia meta">
				<div className="scheda entra" style={{ '--ritardo': '300ms' } as React.CSSProperties}>
					<h3>I prodotti che fatturano di più</h3>
					<p className="nota">Da inizio anno, con la variazione sullo stesso periodo del {annoPrima}.</p>
					<Barre
						voci={v.prodotti.map((p) => ({
							etichetta: p.abbonamento,
							valore: Number(p.fatturato),
							testo: formatEuro(Number(p.fatturato)),
							nota: `${p.gruppo} · ${formatIntero(p.vendite)} vendite`,
							colore: coloreGruppo(p.gruppo),
							prima: Number(p.fatturato_prec),
						}))}
					/>
				</div>
				<div className="scheda entra" style={{ '--ritardo': '380ms' } as React.CSSProperties}>
					<h3>Fatturato per gruppo</h3>
					<p className="nota">Da inizio anno, con la variazione sullo stesso periodo del {annoPrima}.</p>
					<Barre
						voci={v.gruppi.map((g) => ({
							etichetta: g.gruppo,
							valore: Number(g.fatturato),
							testo: formatEuro(Number(g.fatturato)),
							nota: `${formatIntero(g.vendite)} vendite`,
							colore: coloreGruppo(g.gruppo),
							prima: Number(g.fatturato_prec),
						}))}
					/>
				</div>
			</div>

			<div className="scheda entra" style={{ '--ritardo': '460ms' } as React.CSSProperties}>
				<h3>Sospensioni per mese</h3>
				<p className="nota">Abbonamenti messi in pausa (malattia, infortunio, vacanze…), per mese di inizio.</p>
				<Colonne punti={puntiMensili(mesi, ['Sospensioni'], (m) => v.sospensioni_mensili.find((s) => s.mese_da === m)?.n ?? 0)} gruppi={['Sospensioni']} formato="intero" />
			</div>
			<p className="piede">
				Fatturato per data di vendita, dal 2016. Uno sconto è uno sconto applicato in vendita, calcolato sul prezzo di listino; i corsi sono esclusi perché il loro listino è il prezzo dell’intero corso e non della singola lezione. Le disdette non compaiono: nel gestionale di Garden non vengono registrate, mentre le sospensioni sì. Numeri ricalcolati ogni mezz&apos;ora{calcolato_il ? `, l’ultima volta alle ${formatOrario(calcolato_il)}` : ''}.
			</p>
		</div>
	);
}

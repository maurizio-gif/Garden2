import { colonneTempo } from "./analisi";
import { isTempoIncassi, type RaggruppaIncassi } from "./incassi";
import type {
	AnalisiIncassi,
	Direzionale,
	ElencoMovimenti,
	ElencoScadenze,
	OpzioniIncassi,
	Scadenze,
} from "./types";

/**
 * Dati di prova per direzionale, scadenze e incassi, quando Supabase non è
 * collegato. Ordini di grandezza di Garden, numeri inventati.
 */

const GRUPPI = ["Nuoto", "Fitness e wellness", "Corsi", "Personal training", "Junior e camp"];
const PESO = [0.47, 0.34, 0.1, 0.06, 0.03];
const STAGIONE = [0.95, 0.8, 0.85, 0.8, 0.85, 1.15, 0.9, 0.7, 1.45, 1.1, 0.75, 0.9];

const isoMese = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
const onda = (i: number, s = 1) => 1 + 0.06 * Math.sin(i * 1.7 * s);

export function direzionaleDemo(adesso: Date): Direzionale {
	const oggi = adesso.toISOString().slice(0, 10);
	const y = adesso.getUTCFullYear();
	const m = adesso.getUTCMonth();
	const mesi = Array.from({ length: 36 }, (_, i) => {
		const d = new Date(Date.UTC(y, m - 35 + i, 1));
		const crescita = 1 + i * 0.006;
		const s = STAGIONE[d.getUTCMonth()];
		const ultimo = i === 35 ? adesso.getUTCDate() / 30 : 1;
		const venduto = Math.round(260_000 * s * crescita * onda(i) * ultimo);
		return {
			mese: d.toISOString().slice(0, 10),
			incassato: Math.round(290_000 * s * crescita * onda(i, 0.7) * ultimo),
			incassato_abbonamenti: Math.round(270_000 * s * crescita * onda(i, 0.7) * ultimo),
			vendite: Math.round(1200 * s * crescita * ultimo),
			venduto,
			vendite_rinnovi: Math.round(520 * s * crescita * ultimo),
			venduto_rinnovi: Math.round(venduto * 0.42),
			iscritti: Math.round(5000 * crescita * (0.96 + 0.05 * Math.sin((d.getUTCMonth() - 2) / 1.9))),
		};
	});
	const tot = { valore: 2_690_000, residuo: 1_630_000, mensile: 262_000, persone: 5600, prodotti: 8800 };
	return {
		oggi,
		aggiornato_al: new Date(adesso.getTime() - 20 * 60_000).toISOString(),
		mesi,
		iscritti: [
			{ quando: "oggi", giorno: oggi, persone: 5618 },
			{ quando: "mese_fa", giorno: oggi, persone: 5417 },
			{ quando: "anno_fa", giorno: oggi, persone: 5294 },
		],
		valorizzazione: [
			{ gruppo: null, ...tot },
			...GRUPPI.map((g, i) => ({
				gruppo: g,
				valore: Math.round(tot.valore * PESO[i]),
				residuo: Math.round(tot.residuo * PESO[i]),
				mensile: Math.round(tot.mensile * PESO[i]),
				persone: Math.round(tot.persone * PESO[i] * 1.3),
				prodotti: Math.round(tot.prodotti * PESO[i]),
			})),
		],
		periodi: [
			{ periodo: "mtd", anni_fa: 0, da: oggi, a: oggi, vendite: 518, venduto: 125_239, incassato: 184_244 },
			{ periodo: "mtd", anni_fa: 1, da: oggi, a: oggi, vendite: 411, venduto: 100_290, incassato: 173_166 },
			{ periodo: "ytd", anni_fa: 0, da: oggi, a: oggi, vendite: 14_527, venduto: 3_093_975, incassato: 3_302_257 },
			{ periodo: "ytd", anni_fa: 1, da: oggi, a: oggi, vendite: 13_219, venduto: 2_928_435, incassato: 3_229_357 },
		],
	};
}

export function scadenzeDemo(adesso: Date): Scadenze {
	const y = adesso.getUTCFullYear();
	const m = adesso.getUTCMonth();
	const mesi = Array.from({ length: 39 }, (_, i) => {
		const mese = isoMese(y, m - 35 + i);
		const s = STAGIONE[new Date(`${mese}T00:00:00Z`).getUTCMonth()];
		const futuro = i >= 35;
		return GRUPPI.map((gruppo, k) => {
			const scadenze = Math.round(1100 * s * s * PESO[k] * onda(i + k));
			const tasso = futuro ? 0.08 + (38 - i) * 0.05 : 0.36 + 0.08 * Math.sin(i + k);
			const rinnovati = Math.round(scadenze * Math.min(tasso, 0.6));
			const valore = Math.round(scadenze * (180 + k * 40));
			return {
				mese,
				gruppo,
				scadenze,
				rinnovati,
				valore,
				valore_rinnovati: Math.round((valore * rinnovati) / Math.max(scadenze, 1)),
				valore_rinnovi: Math.round((valore * rinnovati * 1.04) / Math.max(scadenze, 1)),
			};
		});
	}).flat();
	return { oggi: adesso.toISOString().slice(0, 10), aggiornato_al: new Date(adesso.getTime() - 20 * 60_000).toISOString(), mesi };
}

const NOMI = [
	["Giulia", "Bianchi", "Fitness open annuale", "Fitness e wellness", 690],
	["Marco", "Ferri", "Nuoto libero 3 mesi", "Nuoto", 210],
	["Sara", "Conti", "Corso pilates trimestrale", "Corsi", 180],
	["Luca", "Moretti", "Personal 10 sedute", "Personal training", 450],
	["Elena", "Galli", "Family nuoto 6 mesi", "Nuoto", 390],
	["Paolo", "Riva", "Fitness mensile", "Fitness e wellness", 79],
] as const;

export function elencoScadenzeDemo(adesso: Date): ElencoScadenze {
	const righe = Array.from({ length: 24 }, (_, i) => {
		const [nome, cognome, abbonamento, gruppo, totale] = NOMI[i % NOMI.length];
		const fine = new Date(adesso.getTime() + (i - 8) * 86_400_000).toISOString().slice(0, 10);
		const rinnovato = i % 3 === 0;
		return {
			abbonamento,
			data_inizio: new Date(adesso.getTime() - (200 - i) * 86_400_000).toISOString().slice(0, 10),
			data_fine: fine,
			totale,
			venditore: i % 2 ? "Reception" : "Ufficio commerciale",
			gruppo,
			nome,
			cognome,
			cellulare: "333 000 0000",
			email: null,
			rinnovo_abbonamento: rinnovato ? abbonamento : null,
			rinnovo_inizio: rinnovato ? fine : null,
			rinnovo_fine: rinnovato ? new Date(adesso.getTime() + (i + 90) * 86_400_000).toISOString().slice(0, 10) : null,
			rinnovo_totale: rinnovato ? totale : null,
		};
	});
	return {
		totale: righe.length,
		rinnovati: righe.filter((r) => r.rinnovo_inizio).length,
		valore: righe.reduce((s, r) => s + r.totale, 0),
		valore_da_rinnovare: righe.filter((r) => !r.rinnovo_inizio).reduce((s, r) => s + r.totale, 0),
		righe,
	};
}

const TIPOLOGIE = ["Nuoto", "Fitness e wellness", "Corsi", "Ingressi e vendite singole", "Personal training", "Tesseramenti"];
const METODI = ["Carta di credito", "Bancomat", "RID (addebito)", "Contanti", "Bonifico"];

export function opzioniIncassiDemo(): OpzioniIncassi {
	return { tipologie: TIPOLOGIE, metodi: METODI, operatori: ["Reception", "Amministrazione", "Online"], gruppi: GRUPPI };
}

export function analisiIncassiDemo(raggruppa: RaggruppaIncassi, da: string, a: string, salt: string): AnalisiIncassi {
	const f = salt === "p" ? 0.93 : 1;
	let chiavi: string[];
	if (isTempoIncassi(raggruppa)) chiavi = colonneTempo(raggruppa, da, a);
	else if (raggruppa === "tipologia" || raggruppa === "gruppo") chiavi = TIPOLOGIE;
	else if (raggruppa === "metodo") chiavi = METODI;
	else if (raggruppa === "operatore") chiavi = ["Reception", "Amministrazione", "Online"];
	else chiavi = ["totale"];
	const base = raggruppa === "giorno" ? 9000 : raggruppa === "settimana" ? 65_000 : raggruppa === "anno" ? 3_400_000 : 290_000;
	const righe = chiavi.map((chiave, i) => {
		const importo = Math.round(base * f * onda(i) * (isTempoIncassi(raggruppa) ? 1 : 1 / (i + 1.4)));
		return { chiave, importo, movimenti: Math.round(importo / 95), persone: Math.round(importo / 140) };
	});
	const importo = righe.reduce((s, r) => s + r.importo, 0);
	return {
		totali: {
			importo,
			entrate: Math.round(importo * 1.02),
			uscite: -Math.round(importo * 0.02),
			movimenti: Math.round(importo / 95),
			persone: Math.round(importo / 160),
		},
		righe,
		troncato: false,
	};
}

export function elencoMovimentiDemo(adesso: Date): ElencoMovimenti {
	const righe = Array.from({ length: 30 }, (_, i) => {
		const [nome, cognome, abbonamento, gruppo, totale] = NOMI[i % NOMI.length];
		return {
			quando: new Date(adesso.getTime() - i * 5_400_000).toISOString(),
			importo: i % 11 === 10 ? -totale : totale,
			tipologia: gruppo,
			metodo: METODI[i % METODI.length],
			operatore: i % 2 ? "Reception" : "Online",
			gruppo,
			descrizione: "Pagamento abbonamento",
			causale: null,
			nome,
			cognome,
			abbonamento,
		};
	});
	return { totale: 30, righe };
}

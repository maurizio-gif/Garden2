import { colonneTempo } from "./analisi";
import { isTempoIncassi, type RaggruppaIncassi } from "./incassi";
import type {
	AccessiMensile,
	AnalisiIncassi,
	DashboardAccessi,
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

export function accessiDashboardDemo(da: string, a: string, fattore = 1): DashboardAccessi {
	const giorni = Math.max(1, Math.round((Date.parse(a) - Date.parse(da)) / 86_400_000) + 1);
	const pesoDow = [1.15, 1.1, 1.12, 1.05, 0.95, 0.62, 0.45];
	const presenzeGiorno = 1050 * fattore;
	const presenze = Math.round(presenzeGiorno * giorni * 0.92);
	const persone = Math.round(Math.min(5200, 1400 + giorni * 40) * fattore);
	const settimane = Math.round(presenze / 2.1);
	return {
		da,
		a,
		ultimo_accesso: new Date().toISOString(),
		aggiornato_al: new Date().toISOString(),
		totali: { ingressi: Math.round(presenze * 1.07), presenze, persone, settimane_persona: settimane, rifiutati: Math.round(presenze * 0.06), giorni, giorni_aperti: giorni },
		giorni_settimana: pesoDow.map((p, i) => ({ dow: i + 1, giorni: Math.ceil(giorni / 7), presenze: Math.round(presenzeGiorno * p * Math.ceil(giorni / 7)) })),
		ore: Array.from({ length: 7 }, (_, d) =>
			Array.from({ length: 17 }, (_, h) => {
				const ora = h + 6;
				const picco = Math.exp(-((ora - 18) ** 2) / 6) + 0.7 * Math.exp(-((ora - 9) ** 2) / 4) + 0.3;
				return { dow: d + 1, ora, presenze: Math.round(picco * 90 * pesoDow[d] * Math.ceil(giorni / 7) * fattore) };
			}),
		).flat(),
		giorni: [],
		varchi: [
			{ varco: "Ingresso Maschi", ingressi: Math.round(presenze * 0.58), rifiutati: Math.round(presenze * 0.03) },
			{ varco: "Ingresso Femmine", ingressi: Math.round(presenze * 0.23), rifiutati: Math.round(presenze * 0.015) },
			{ varco: "Ingresso Steven", ingressi: Math.round(presenze * 0.2), rifiutati: Math.round(presenze * 0.012) },
			{ varco: "Calcetto", ingressi: Math.round(presenze * 0.013), rifiutati: 0 },
		],
		rifiuti: [
			{ motivo: "Blocco casella messaggi", n: Math.round(presenze * 0.02) },
			{ motivo: "Certificato medico non valido", n: Math.round(presenze * 0.012) },
			{ motivo: "Nessun servizio abilitato", n: Math.round(presenze * 0.008) },
			{ motivo: "Iscrizione scaduta", n: Math.round(presenze * 0.007) },
			{ motivo: "Pagamento scaduto", n: Math.round(presenze * 0.007) },
		],
		abbonamenti: [
			["Fitness open annuale", "Fitness e wellness", 0.31, 0.12],
			["Nuoto libero 12 mesi", "Nuoto", 0.18, 0.08],
			["Family nuoto", "Nuoto", 0.12, 0.09],
			["Corso nuoto adulti", "Corsi", 0.08, 0.06],
			["Personal 10 sedute", "Personal training", 0.03, 0.02],
		].map(([abbonamento, gruppo, quota, pers]) => ({
			abbonamento: abbonamento as string,
			gruppo: gruppo as string,
			presenze: Math.round(presenze * (quota as number)),
			persone: Math.round(persone * (pers as number) * 3),
			settimane_persona: Math.round(settimane * (quota as number)),
		})),
		gruppi: GRUPPI.map((gruppo, i) => ({
			gruppo,
			presenze: Math.round(presenze * PESO[i]),
			persone: Math.round(persone * PESO[i] * 1.2),
			settimane_persona: Math.round(settimane * PESO[i]),
		})),
		utenti: NOMI.map(([nome, cognome], i) => ({
			nome,
			cognome,
			presenze: Math.round(Math.min(giorni, 90) * (0.9 - i * 0.05)),
			settimane: Math.ceil(Math.min(giorni, 90) / 7),
			ingressi: Math.round(Math.min(giorni, 90) * (1.1 - i * 0.05)),
		})),
	};
}

export function accessiMensileDemo(adesso: Date): AccessiMensile {
	const y = adesso.getUTCFullYear();
	const mesi: AccessiMensile["mesi"] = [];
	for (let k = 0; k < 36 + adesso.getUTCMonth() + 1; k++) {
		const d = new Date(Date.UTC(y - 3, k, 1));
		if (d > adesso) break;
		const s = [1.1, 1.05, 1, 0.95, 0.9, 0.7, 0.55, 0.35, 1, 1.12, 1.1, 0.85][d.getUTCMonth()];
		const presenze = Math.round(26_000 * s * (1 + k * 0.004));
		mesi.push({ mese: d.toISOString().slice(0, 10), presenze, ingressi: Math.round(presenze * 1.07), persone: Math.round(3800 * s), settimane_persona: Math.round(presenze / (2 + 0.2 * Math.sin(k))) });
	}
	return { mesi };
}

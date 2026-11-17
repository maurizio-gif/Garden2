import { colonneTempo } from "./analisi";
import { isTempoIncassi, type RaggruppaIncassi } from "./incassi";
import type {
	AccessiMensile,
	AnalisiIncassi,
	Certificati,
	Debitori,
	DashboardAccessi,
	ElencoContatti,
	SchedaPersona,
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

const ID_DEMO = "00000000-0000-4000-8000-0000000000";

export function contattiDemo(): ElencoContatti {
	const stati = ["attivo", "attivo", "in_scadenza", "scaduto", "ex", "attivo"] as const;
	const righe = NOMI.map(([nome, cognome, abbonamento, gruppo], i) => ({
		id: `${ID_DEMO}${String(i + 10).padStart(2, "0")}`,
		nome,
		cognome,
		cellulare: "333 000 0000",
		email: null,
		eta: 28 + i * 5,
		stato: stati[i],
		abbonamento,
		gruppo,
		cliente_dal: "2021-09-01",
		ultima_fine: "2027-06-30",
		prodotti: 3 + i,
		rate_scadute: i === 3,
		ultimo_accesso: "2026-11-14",
	}));
	return { totale: righe.length, per_stato: { attivo: 3, in_scadenza: 1, scaduto: 1, ex: 1, mai: 12 }, righe };
}

export function personaDemo(id: string): SchedaPersona {
	const oggi = new Date().toISOString().slice(0, 10);
	return {
		oggi,
		persona: {
			id,
			nome: "Giulia",
			cognome: "Bianchi",
			email: "giulia@example.com",
			cellulare: "333 000 0000",
			telefono_1: null,
			telefono_2: null,
			codice_fiscale: null,
			data_nascita: "1990-04-12",
			sesso: "F",
			luogo_nascita: "Milano",
			indirizzo: "Via dei Prati 1",
			cap: "20100",
			citta: "Milano",
			provincia: "MI",
			note: null,
			creato_il: "2021-09-01T10:00:00Z",
			source_utente_id: 1,
			conflitto_con: null,
		},
		riepilogo: { venduto: 2380, incassato: 2210, da_pagare_scaduto: 70, da_pagare_futuro: 140, presenze: 412, presenze_12m: 118, settimane_12m: 49, prima_presenza: "2021-09-02", ultima_presenza: oggi },
		abbonamenti: [
			{ source_iscrizione_id: 3, abbonamento: "Fitness open annuale", gruppo: "Fitness e wellness", categoria: "FITNESS", quota: false, venduto_il: "2026-08-28T10:00:00Z", inizio: "2026-09-01", fine: "2027-08-31", totale: 690, listino: 720, venditore: "Ufficio commerciale", disdetta: null, motivo_disdetta: null, giorni_sospensione: 0, rinnovo_automatico: false, note: null },
			{ source_iscrizione_id: 2, abbonamento: "Fitness open annuale", gruppo: "Fitness e wellness", categoria: "FITNESS", quota: false, venduto_il: "2025-08-30T10:00:00Z", inizio: "2025-09-01", fine: "2026-08-31", totale: 650, listino: 690, venditore: "Reception", disdetta: null, motivo_disdetta: null, giorni_sospensione: 14, rinnovo_automatico: false, note: null },
			{ source_iscrizione_id: 1, abbonamento: "Quota associativa", gruppo: "Quote e tessere", categoria: "QUOTA ASSOCIATIVA", quota: true, venduto_il: "2025-08-30T10:00:00Z", inizio: "2025-09-01", fine: "2026-08-31", totale: 39, listino: 39, venditore: "Reception", disdetta: null, motivo_disdetta: null, giorni_sospensione: 0, rinnovo_automatico: false, note: null },
		],
		rate: [
			{ scadenza: "2026-12-01", importo: 70, pagata_il: null, metodo: "RID", abbonamento: "Fitness open annuale", errore: null },
			{ scadenza: "2026-11-01", importo: 70, pagata_il: null, metodo: "RID", abbonamento: "Fitness open annuale", errore: "Insoluto" },
			{ scadenza: "2026-10-01", importo: 70, pagata_il: "2026-10-01T08:00:00Z", metodo: "RID", abbonamento: "Fitness open annuale", errore: null },
		],
		sospensioni: [{ inizio: "2026-02-01", fine: "2026-02-14", giorni: 14, causale: "Infortunio", abbonamento: "Fitness open annuale" }],
		pagamenti: [
			{ quando: "2026-10-01T08:00:00Z", importo: 70, metodo: "RID", descrizione: "Pagamento rata", causale: null, operatore: "Online", tipo: "A" },
			{ quando: "2026-08-28T10:00:00Z", importo: 200, metodo: "Bancomat", descrizione: "Acconto abbonamento", causale: null, operatore: "Reception", tipo: "A" },
		],
		pagamenti_totale: 2,
		presenze_mesi: Array.from({ length: 24 }, (_, i) => {
			const d = new Date();
			d.setUTCDate(1);
			d.setUTCMonth(d.getUTCMonth() - 23 + i);
			return { mese: d.toISOString().slice(0, 10), presenze: 6 + ((i * 7) % 9) };
		}),
		presenze_dow: [1, 2, 3, 4, 5, 6, 7].map((dow) => ({ dow, presenze: dow < 6 ? 20 - dow : 4 })),
		accessi: Array.from({ length: 8 }, (_, i) => ({ quando: new Date(Date.now() - i * 2 * 86_400_000).toISOString(), varco: "Ingresso Femmine", esito: "Abbonamento", tipo: 3 })),
		certificati: [{ descrizione: "Certificato non agonistico", emesso: "2026-01-10", scadenza: "2027-01-10" }],
		quote: [{ inizio: "2025-09-01", fine: "2026-08-31", importo: 39 }],
		prenotazioni: [],
		prenotazioni_totale: 0,
		corsi: [],
		omaggi: [],
		pratiche: [{ creata: "2026-08-20T10:00:00Z", descrizione: "Rinnovo", stato: "Chiusa vinta", cambio_stato: "2026-08-28T10:00:00Z", chiusa: "2026-08-28T10:00:00Z", valore: 690 }],
		memo: [],
		email: [],
	};
}

export function certificatiDemo(): Certificati {
	const oggi = new Date().toISOString().slice(0, 10);
	const fasce = { mai: 689, scaduto_oltre: 100, scaduto_365: 91, scaduto_180: 68, scaduto_90: 184, scaduto_30: 381, in_scadenza: 541, valido: 3553 } as const;
	return {
		oggi,
		aggiornato_al: new Date().toISOString(),
		attivi: Object.values(fasce).reduce((a, b) => a + b, 0),
		senza_data_nascita: 39,
		fasce,
		gruppi: GRUPPI.flatMap((gruppo, i) =>
			(Object.entries(fasce) as [keyof typeof fasce, number][]).map(([fascia, n]) => ({ gruppo, fascia, n: Math.round(n * PESO[i]) })),
		),
		tipi: [
			{ tipo: "Certificato medico annuale", n: 3824 },
			{ tipo: "Nessuno", n: 689 },
			{ tipo: "Autocertificazione", n: 449 },
		],
		totale: NOMI.length,
		righe: NOMI.map(([nome, cognome, abbonamento, gruppo], i) => ({
			persona_id: `00000000-0000-4000-8000-0000000000${String(i + 10).padStart(2, "0")}`,
			nome,
			cognome,
			cellulare: "333 000 0000",
			email: null,
			eta: 20 + i * 7,
			abbonamento,
			gruppo,
			fine_abbonamento: "2027-06-30",
			scadenza: i === 0 ? null : new Date(Date.now() + (i * 20 - 50) * 86_400_000).toISOString().slice(0, 10),
			tipo: i === 0 ? null : "Certificato medico annuale",
			giorni_scaduto: i === 0 ? null : 50 - i * 20,
			fascia: (["mai", "scaduto_90", "scaduto_30", "in_scadenza", "in_scadenza", "valido"] as const)[i],
			respinti_30g: i === 1 ? 3 : 0,
			ultimo_accesso: oggi,
		})),
	};
}

export function debitoriDemo(): Debitori {
	const oggi = new Date().toISOString().slice(0, 10);
	return {
		oggi,
		aggiornato_al: new Date().toISOString(),
		fasce: {
			g30: { rate: 236, importo: 44_556, persone: 198 },
			g90: { rate: 156, importo: 23_219, persone: 123 },
			g180: { rate: 70, importo: 8_609, persone: 55 },
			g365: { rate: 118, importo: 11_452, persone: 96 },
			oltre: { rate: 3127, importo: 388_241, persone: 1564 },
			in_scadenza: { rate: 672, importo: 139_159, persone: 620 },
		},
		fasce_persone: {
			g30: { persone: 187, importo: 42_353, iscritti: 184 },
			g90: { persone: 116, importo: 23_576, iscritti: 80 },
			g180: { persone: 54, importo: 9_788, iscritti: 24 },
			g365: { persone: 93, importo: 10_852, iscritti: 23 },
			oltre: { persone: 1564, importo: 389_469, iscritti: 4 },
		},
		totale_scaduto: 476_077,
		debitori: 2014,
		debitori_iscritti: 315,
		scaduto_iscritti: 70_000,
		per_gruppo: GRUPPI.map((gruppo, i) => ({ gruppo, importo: Math.round(476_077 * PESO[i]), rate: Math.round(3700 * PESO[i]) })),
		per_metodo: [
			{ metodo: "RID", importo: 300_000, rate: 2400 },
			{ metodo: "Non indicato", importo: 120_000, rate: 900 },
			{ metodo: "Carta di credito", importo: 56_077, rate: 400 },
		],
		totale: NOMI.length,
		totale_importo: 2_400,
		righe: NOMI.map(([nome, cognome, abbonamento, gruppo, totale], i) => ({
			persona_id: `00000000-0000-4000-8000-0000000000${String(i + 10).padStart(2, "0")}`,
			nome,
			cognome,
			cellulare: "333 000 0000",
			email: null,
			scaduto: totale,
			rate_scadute: 1 + (i % 3),
			piu_vecchia: new Date(Date.now() - (20 + i * 40) * 86_400_000).toISOString().slice(0, 10),
			giorni: 20 + i * 40,
			fascia: (["g30", "g90", "g90", "g180", "g365", "oltre"] as const)[i],
			da_scadere: i % 2 ? 70 : 0,
			metodo: "RID",
			errore: i === 0 ? "Insoluto" : null,
			abbonamento,
			gruppo,
			iscritto: i < 4,
			ultimo_accesso: oggi,
		})),
	};
}

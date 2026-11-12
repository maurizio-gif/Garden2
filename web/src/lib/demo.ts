import { colonneTempo, isTempo, type Raggruppa } from "./analisi";
import type {
	AbbonamentiRecenti,
	AccessiRecenti,
	Analisi,
	ConfrontoAnni,
	ElencoVendite,
	Home,
	Opzioni,
	Vendita,
} from "./types";

/**
 * Dati di prova per quando le variabili di Supabase non ci sono (anteprime,
 * sviluppo senza chiavi). I numeri hanno l'ordine di grandezza di Garden, ma
 * sono inventati: nomi e importi non vengono da persone reali.
 */

const NOMI = [
	["Giulia", "Bianchi"],
	["Marco", "Ferri"],
	["Sara", "Conti"],
	["Luca", "Moretti"],
	["Elena", "Galli"],
	["Paolo", "Riva"],
	["Chiara", "Fontana"],
	["Matteo", "Serra"],
	["Anna", "Longo"],
	["Davide", "Marini"],
] as const;

const PRODOTTI = [
	["Family nuoto 3 mesi", "FAMILY NUOTO", 289],
	["Corso nuoto adulti", "CORSI ABBONAMENTO", 168],
	["Steven pass annuale", "STEVEN PASS", 540],
	["Personal trainer 10 ingressi", "PERSONAL TRAINER", 350],
	["Garden + Steven mensile", "GARDEN+STEVEN", 79],
	["Nuoto assistito", "NUOTO ASSISTITO", 120],
] as const;

function giorniFa(adesso: Date, n: number, ore = 10) {
	const d = new Date(adesso);
	d.setUTCDate(d.getUTCDate() - n);
	d.setUTCHours(ore, (n * 17) % 60, 0, 0);
	return d.toISOString();
}

function vendite(adesso: Date, quante: number): (Vendita & { inizio: string; fine: string })[] {
	return Array.from({ length: quante }, (_, i) => {
		const [nome, cognome] = NOMI[i % NOMI.length];
		const [abbonamento, categoria, totale] = PRODOTTI[(i * 2 + 1) % PRODOTTI.length];
		const quando = giorniFa(adesso, Math.floor(i / 3), 18 - (i % 3) * 2);
		return {
			quando,
			nome,
			cognome,
			abbonamento,
			categoria,
			totale,
			inizio: quando.slice(0, 10),
			fine: giorniFa(adesso, -90 - i).slice(0, 10),
		};
	});
}

const INCASSI = [368, 276, 247, 354, 243, 247, 206, 232, 362, 318, 255, 488, 412]; // migliaia di euro

export function homeDemo(adesso: Date): Home {
	const oggi = adesso.toISOString().slice(0, 10);
	const inizioMese = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), 1));
	const mesi = Array.from({ length: 12 }, (_, i) => {
		const d = new Date(Date.UTC(inizioMese.getUTCFullYear(), inizioMese.getUTCMonth() - (11 - i), 1));
		const incassi = i === 11 ? 103_067 : INCASSI[i] * 1000 + ((i * 7919) % 900);
		return { mese: d.toISOString().slice(0, 10), incassi };
	});
	return {
		oggi,
		aggiornato_al: giorniFa(adesso, 0, 8),
		attivi: 5566,
		in_scadenza_30g: 412,
		rate_scadute_90g: { n: 412, importo: 72_722 },
		incassi_mese: { corrente: 103_067, precedente_stesso_periodo: 138_666 },
		incassi_mesi: mesi,
		categorie: [
			["FAMILY NUOTO", 1971],
			["CORSI ABBONAMENTO", 1183],
			["CORSI NUOTO PLANNING", 831],
			["STEVEN PASS", 636],
			["GARDEN+STEVEN", 567],
			["NUOTO ASSISTITO", 544],
			["EXTRA NUOTO", 436],
			["PERSONAL TRAINER", 339],
			["GARDEN CLUB", 301],
			["EVOLNESS", 150],
		].map(([categoria, persone]) => ({ categoria: categoria as string, persone: persone as number })),
		ultime_vendite: vendite(adesso, 6),
	};
}

export function abbonamentiDemo(adesso: Date): AbbonamentiRecenti {
	return { aggiornato_al: giorniFa(adesso, 0, 8), abbonamenti: vendite(adesso, 24) };
}

export function accessiDemo(adesso: Date): AccessiRecenti {
	const servizi = ["Nuoto libero", "Palestra", "Corso", "Spa"];
	return {
		ultimo_accesso: giorniFa(adesso, 0, 9),
		accessi: Array.from({ length: 30 }, (_, i) => {
			const [nome, cognome] = NOMI[(i * 3) % NOMI.length];
			return {
				quando: new Date(adesso.getTime() - i * 11 * 60_000).toISOString(),
				nome,
				cognome,
				servizio: servizi[i % servizi.length],
			};
		}),
	};
}

// ── Analisi e confronto (dati inventati, stessa forma delle funzioni SQL)

const GRUPPI = ["Fitness e wellness", "Nuoto", "Corsi", "Junior e camp", "Personal training"];

/** Numero stabile tra 0 e 1 a partire da un testo: i dati di prova non ballano a ogni ricarica. */
function seme(testo: string) {
	let h = 2166136261;
	for (const c of testo) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
	return ((h >>> 0) % 10_000) / 10_000;
}

export function opzioniDemo(): Opzioni {
	return {
		gruppi: [...GRUPPI].sort(),
		categorie: PRODOTTI.map(([, categoria], i) => ({ categoria, gruppo: GRUPPI[i % GRUPPI.length] })),
		operatori: ["MARTA ROSSI", "LUCA GROSSI", "ANNA SERRA"],
		prima_vendita: "2016-01-04",
	};
}

export function analisiDemo(raggruppa: Raggruppa, da: string, a: string, salt: string): Analisi {
	const chiavi = isTempo(raggruppa)
		? colonneTempo(raggruppa, da, a)
		: raggruppa === "niente"
			? ["totale"]
			: raggruppa === "gruppo"
				? GRUPPI
				: raggruppa === "operatore"
					? ["MARTA ROSSI", "LUCA GROSSI", "ANNA SERRA"]
					: raggruppa === "durata"
						? ["12 mesi", "6 mesi", "3 mesi", "1 mese", "Pacchetto 1"]
						: PRODOTTI.map(([nome, categoria]) => (raggruppa === "categoria" ? categoria : nome));
	const righe = chiavi.map((chiave) => {
		const vendite = Math.round(40 + seme(chiave + salt) * 260);
		return {
			chiave,
			vendite,
			persone: Math.round(vendite * (0.8 + seme(salt + chiave) * 0.15)),
			fatturato: Math.round(vendite * (120 + seme(chiave) * 200)),
		};
	});
	if (!isTempo(raggruppa)) righe.sort((x, y) => y.fatturato - x.fatturato);
	const somma = (k: "vendite" | "persone" | "fatturato") => righe.reduce((t, r) => t + r[k], 0);
	return {
		totali: { vendite: somma("vendite"), persone: Math.round(somma("persone") * 0.9), fatturato: somma("fatturato") },
		righe,
		troncato: false,
	};
}

export function elencoVenditeDemo(adesso: Date): ElencoVendite {
	const righe = vendite(adesso, 24).map((v, i) => ({
		vendita: v.quando.slice(0, 10),
		inizio: v.inizio,
		fine: v.fine,
		nome: v.nome,
		cognome: v.cognome,
		abbonamento: v.abbonamento,
		categoria: v.categoria,
		gruppo: GRUPPI[i % GRUPPI.length],
		durata: i % 2 ? "12 mesi" : "3 mesi",
		operatore: ["MARTA ROSSI", "LUCA GROSSI", "ANNA SERRA"][i % 3],
		totale: v.totale,
	}));
	return { totale: 1840, righe };
}

export function confrontoDemo(adesso: Date): ConfrontoAnni {
	const oggi = adesso.toISOString().slice(0, 10);
	const anno = adesso.getUTCFullYear();
	const resto = oggi.slice(4);
	const anni = Array.from({ length: 6 }, (_, k) => ({
		anni_fa: k,
		giorno: `${anno - k}${resto}`,
		inizio: `${anno - k}-01-01`,
	}));
	const crescita = [1, 0.96, 0.95, 0.9, 0.86, 0.7];
	const iscritti = anni.flatMap((an) => [
		{ anni_fa: an.anni_fa, giorno: an.giorno, gruppo: null, persone: Math.round(5600 * crescita[an.anni_fa]) },
		...GRUPPI.map((g, i) => ({
			anni_fa: an.anni_fa,
			giorno: an.giorno,
			gruppo: g,
			persone: Math.round((2400 / (i + 1)) * crescita[an.anni_fa] * (0.95 + seme(g + an.anni_fa) * 0.1)),
		})),
	]);
	const ytd = anni.flatMap((an) => [
		{
			anni_fa: an.anni_fa,
			gruppo: null,
			vendite: Math.round(14400 * crescita[an.anni_fa]),
			persone: Math.round(7200 * crescita[an.anni_fa]),
			fatturato: Math.round(3_060_000 * crescita[an.anni_fa]),
		},
		...GRUPPI.map((g, i) => ({
			anni_fa: an.anni_fa,
			gruppo: g,
			vendite: Math.round((6000 / (i + 1)) * crescita[an.anni_fa]),
			persone: Math.round((3000 / (i + 1)) * crescita[an.anni_fa]),
			fatturato: Math.round((1_200_000 / (i + 1)) * crescita[an.anni_fa]),
		})),
	]);
	const peso = [0.07, 0.06, 0.07, 0.05, 0.08, 0.17, 0.08, 0.06, 0.17, 0.09, 0.06, 0.04];
	const mensile = anni.flatMap((an) =>
		peso.flatMap((p, m) => {
			const a = anno - an.anni_fa;
			if (a === anno && m + 1 > Number(oggi.slice(5, 7))) return [];
			return [
				{
					anno: a,
					mese: m + 1,
					vendite: Math.round(15_000 * p * crescita[an.anni_fa]),
					fatturato: Math.round(3_300_000 * p * crescita[an.anni_fa]),
				},
			];
		}),
	);
	const movimento = Array.from({ length: 24 }, (_, i) => {
		const d = new Date(Date.UTC(anno, adesso.getUTCMonth() - (23 - i), 1));
		const s = seme(String(i));
		return {
			mese: d.toISOString().slice(0, 10),
			nuovi: Math.round(80 + s * 400),
			rientri: Math.round(100 + s * 350),
			usciti: Math.round(150 + (1 - s) * 700),
			attivi: Math.round(5000 + s * 600),
		};
	});
	return { oggi, aggiornato_al: giorniFa(adesso, 0, 8), iscritti, ytd, anni, mensile, movimento };
}

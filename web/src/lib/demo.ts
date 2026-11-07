import type { AbbonamentiRecenti, AccessiRecenti, Home, Vendita } from "./types";

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

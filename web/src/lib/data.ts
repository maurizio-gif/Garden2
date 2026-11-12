import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { connection } from "next/server";
import {
	filtriInQuery,
	filtriPerRpc,
	leggiFiltri,
	periodoConfronto,
	type Filtri,
} from "./analisi";
import {
	abbonamentiDemo,
	accessiDemo,
	analisiDemo,
	confrontoDemo,
	elencoVenditeDemo,
	finanzaDemo,
	homeDemo,
	opzioniDemo,
} from "./demo";
import type {
	AbbonamentiRecenti,
	AccessiRecenti,
	Analisi,
	ConfrontoAnni,
	ElencoVendite,
	Finanza,
	Home,
	Opzioni,
	Vista,
} from "./types";

/**
 * Lettura dei dati del pannello. Tre funzioni, una per pagina, che chiamano le
 * funzioni SQL di supabase/migrations/20261107120000_dashboard_rpc.sql.
 *
 * Due modi:
 *   · reale: ci sono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY;
 *   · demo:  mancano, e si mostrano dati inventati (con un'etichetta ben visibile).
 *
 * La chiave service_role vive solo qui, sul server: questo file è `server-only`
 * e non c'è nessuna variabile NEXT_PUBLIC_*. Dato che la service_role salta le
 * regole RLS, in produzione i dati veri si servono SOLO se il pannello è
 * protetto da DASHBOARD_PASSWORD (la controlla src/proxy.ts).
 */

export type Letto<T> = {
	dati: T;
	modo: "reale" | "demo";
	/** Millisecondi (Date.now) al momento della richiesta: servono per «3 giorni fa». */
	adesso: number;
};

function configurazione() {
	const url = process.env.SUPABASE_URL;
	const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !chiave) return null;

	if (process.env.NODE_ENV === "production" && !process.env.DASHBOARD_PASSWORD) {
		throw new Error(
			"DASHBOARD_PASSWORD non è impostata: in produzione il pannello non mostra dati veri senza password.",
		);
	}
	return { url, chiave };
}

function client(url: string, chiave: string) {
	return createClient(url, chiave, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
}

async function rpc<T>(nome: string, args?: Record<string, unknown>): Promise<T> {
	const cfg = configurazione();
	if (!cfg) throw new Error("rpc senza configurazione");
	const { data, error } = await client(cfg.url, cfg.chiave).rpc(nome, args);
	if (error) {
		throw new Error(
			`Supabase ha risposto con un errore su ${nome}: ${error.message}. ` +
				"Se la funzione non esiste, applica le migrazioni in supabase/migrations (dashboard_rpc, dashboard_analisi).",
		);
	}
	return data as T;
}

async function leggi<T>(
	nome: string,
	demo: (adesso: Date) => T,
	args?: Record<string, unknown>,
): Promise<Letto<T>> {
	// Da qui in poi si lavora a richiesta: niente dati vecchi di un build.
	await connection();
	const adesso = Date.now();
	if (!configurazione()) return { dati: demo(new Date(adesso)), modo: "demo", adesso };
	return { dati: await rpc<T>(nome, args), modo: "reale", adesso };
}

export const leggiHome = () => leggi<Home>("dashboard_home", homeDemo);

export const leggiAbbonamenti = () =>
	leggi<AbbonamentiRecenti>("dashboard_abbonamenti_recenti", abbonamentiDemo, { p_limit: 40 });

export const leggiAccessi = () =>
	leggi<AccessiRecenti>("dashboard_accessi_recenti", accessiDemo, { p_limit: 40 });

// ── Confronto con gli anni scorsi e analisi personalizzata
// (supabase/migrations/20261112090000_dashboard_analisi.sql)

/**
 * Il confronto con gli anni scorsi rilegge tutta la storia: ~1,5 secondi di
 * calcolo. Si tiene in cache e si rinnova ogni quarto d'ora (il sync gira ogni
 * cinque minuti, ma per anni a confronto un ritardo così non cambia nulla).
 * `adesso` è quello del calcolo, non della richiesta.
 */
export async function leggiConfronto(): Promise<Letto<ConfrontoAnni>> {
	"use cache";
	cacheLife({ stale: 60, revalidate: 900, expire: 3600 });
	const adesso = Date.now();
	if (!configurazione()) return { dati: confrontoDemo(new Date(adesso)), modo: "demo", adesso };
	return { dati: await rpc<ConfrontoAnni>("dashboard_confronto_anni", { p_anni: 5 }), modo: "reale", adesso };
}

/** Gruppi, categorie e venditori per i menu: cambiano di rado, si rileggono una volta all'ora. */
export async function leggiOpzioni(): Promise<Opzioni> {
	"use cache";
	cacheLife("hours");
	if (!configurazione()) return opzioniDemo();
	return rpc<Opzioni>("dashboard_opzioni");
}

export type RisultatoAnalisi = {
	filtri: Filtri;
	corrente: Analisi;
	precedente: Analisi | null;
	periodoPrecedente: { da: string; a: string } | null;
	elenco: ElencoVendite;
	modo: "reale" | "demo";
	adesso: number;
};

export const RIGHE_PER_PAGINA = 50;

/** Giorno di oggi a Roma, AAAA-MM-GG: serve per i periodi «da inizio anno», «ultimi 90 giorni»… */
export function oggiARoma(adesso = Date.now()) {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(adesso));
}

/** L'analisi con il suo confronto e l'elenco delle vendite, in parallelo. */
export async function leggiAnalisi(cerca: Record<string, string | string[] | undefined>): Promise<RisultatoAnalisi> {
	await connection();
	const adesso = Date.now();
	const filtri = leggiFiltri(cerca, oggiARoma(adesso));
	const periodoPrecedente = periodoConfronto(filtri);
	const raggruppa = filtri.raggruppa;

	if (!configurazione()) {
		const d = new Date(adesso);
		return {
			filtri,
			corrente: analisiDemo(raggruppa, filtri.da, filtri.a, "c"),
			precedente: periodoPrecedente ? analisiDemo(raggruppa, periodoPrecedente.da, periodoPrecedente.a, "p") : null,
			periodoPrecedente,
			elenco: elencoVenditeDemo(d),
			modo: "demo",
			adesso,
		};
	}

	const [corrente, precedente, elenco] = await Promise.all([
		rpc<Analisi>("dashboard_analisi", { p_filtri: filtriPerRpc(filtri), p_raggruppa: raggruppa }),
		periodoPrecedente
			? rpc<Analisi>("dashboard_analisi", {
					p_filtri: filtriPerRpc(filtri, periodoPrecedente),
					p_raggruppa: raggruppa,
				})
			: Promise.resolve(null),
		rpc<ElencoVendite>("dashboard_analisi_righe", {
			p_filtri: filtriPerRpc(filtri),
			p_limite: RIGHE_PER_PAGINA,
			p_salta: (filtri.pagina - 1) * RIGHE_PER_PAGINA,
			p_ordine: filtri.ordine,
		}),
	]);
	return { filtri, corrente, precedente, periodoPrecedente, elenco, modo: "reale", adesso };
}

/** Tutte le vendite del filtro (fino a 20.000) per l'esportazione in CSV. */
export async function leggiVenditePerCsv(cerca: Record<string, string | string[] | undefined>) {
	await connection();
	const filtri = leggiFiltri(cerca, oggiARoma());
	if (!configurazione()) return { filtri, elenco: elencoVenditeDemo(new Date()) };
	const elenco = await rpc<ElencoVendite>("dashboard_analisi_righe", {
		p_filtri: filtriPerRpc(filtri),
		p_limite: 20_000,
		p_salta: 0,
		p_ordine: filtri.ordine,
	});
	return { filtri, elenco };
}

// ── Viste salvate (tabella dashboard_viste)

function clientDb() {
	const cfg = configurazione();
	return cfg ? client(cfg.url, cfg.chiave) : null;
}

export async function elencoViste(): Promise<Vista[]> {
	await connection();
	const db = clientDb();
	if (!db) return [];
	const { data, error } = await db
		.from("dashboard_viste")
		.select("id, nome, config, creato_il")
		.order("creato_il", { ascending: false })
		.limit(50);
	if (error) throw new Error(`Non riesco a leggere le viste salvate: ${error.message}`);
	return (data ?? []).map((r) => ({
		id: r.id as string,
		nome: r.nome as string,
		query: String((r.config as { query?: string } | null)?.query ?? ""),
		creato_il: r.creato_il as string,
	}));
}

/** Salva la vista; la query viene riletta e riscritta, così nel database finiscono solo filtri validi. */
export async function salvaVistaDb(nome: string, query: string) {
	const db = clientDb();
	if (!db) throw new Error("Supabase non è collegato: le viste si salvano solo con i dati veri.");
	const filtri = leggiFiltri(Object.fromEntries(new URLSearchParams(query)), oggiARoma());
	const pulita = filtriInQuery(filtri, { senzaPagina: true });
	const { error } = await db.from("dashboard_viste").insert({ nome: nome.trim().slice(0, 80), config: { query: pulita } });
	if (error) throw new Error(`Non riesco a salvare la vista: ${error.message}`);
}

export async function eliminaVistaDb(id: string) {
	const db = clientDb();
	if (!db) return;
	const { error } = await db.from("dashboard_viste").delete().eq("id", id);
	if (error) throw new Error(`Non riesco a eliminare la vista: ${error.message}`);
}

// ── Finanza: venduto, incassato, crediti
// (supabase/migrations/20261113090000_dashboard_finanza.sql)

/**
 * Rilegge quattro anni di transazioni: ~4 secondi di calcolo. Si tiene in
 * cache e si rinnova ogni cinque minuti (come il sync): chi arriva dopo la
 * scadenza vede subito il numero precedente mentre quello nuovo si calcola.
 */
export async function leggiFinanza(): Promise<Letto<Finanza>> {
	"use cache";
	cacheLife({ stale: 30, revalidate: 300, expire: 3600 });
	const adesso = Date.now();
	if (!configurazione()) return { dati: finanzaDemo(new Date(adesso)), modo: "demo", adesso };
	return { dati: await rpc<Finanza>("dashboard_finanza", { p_anni: 3 }), modo: "reale", adesso };
}

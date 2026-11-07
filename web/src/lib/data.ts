import "server-only";
import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import { abbonamentiDemo, accessiDemo, homeDemo } from "./demo";
import type { AbbonamentiRecenti, AccessiRecenti, Home } from "./types";

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
				"Se la funzione non esiste, applica la migrazione 20261107120000_dashboard_rpc.sql.",
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

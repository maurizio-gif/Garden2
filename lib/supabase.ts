import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Client con la service role: solo lato server (pagine e azioni).
 * Le tabelle di Garden hanno la RLS attiva senza policy, quindi il browser
 * non legge nulla direttamente.
 */
export function supabaseServer() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) {
		throw new Error('Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
	}
	return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Client «sessione utente» (chiave pubblica + cookie): serve solo a sapere chi
 * e' entrato e a fare login e cambio password. Non usarlo per leggere le
 * tabelle: senza policy restituirebbero sempre zero righe.
 */
export function supabaseSessione() {
	const archivio = cookies();
	return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
		cookies: {
			getAll() {
				return archivio.getAll();
			},
			setAll(daScrivere: { name: string; value: string; options: CookieOptions }[]) {
				try {
					daScrivere.forEach(({ name, value, options }) => archivio.set(name, value, options));
				} catch {
					// Da un Server Component i cookie non si scrivono: li rinnova il middleware.
				}
			},
		},
	});
}

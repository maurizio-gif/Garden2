'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { normalizzaEmail, registra, utenteCorrente, type Ruolo } from '@/lib/auth/staff';
import { supabaseServer } from '@/lib/supabase';

export type EsitoLink = { link?: string; email?: string; errore?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function soloAdmin() {
	const utente = await utenteCorrente();
	if (!utente || utente.ruolo !== 'admin') throw new Error('Serve il ruolo di amministratore.');
	return utente;
}

/** Indirizzo del cruscotto: dalla variabile, altrimenti da quello con cui si sta navigando. */
function indirizzoSito(): string {
	const configurato = process.env.NEXT_PUBLIC_SITE_URL;
	if (configurato) return configurato.replace(/\/$/, '');
	const h = headers();
	const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3100';
	const protocollo = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
	return `${protocollo}://${host}`;
}

/** Genera un link per scegliere la password: nessuna mail parte da Supabase. */
async function creaLink(email: string): Promise<string> {
	const db = supabaseServer();
	const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email });
	const token = data?.properties?.hashed_token;
	if (error || !token) throw new Error(error?.message ?? 'Link non generato.');
	return `${indirizzoSito()}/auth/link?token_hash=${encodeURIComponent(token)}`;
}

/** Abilita una persona (o la riabilita) e restituisce il link da mandarle. */
export async function invita(_: EsitoLink, formData: FormData): Promise<EsitoLink> {
	try {
		const admin = await soloAdmin();
		const email = normalizzaEmail(String(formData.get('email') ?? ''));
		const ruolo: Ruolo = formData.get('ruolo') === 'admin' ? 'admin' : 'lettore';
		if (!EMAIL.test(email)) return { errore: 'Scrivi un indirizzo email valido.' };

		const db = supabaseServer();
		const { error: errRiga } = await db
			.from('staff_users')
			.upsert({ email, ruolo, attivo: true, creato_da: admin.email }, { onConflict: 'email', ignoreDuplicates: false });
		if (errRiga) return { errore: errRiga.message };

		// L'account esiste gia' se la persona e' stata abilitata altrove o prima: non e' un errore.
		const { error: errUtente } = await db.auth.admin.createUser({ email, email_confirm: true });
		if (errUtente && !/already|registered|exists/i.test(errUtente.message)) return { errore: errUtente.message };

		const link = await creaLink(email);
		await registra(admin.email, 'utente_abilitato', { email, ruolo });
		revalidatePath('/utenti');
		return { link, email };
	} catch (e) {
		return { errore: e instanceof Error ? e.message : 'Operazione non riuscita.' };
	}
}

/** Nuovo link per chi ha dimenticato la password. */
export async function nuovoLink(_: EsitoLink, formData: FormData): Promise<EsitoLink> {
	try {
		const admin = await soloAdmin();
		const email = normalizzaEmail(String(formData.get('email') ?? ''));
		const { data } = await supabaseServer().from('staff_users').select('attivo').eq('email', email).maybeSingle();
		if (!data?.attivo) return { errore: 'Questa persona non è abilitata.' };
		const link = await creaLink(email);
		await registra(admin.email, 'link_rigenerato', { email });
		return { link, email };
	} catch (e) {
		return { errore: e instanceof Error ? e.message : 'Operazione non riuscita.' };
	}
}

/** Quanti amministratori attivi restano se `email` smette di esserlo. */
async function amministratoriRestanti(escluso: string): Promise<number> {
	const { count } = await supabaseServer()
		.from('staff_users')
		.select('email', { count: 'exact', head: true })
		.eq('ruolo', 'admin')
		.eq('attivo', true)
		.neq('email', escluso);
	return count ?? 0;
}

export async function impostaAttivo(formData: FormData) {
	const admin = await soloAdmin();
	const email = normalizzaEmail(String(formData.get('email') ?? ''));
	const attivo = formData.get('attivo') === 'true';
	if (!attivo && email === admin.email) return;
	if (!attivo && (await amministratoriRestanti(email)) === 0) {
		const { data } = await supabaseServer().from('staff_users').select('ruolo').eq('email', email).maybeSingle();
		if (data?.ruolo === 'admin') return;
	}
	await supabaseServer().from('staff_users').update({ attivo }).eq('email', email);
	await registra(admin.email, attivo ? 'utente_riabilitato' : 'utente_disabilitato', { email });
	revalidatePath('/utenti');
}

export async function cambiaRuolo(formData: FormData) {
	const admin = await soloAdmin();
	const email = normalizzaEmail(String(formData.get('email') ?? ''));
	const ruolo: Ruolo = formData.get('ruolo') === 'admin' ? 'admin' : 'lettore';
	if (ruolo !== 'admin' && (email === admin.email || (await amministratoriRestanti(email)) === 0)) return;
	await supabaseServer().from('staff_users').update({ ruolo }).eq('email', email);
	await registra(admin.email, 'ruolo_modificato', { email, ruolo });
	revalidatePath('/utenti');
}

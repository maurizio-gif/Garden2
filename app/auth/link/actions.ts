'use server';

import { redirect } from 'next/navigation';
import { registra, staffAttivo } from '@/lib/auth/staff';
import { supabaseSessione } from '@/lib/supabase';

/**
 * Consuma il link: apre la sessione e manda a scegliere la password. Il link
 * si consuma con questo invio e non aprendo la pagina, perche' chi lo riceve
 * su WhatsApp ne ha l'anteprima scaricata da WhatsApp stesso, e un link che si
 * brucia alla prima visita sarebbe gia' scaduto quando lo apre la persona.
 */
export async function confermaLink(formData: FormData) {
	const tokenHash = String(formData.get('token_hash') ?? '');
	if (!tokenHash) redirect('/auth/link?errore=scaduto');

	const supabase = supabaseSessione();
	const { data, error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
	if (error || !data.user?.email) redirect('/auth/link?errore=scaduto');

	const email = data.user.email;
	let abilitata = false;
	try {
		abilitata = (await staffAttivo(email)) !== null;
	} catch {
		abilitata = false;
	}
	if (!abilitata) {
		await supabase.auth.signOut();
		await registra(email, 'link_rifiutato', { motivo: 'non abilitata' });
		redirect('/login?errore=non-abilitata');
	}

	await registra(email, 'link_usato');
	redirect('/imposta-password');
}

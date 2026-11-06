'use server';

import { redirect } from 'next/navigation';
import { normalizzaEmail, registra, staffAttivo } from '@/lib/auth/staff';
import { supabaseServer, supabaseSessione } from '@/lib/supabase';

export async function accedi(formData: FormData) {
	const email = normalizzaEmail(String(formData.get('email') ?? ''));
	const password = String(formData.get('password') ?? '');
	if (!email || !password) redirect('/login?errore=credenziali');

	let abilitata = false;
	try {
		abilitata = (await staffAttivo(email)) !== null;
	} catch (errore) {
		console.error('login: elenco abilitati non leggibile', errore);
		redirect('/login?errore=database');
	}

	// Stessa risposta per «non abilitata» e «password sbagliata»: dire quale
	// dei due direbbe a chiunque chi lavora al club.
	if (!abilitata) {
		await registra(email, 'login_rifiutato', { motivo: 'non abilitata' });
		redirect('/login?errore=credenziali');
	}

	const { error } = await supabaseSessione().auth.signInWithPassword({ email, password });
	if (error) {
		await registra(email, 'login_rifiutato', { motivo: 'password' });
		redirect('/login?errore=credenziali');
	}

	await supabaseServer().from('staff_users').update({ ultimo_accesso: new Date().toISOString() }).eq('email', email);
	await registra(email, 'login');
	redirect('/');
}

export async function esci() {
	const supabase = supabaseSessione();
	const { data } = await supabase.auth.getUser();
	await supabase.auth.signOut();
	if (data.user?.email) await registra(data.user.email, 'logout');
	redirect('/login');
}

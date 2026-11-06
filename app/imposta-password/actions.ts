'use server';

import { redirect } from 'next/navigation';
import { registra } from '@/lib/auth/staff';
import { supabaseServer, supabaseSessione } from '@/lib/supabase';

const torna = (messaggio: string) => `/imposta-password?errore=${encodeURIComponent(messaggio)}`;

export async function impostaPassword(formData: FormData) {
	const nome = String(formData.get('nome') ?? '').trim();
	const cognome = String(formData.get('cognome') ?? '').trim();
	const password = String(formData.get('password') ?? '');
	const conferma = String(formData.get('conferma') ?? '');

	if (!nome || !cognome) redirect(torna('Nome e cognome sono obbligatori.'));
	if (password.length < 8) redirect(torna('La password deve avere almeno 8 caratteri.'));
	if (password !== conferma) redirect(torna('Le due password non coincidono.'));

	const supabase = supabaseSessione();
	const { data } = await supabase.auth.getUser();
	const email = data.user?.email;
	if (!email) redirect('/login');

	const { error } = await supabase.auth.updateUser({ password });
	if (error) redirect(torna(error.message));

	await supabaseServer().from('staff_users').update({ nome, cognome, ultimo_accesso: new Date().toISOString() }).eq('email', email);
	await registra(email, 'password_impostata');
	redirect('/');
}

import { supabaseServer, supabaseSessione } from '@/lib/supabase';

export type Ruolo = 'admin' | 'lettore';

export type Staff = {
	email: string;
	nome: string | null;
	cognome: string | null;
	ruolo: Ruolo;
	attivo: boolean;
	creato_il: string;
	ultimo_accesso: string | null;
};

const normalizza = (email: string) => email.trim().toLowerCase();

/** La riga dell'elenco degli abilitati, se c'e' ed e' attiva. */
export async function staffAttivo(email: string): Promise<Staff | null> {
	const { data, error } = await supabaseServer()
		.from('staff_users')
		.select('email, nome, cognome, ruolo, attivo, creato_il, ultimo_accesso')
		.eq('email', normalizza(email))
		.maybeSingle();
	if (error) throw new Error(`staff_users: ${error.message}`);
	return data && data.attivo ? (data as Staff) : null;
}

/** Chi ha la sessione aperta e sta nell'elenco degli abilitati; altrimenti null. */
export async function utenteCorrente(): Promise<Staff | null> {
	const { data } = await supabaseSessione().auth.getUser();
	const email = data.user?.email;
	return email ? staffAttivo(email) : null;
}

export async function registra(email: string | null, azione: string, dettagli?: Record<string, unknown>) {
	// Il registro non deve mai far fallire l'operazione che sta descrivendo.
	try {
		await supabaseServer()
			.from('registro_accessi')
			.insert({ email: email ? normalizza(email) : null, azione, dettagli: dettagli ?? null });
	} catch (errore) {
		console.error('registro_accessi:', errore);
	}
}

export { normalizza as normalizzaEmail };

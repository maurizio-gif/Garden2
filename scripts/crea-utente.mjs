// Abilita una persona e stampa il link per scegliere la password: serve per il
// primo amministratore, poi si fa tutto dalla pagina Utenti del cruscotto.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/crea-utente.mjs nome@esempio.it [admin|lettore]
//
// Legge NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SITE_URL dall'ambiente (o da
// .env.local, se lo si carica con `node --env-file=.env.local`).
import { createClient } from '@supabase/supabase-js';

const [emailArg, ruoloArg = 'lettore'] = process.argv.slice(2);
const email = (emailArg ?? '').trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sito = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3100').replace(/\/$/, '');

if (!email || !url || !chiave || !['admin', 'lettore'].includes(ruoloArg)) {
	console.error('Uso: SUPABASE_SERVICE_ROLE_KEY=... node scripts/crea-utente.mjs email [admin|lettore]');
	process.exit(1);
}

const db = createClient(url, chiave, { auth: { persistSession: false, autoRefreshToken: false } });

const { error: errRiga } = await db
	.from('staff_users')
	.upsert({ email, ruolo: ruoloArg, attivo: true, creato_da: 'script' }, { onConflict: 'email' });
if (errRiga) throw new Error(errRiga.message);

const { error: errUtente } = await db.auth.admin.createUser({ email, email_confirm: true });
if (errUtente && !/already|registered|exists/i.test(errUtente.message)) throw new Error(errUtente.message);

const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email });
const token = data?.properties?.hashed_token;
if (error || !token) throw new Error(error?.message ?? 'Link non generato.');

console.log(`\nLink per ${email} (${ruoloArg}), valido per un tempo limitato e una sola volta:\n`);
console.log(`${sito}/auth/link?token_hash=${encodeURIComponent(token)}\n`);

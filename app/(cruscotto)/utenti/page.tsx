import { redirect } from 'next/navigation';
import { FormLink } from '@/components/LinkAccesso';
import { utenteCorrente, type Staff } from '@/lib/auth/staff';
import { formatData } from '@/lib/format';
import { supabaseServer } from '@/lib/supabase';
import { cambiaRuolo, impostaAttivo, invita, nuovoLink } from './actions';

export const dynamic = 'force-dynamic';

const etichettaRuolo = { admin: 'Amministratore', lettore: 'Solo lettura' };

export default async function Utenti() {
	const io = await utenteCorrente();
	if (!io || io.ruolo !== 'admin') redirect('/');

	const { data } = await supabaseServer()
		.from('staff_users')
		.select('email, nome, cognome, ruolo, attivo, creato_il, ultimo_accesso')
		.order('creato_il', { ascending: true });
	const elenco = (data ?? []) as Staff[];

	return (
		<div className="contenitore">
			<header className="testata">
				<div className="eyebrow">Gestione accessi</div>
				<h1>Chi può entrare nel cruscotto</h1>
				<p className="sotto">
					Abiliti una persona, il cruscotto genera un link per scegliere la password e lo mandi tu (per esempio su WhatsApp). Nessuna mail parte da
					Supabase.
				</p>
			</header>

			<section className="scheda">
				<h3>Abilita una persona</h3>
				<FormLink azione={invita} testo="Abilita e crea il link">
					<div className="riga-form">
						<label>
							Email
							<input name="email" type="email" placeholder="nome@esempio.it" required />
						</label>
						<label>
							Ruolo
							<select name="ruolo" defaultValue="lettore">
								<option value="lettore">Solo lettura</option>
								<option value="admin">Amministratore</option>
							</select>
						</label>
					</div>
				</FormLink>
			</section>

			<section className="sezione-blocco">
				<h2>Persone abilitate</h2>
				<div className="tabella-utenti">
					{elenco.map((u) => {
						const nome = [u.nome, u.cognome].filter(Boolean).join(' ');
						const sono = u.email === io.email;
						return (
							<div key={u.email} className={`utente ${u.attivo ? '' : 'spento'}`}>
								<div className="utente-chi">
									<b>{nome || u.email}</b>
									{nome && <span>{u.email}</span>}
									<span>
										{u.attivo ? 'Attivo' : 'Disabilitato'} ·{' '}
										{u.ultimo_accesso ? `ultimo accesso ${formatData(u.ultimo_accesso.slice(0, 10))}` : 'non è ancora entrato'}
									</span>
								</div>
								<div className="utente-azioni">
									<form action={cambiaRuolo}>
										<input type="hidden" name="email" value={u.email} />
										<select name="ruolo" defaultValue={u.ruolo} disabled={sono} aria-label={`Ruolo di ${u.email}`}>
											<option value="lettore">{etichettaRuolo.lettore}</option>
											<option value="admin">{etichettaRuolo.admin}</option>
										</select>
										{!sono && (
											<button type="submit" className="secondario">
												Cambia
											</button>
										)}
									</form>
									{u.attivo && (
										<FormLink azione={nuovoLink} testo="Nuovo link">
											<input type="hidden" name="email" value={u.email} />
										</FormLink>
									)}
									{!sono && (
										<form action={impostaAttivo}>
											<input type="hidden" name="email" value={u.email} />
											<input type="hidden" name="attivo" value={u.attivo ? 'false' : 'true'} />
											<button type="submit" className="secondario">
												{u.attivo ? 'Disabilita' : 'Riabilita'}
											</button>
										</form>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</section>
		</div>
	);
}

import { redirect } from 'next/navigation';
import { impostaPassword } from '@/app/imposta-password/actions';
import { utenteCorrente } from '@/lib/auth/staff';

export default async function ImpostaPassword({ searchParams }: { searchParams: { errore?: string } }) {
	// Si arriva solo dal link: senza la sessione che il link apre non c'e' niente da impostare.
	const utente = await utenteCorrente();
	if (!utente) redirect('/login');

	return (
		<main className="accesso">
			<form className="scheda-accesso" action={impostaPassword}>
				<div className="eyebrow">Cruscotto club</div>
				<h1>
					Scegli la tua <em>password</em>.
				</h1>
				{searchParams.errore && (
					<p className="errore" role="alert">
						{searchParams.errore}
					</p>
				)}
				<div className="coppia">
					<label>
						Nome
						<input name="nome" defaultValue={utente.nome ?? ''} autoComplete="given-name" required />
					</label>
					<label>
						Cognome
						<input name="cognome" defaultValue={utente.cognome ?? ''} autoComplete="family-name" required />
					</label>
				</div>
				<label>
					Password (almeno 8 caratteri)
					<input name="password" type="password" autoComplete="new-password" minLength={8} required />
				</label>
				<label>
					Ripeti la password
					<input name="conferma" type="password" autoComplete="new-password" minLength={8} required />
				</label>
				<button type="submit" className="primario">
					Salva ed entra
				</button>
			</form>
		</main>
	);
}

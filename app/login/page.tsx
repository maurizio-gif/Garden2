import { accedi } from '@/app/login/actions';

const ERRORI: Record<string, string> = {
	credenziali: 'Email o password non corrette.',
	'non-abilitata': 'Questo accesso non è abilitato. Chiedi a chi gestisce il cruscotto.',
	database: 'Non riusciamo a verificare l’accesso. Riprova fra un minuto.',
};

export default function Login({ searchParams }: { searchParams: { errore?: string } }) {
	const errore = searchParams.errore ? ERRORI[searchParams.errore] : null;
	return (
		<main className="accesso">
			<form className="scheda-accesso" action={accedi}>
				<div className="eyebrow">Cruscotto club</div>
				<h1>
					Garden, <em>entra</em>.
				</h1>
				{errore && (
					<p className="errore" role="alert">
						{errore}
					</p>
				)}
				<label>
					Email
					<input name="email" type="email" autoComplete="username" required autoFocus />
				</label>
				<label>
					Password
					<input name="password" type="password" autoComplete="current-password" required />
				</label>
				<button type="submit" className="primario">
					Entra
				</button>
				<p className="aiuto">Hai dimenticato la password? Chiedi un nuovo link a chi gestisce il cruscotto.</p>
			</form>
		</main>
	);
}

import { confermaLink } from '@/app/auth/link/actions';

export default function Link({ searchParams }: { searchParams: { token_hash?: string; errore?: string } }) {
	const token = searchParams.token_hash;
	const scaduto = searchParams.errore === 'scaduto' || !token;
	return (
		<main className="accesso">
			<form className="scheda-accesso" action={confermaLink}>
				<div className="eyebrow">Cruscotto club</div>
				{scaduto ? (
					<>
						<h1>Link non valido.</h1>
						<p className="aiuto">Il link è scaduto o è già stato usato. Chiedi un nuovo link a chi gestisce il cruscotto.</p>
					</>
				) : (
					<>
						<h1>
							Benvenuto in <em>Garden</em>.
						</h1>
						<p className="aiuto">Continua per scegliere la tua password.</p>
						<input type="hidden" name="token_hash" value={token} />
						<button type="submit" className="primario">
							Continua
						</button>
					</>
				)}
			</form>
		</main>
	);
}

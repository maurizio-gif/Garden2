'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import type { EsitoLink } from '@/app/(cruscotto)/utenti/actions';

function Invia({ testo }: { testo: string }) {
	const { pending } = useFormStatus();
	return (
		<button type="submit" className="secondario" disabled={pending}>
			{pending ? 'Un attimo…' : testo}
		</button>
	);
}

/** Il link appena creato, con il tasto per copiarlo. Non resta salvato da nessuna parte. */
function Esito({ esito }: { esito: EsitoLink }) {
	const [copiato, setCopiato] = useState(false);
	if (esito.errore) {
		return (
			<p className="errore" role="alert">
				{esito.errore}
			</p>
		);
	}
	if (!esito.link) return null;
	const link = esito.link;
	return (
		<div className="link-creato">
			<p>
				Link per <b>{esito.email}</b>. Valido per un tempo limitato e utilizzabile una sola volta: mandalo adesso.
			</p>
			<div className="link-riga">
				<input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Link di accesso" />
				<button
					type="button"
					className="primario"
					onClick={async () => {
						await navigator.clipboard.writeText(link);
						setCopiato(true);
						setTimeout(() => setCopiato(false), 2000);
					}}
				>
					{copiato ? 'Copiato' : 'Copia'}
				</button>
			</div>
		</div>
	);
}

type Azione = (stato: EsitoLink, dati: FormData) => Promise<EsitoLink>;

/** Form che esegue un'azione e mostra il link che restituisce. */
export function FormLink({ azione, testo, children }: { azione: Azione; testo: string; children?: React.ReactNode }) {
	const [esito, invia] = useFormState(azione, {});
	return (
		<form action={invia} className="form-link">
			{children}
			<Invia testo={testo} />
			<Esito esito={esito} />
		</form>
	);
}

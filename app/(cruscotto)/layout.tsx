import Link from 'next/link';
import { redirect } from 'next/navigation';
import { esci } from '@/app/login/actions';
import { NavSezioni } from '@/components/NavSezioni';
import { utenteCorrente } from '@/lib/auth/staff';

export default async function LayoutCruscotto({ children }: { children: React.ReactNode }) {
	// Il middleware ferma chi non e' entrato; qui si ferma chi e' entrato ma
	// non e' (piu') nell'elenco degli abilitati.
	const utente = await utenteCorrente();
	if (!utente) redirect('/login?errore=non-abilitata');

	const nome = [utente.nome, utente.cognome].filter(Boolean).join(' ') || utente.email;

	return (
		<>
			<div className="barra-utente">
				<div className="contenitore barra-interna">
					<Link href="/" className="marchio">
						Garden <span>cruscotto</span>
					</Link>
					<div className="barra-destra">
						{utente.ruolo === 'admin' && (
							<Link href="/utenti" className="link-barra">
								Utenti
							</Link>
						)}
						<span className="chi" title={utente.email}>
							{nome}
						</span>
						<form action={esci}>
							<button type="submit" className="link-barra">
								Esci
							</button>
						</form>
					</div>
				</div>
			</div>
			<NavSezioni />
			{children}
		</>
	);
}

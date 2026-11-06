'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SEZIONI = [
	{ href: '/', nome: 'Direzione' },
	{ href: '/abbonamenti', nome: 'Abbonamenti' },
	{ href: '/incassato', nome: 'Incassato' },
	{ href: '/vendite', nome: 'Vendite' },
	{ href: '/accessi', nome: 'Accessi' },
	{ href: '/soci', nome: 'Soci' },
	{ href: '/operatori', nome: 'Operatori' },
];

/** Le sette sezioni del cruscotto; su telefono scorrono di lato. */
export function NavSezioni() {
	const corrente = usePathname();
	return (
		<nav className="sezioni" aria-label="Sezioni del cruscotto">
			<div className="contenitore sezioni-interno">
				{SEZIONI.map((s) => {
					const attiva = s.href === '/' ? corrente === '/' : corrente.startsWith(s.href);
					return (
						<Link key={s.href} href={s.href} className={`sezione ${attiva ? 'attiva' : ''}`} aria-current={attiva ? 'page' : undefined}>
							{s.nome}
						</Link>
					);
				})}
			</div>
		</nav>
	);
}

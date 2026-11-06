'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { coloreGruppo } from '@/lib/gruppi';

/** Selezione multipla dei gruppi di prodotto: lo stato sta nell'indirizzo (?gruppi=Nuoto,Corsi). */
export function GruppiFiltro({ gruppi, scelti }: { gruppi: string[]; scelti: string[] | null }) {
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const [inAttesa, avvia] = useTransition();

	const vai = (lista: string[] | null) => {
		const next = new URLSearchParams(params.toString());
		if (lista && lista.length > 0) next.set('gruppi', lista.join(','));
		else next.delete('gruppi');
		const query = next.toString();
		avvia(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
	};

	const attivi = scelti ?? gruppi;
	const toggle = (g: string) => {
		const nuovi = attivi.includes(g) ? attivi.filter((x) => x !== g) : [...attivi, g];
		vai(nuovi.length === 0 || nuovi.length === gruppi.length ? null : nuovi);
	};

	return (
		<div className="filtro" aria-busy={inAttesa}>
			<span className="etichetta">Gruppo prodotto (selezione multipla)</span>
			<div className="chips">
				<button type="button" className={`chip ${scelti === null ? 'on' : ''}`} onClick={() => vai(null)}>
					Tutti i gruppi
				</button>
				{gruppi.map((g) => (
					<button
						key={g}
						type="button"
						className={`chip ${scelti?.includes(g) ? 'on' : ''}`}
						onClick={() => toggle(g)}
						aria-pressed={scelti?.includes(g) ?? false}
					>
						<i style={{ background: coloreGruppo(g) }} />
						{g}
					</button>
				))}
			</div>
		</div>
	);
}

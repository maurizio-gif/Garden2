'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formattaPer, type Formato } from '@/lib/format';

// useLayoutEffect sul server avvisa; sul server non serve.
const useLayoutIsomorfo = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Un numero che sale da zero al valore, una volta sola all'apertura. Chi ha chiesto meno animazione lo vede fermo. */
export function Numero({ valore, formato = 'intero', durata = 900 }: { valore: number; formato?: Formato; durata?: number }) {
	const [mostrato, setMostrato] = useState(valore);
	const partito = useRef(false);

	useLayoutIsomorfo(() => {
		if (partito.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		partito.current = true;
		setMostrato(0);
		let frame = 0;
		const inizio = performance.now();
		const passo = (adesso: number) => {
			const t = Math.min(1, (adesso - inizio) / durata);
			const ease = 1 - Math.pow(1 - t, 4);
			setMostrato(valore * ease);
			if (t < 1) frame = requestAnimationFrame(passo);
		};
		frame = requestAnimationFrame(passo);
		return () => cancelAnimationFrame(frame);
	}, [valore, durata]);

	// Dopo la prima animazione, un valore nuovo (filtro) si mostra subito.
	useEffect(() => {
		if (partito.current) setMostrato(valore);
	}, [valore]);

	return <span className="numero">{formattaPer(formato, Math.round(mostrato))}</span>;
}

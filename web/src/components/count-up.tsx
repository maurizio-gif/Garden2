"use client";

import { animate, useInView, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Numero che «conta» da 0 al valore quando entra nello schermo.
 *
 * Non riceve una funzione di formattazione (un Server Component non può
 * passare funzioni a un Client Component) ma le opzioni di Intl.NumberFormat.
 * Scrive nel DOM senza far rifare il render a React a ogni fotogramma.
 * Il testo del server è già il valore finale, così senza JavaScript o con
 * «riduci movimento» il numero giusto c'è subito.
 */
export function CountUp({
	value,
	options,
	duration = 1.2,
	delay = 0.15,
	className,
}: {
	value: number;
	options?: Intl.NumberFormatOptions;
	duration?: number;
	delay?: number;
	className?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const visibile = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
	const ridotto = useReducedMotion();
	const mv = useMotionValue(0);
	// Mai decimali mentre conta (senza questo si vedrebbe «379,857»), e le
	// migliaia sempre separate: in italiano «5566» a quattro cifre si legge peggio di «5.566».
	const formato = (n: number) =>
		new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: "always", ...options }).format(n);

	// Prima del primo disegno riporto a 0, altrimenti si vedrebbe un lampo del
	// valore finale prima che parta il conteggio.
	useLayoutEffect(() => {
		if (ridotto || !ref.current) return;
		ref.current.textContent = formato(0);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ridotto]);

	useEffect(() => {
		if (ridotto || !visibile || !ref.current) return;
		const el = ref.current;
		const stop = mv.on("change", (v) => {
			el.textContent = formato(v);
		});
		const anim = animate(mv, value, { duration, delay, ease: [0.16, 1, 0.3, 1] });
		return () => {
			anim.stop();
			stop();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [visibile, ridotto, value, duration, delay]);

	return (
		<span ref={ref} className={className} suppressHydrationWarning>
			{formato(value)}
		</span>
	);
}

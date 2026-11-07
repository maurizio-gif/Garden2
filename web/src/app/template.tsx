"use client";

import { motion } from "motion/react";

/**
 * Transizione tra pagine. A differenza del layout, il template viene
 * rimontato a ogni cambio di rotta (vedi docs/app/file-conventions/template),
 * quindi questa animazione riparte a ogni navigazione: la pagina nuova entra
 * sfocata e scivola in posizione mentre si mette a fuoco.
 *
 * `transitionEnd` toglie il filtro a fine corsa: un `filter` lasciato attivo
 * crea un livello a parte e rende il testo leggermente meno nitido.
 */
export default function Template({ children }: { children: React.ReactNode }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 14, filter: "blur(10px)" }}
			animate={{
				opacity: 1,
				y: 0,
				filter: "blur(0px)",
				transitionEnd: { filter: "none" },
			}}
			transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
		>
			{children}
		</motion.div>
	);
}

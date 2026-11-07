"use client";

import { motion, type Variants } from "motion/react";

/**
 * Entrata «a cascata»: il contenitore fa partire i figli uno dopo l'altro.
 *
 *   <Stagger>
 *     <StaggerItem>…</StaggerItem>
 *     <StaggerItem lift>…</StaggerItem>   ← si solleva anche al passaggio del mouse
 *   </Stagger>
 *
 * Gli item possono stare anche più in profondità: motion propaga la variante
 * `show` lungo l'albero, basta che il contenitore sia un antenato.
 */
const contenitore = (ritardo: number, passo: number): Variants => ({
	nascosto: {},
	visibile: { transition: { delayChildren: ritardo, staggerChildren: passo } },
});

const voce: Variants = {
	nascosto: { opacity: 0, y: 18 },
	visibile: {
		opacity: 1,
		y: 0,
		transition: { type: "spring", stiffness: 260, damping: 28, mass: 0.9 },
	},
};

export function Stagger({
	children,
	className,
	delay = 0.05,
	step = 0.07,
	as = "div",
	nested = false,
}: {
	children: React.ReactNode;
	className?: string;
	delay?: number;
	step?: number;
	as?: "div" | "ul" | "ol" | "section";
	/**
	 * Dentro un altro `Stagger` (es. le righe di una lista dentro una Card):
	 * non parte da sola ma eredita lo stato dal contenitore esterno, quindi le
	 * righe iniziano quando la Card è comparsa e non prima.
	 */
	nested?: boolean;
}) {
	const Tag = motion[as];
	return (
		<Tag
			className={className}
			variants={contenitore(delay, step)}
			{...(nested ? {} : { initial: "nascosto", animate: "visibile" })}
		>
			{children}
		</Tag>
	);
}

export function StaggerItem({
	children,
	className,
	hover,
	as = "div",
}: {
	children: React.ReactNode;
	className?: string;
	/**
	 * `lift`: al passaggio del mouse la card sale di 4px e l'ombra si allarga.
	 * `nudge`: la riga di una lista scorre di 4px verso destra.
	 */
	hover?: "lift" | "nudge";
	as?: "div" | "li" | "section" | "article";
}) {
	const Tag = motion[as];
	return (
		<Tag
			className={className}
			variants={voce}
			whileHover={
				hover === "lift"
					? { y: -4, boxShadow: "var(--shadow-lift)" }
					: hover === "nudge"
						? { x: 4 }
						: undefined
			}
			transition={hover ? { type: "spring", stiffness: 380, damping: 26 } : undefined}
		>
			{children}
		</Tag>
	);
}

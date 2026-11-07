"use client";

import { MotionConfig } from "motion/react";

/**
 * `reducedMotion="user"`: se il sistema ha «riduci movimento», motion toglie
 * gli spostamenti e le scale e lascia solo le dissolvenze. I componenti con
 * animazioni di altro tipo (altezze delle barre, conteggio dei numeri) lo
 * controllano da soli con `useReducedMotion`.
 */
export function Providers({ children }: { children: React.ReactNode }) {
	return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

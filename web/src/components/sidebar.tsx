"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

const VOCI = [
	{ href: "/", nome: "Panoramica", icona: IconaPanoramica },
	{ href: "/abbonamenti", nome: "Abbonamenti", icona: IconaAbbonamenti },
	{ href: "/accessi", nome: "Accessi", icona: IconaAccessi },
] as const;

/**
 * Su schermo largo è una colonna a sinistra, su telefono una barra in basso:
 * è lo stesso elemento, cambia solo il layout (così la pillola resta una sola).
 *
 * La pillola della voce attiva è un `layoutId` condiviso: quando cambi pagina
 * motion la fa scorrere dalla voce precedente alla nuova invece di
 * spegnerla e riaccenderla.
 */
export function Sidebar() {
	const pathname = usePathname();

	return (
		<aside
			className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-sm
				md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-t-0 md:bg-surface md:backdrop-blur-none"
		>
			<div className="flex h-full flex-col px-3 py-2 md:px-4 md:py-6">
				<div className="mb-8 hidden items-center gap-2.5 px-2 md:flex">
					<Foglia />
					<span className="text-lg font-semibold tracking-tight">Garden</span>
				</div>

				<nav aria-label="Sezioni" className="flex flex-1 gap-1 md:flex-none md:flex-col">
					{VOCI.map(({ href, nome, icona: Icona }) => {
						const attiva = href === "/" ? pathname === "/" : pathname.startsWith(href);
						return (
							<Link
								key={href}
								href={href}
								aria-current={attiva ? "page" : undefined}
								className={`relative flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition-colors
									md:flex-none md:flex-row md:gap-3 md:py-2.5 md:text-sm
									${attiva ? "text-accent-strong" : "text-ink-2 hover:text-ink"}`}
							>
								{attiva && (
									<motion.span
										layoutId="voce-attiva"
										className="absolute inset-0 z-0 rounded-xl bg-accent-soft"
										transition={{ type: "spring", stiffness: 420, damping: 34 }}
									/>
								)}
								<Icona className="relative z-10 size-5" />
								<span className="relative z-10">{nome}</span>
							</Link>
						);
					})}
				</nav>

				<p className="mt-auto hidden px-2 text-xs text-ink-3 md:block">
					Dati da Info4U
				</p>
			</div>
		</aside>
	);
}

function Foglia() {
	return (
		<svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
			<rect width="32" height="32" rx="9" fill="var(--accent)" />
			<path
				d="M9 22c0-7 4-12 14-13 0 8-4 13-11 13-1 0-2 0-3 0Z"
				fill="none"
				stroke="#fff"
				strokeWidth="1.8"
				strokeLinejoin="round"
			/>
			<path d="M9 23c3-4 6-7 10-9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
		</svg>
	);
}

const traccia = {
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.7,
	strokeLinecap: "round",
	strokeLinejoin: "round",
} as const;

function IconaPanoramica({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...traccia}>
			<rect x="3.5" y="3.5" width="7" height="8" rx="1.8" />
			<rect x="13.5" y="3.5" width="7" height="5" rx="1.8" />
			<rect x="13.5" y="11.5" width="7" height="9" rx="1.8" />
			<rect x="3.5" y="14.5" width="7" height="6" rx="1.8" />
		</svg>
	);
}

function IconaAbbonamenti({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...traccia}>
			<path d="M3.5 8.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v1.6a1.9 1.9 0 0 0 0 3.8v1.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-1.6a1.9 1.9 0 0 0 0-3.8Z" />
			<path d="M14.5 6.8v10.4" strokeDasharray="1.6 2.2" />
		</svg>
	);
}

function IconaAccessi({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...traccia}>
			<path d="M14 4.5h4.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H14" />
			<path d="M4 12h10m0 0-3.5-3.5M14 12l-3.5 3.5" />
		</svg>
	);
}

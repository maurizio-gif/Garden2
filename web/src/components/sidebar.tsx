"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Suspense } from "react";
import { Logo } from "./logo";
import { SceltaTema } from "./tema";

const VOCI = [
	{ href: "/", nome: "Panoramica", icona: IconaPanoramica },
	{ href: "/abbonamenti", nome: "Abbonamenti", icona: IconaAbbonamenti },
	{ href: "/scadenze", nome: "Scadenze", icona: IconaScadenze },
	{ href: "/certificati", nome: "Certificati", icona: IconaCertificati },
	{ href: "/contatti", nome: "Contatti", icona: IconaContatti },
	{ href: "/finanza", nome: "Finanza", icona: IconaFinanza },
	{ href: "/debitori", nome: "Debitori", icona: IconaDebitori },
	{ href: "/analisi", nome: "Analisi", icona: IconaAnalisi },
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
	// L'indirizzo si conosce solo a richiesta: nelle pagine con un parametro
	// (/contatti/<id>) va dentro Suspense. Intanto si disegna il menu senza voce attiva.
	return (
		<Suspense fallback={<Menu pathname={null} />}>
			<MenuConPercorso />
		</Suspense>
	);
}

function MenuConPercorso() {
	return <Menu pathname={usePathname()} />;
}

function Menu({ pathname }: { pathname: string | null }) {
	// Sulla schermata d'accesso il menu non serve (e precaricherebbe pagine chiuse).
	if (pathname === "/accesso") return null;
	return (
		<aside
			className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-sm
				md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-r md:border-t-0 md:bg-surface md:backdrop-blur-none"
		>
			<div className="flex h-full flex-col px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 md:px-4 md:py-6">
				<Link href="/" aria-label="Garden Sporting Center, panoramica" className="mb-8 hidden px-1 md:block">
					<Logo className="h-auto w-full" />
				</Link>

				<nav
					aria-label="Sezioni"
					className="flex flex-1 gap-0.5 overflow-x-auto [scrollbar-width:none] md:flex-none md:flex-col md:gap-1 md:overflow-visible"
				>
					{VOCI.map(({ href, nome, icona: Icona }) => {
						const attiva = pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
						return (
							<Link
								key={href}
								href={href}
								aria-current={attiva ? "page" : undefined}
								className={`relative flex min-w-[4.25rem] flex-1 shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors md:min-w-0 md:px-3
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

				<div className="mt-auto hidden flex-col gap-3 px-2 md:flex">
					<SceltaTema className="self-start" />
					<p className="text-xs text-ink-3">Dati da Info4U</p>
				</div>
			</div>
		</aside>
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

function IconaCertificati({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...traccia}>
			<path d="M7 3.5h7.5L18.5 7.5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
			<path d="M14 3.5v4h4.5M12 10.5v6M9 13.5h6" />
		</svg>
	);
}

function IconaDebitori({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...traccia}>
			<rect x="3" y="6" width="18" height="12" rx="2.5" />
			<path d="M3 10h18M7 14.5h4" />
			<path d="M16.5 13.2v2.6M16.5 17.6v.01" />
		</svg>
	);
}

function IconaContatti({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...traccia}>
			<rect x="4" y="3.5" width="16" height="17" rx="2.5" />
			<circle cx="12" cy="10" r="2.8" />
			<path d="M7.8 17c.6-2 2.2-3.2 4.2-3.2s3.6 1.2 4.2 3.2" />
		</svg>
	);
}

function IconaScadenze({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...traccia}>
			<rect x="3.5" y="5" width="17" height="15" rx="2.5" />
			<path d="M3.5 10h17M8 3v4M16 3v4" />
			<path d="m9 15 2 2 4-4" />
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

function IconaAnalisi({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...traccia}>
			<path d="M4 20V4" />
			<path d="M4 20h16" />
			<path d="m7.5 15 3.5-4 3 2.5 4.5-6" />
			<path d="M16 7.5h2.5V10" />
		</svg>
	);
}

function IconaFinanza({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...traccia}>
			<circle cx="12" cy="12" r="8.5" />
			<path d="M14.8 9.3c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.7.8-2.7 2 0 2.9 5.6 1.4 5.6 4.2 0 1.2-1.2 2-2.9 2-1.4 0-2.5-.6-3-1.6M12 6.5v1.4m0 8.2v1.4" />
		</svg>
	);
}

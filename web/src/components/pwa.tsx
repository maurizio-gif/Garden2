"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/** Evento di Chrome/Android per proporre l'installazione (non è nei tipi standard). */
type EventoInstallazione = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CHIAVE_CHIUSO = "garden-pwa-chiuso";

function suTelefono() {
	return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 1024px)").matches;
}

function giaInstallata() {
	return (
		window.matchMedia("(display-mode: standalone)").matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

function suIos() {
	const ua = navigator.userAgent;
	// iPadOS si presenta come Mac: lo si riconosce dal touch.
	return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/**
 * Se il pannello è aperto da telefono lo rende una PWA: registra il service
 * worker e, finché non è installato, propone di aggiungerlo alla Home
 * (bottone «Installa» su Android, istruzioni su iPhone, dove non c'è un prompt).
 */
export function Pwa() {
	const [modo, setModo] = useState<"android" | "ios" | null>(null);
	const [evento, setEvento] = useState<EventoInstallazione | null>(null);

	useEffect(() => {
		if (!suTelefono() && !giaInstallata()) return;

		if ("serviceWorker" in navigator) {
			navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
		}

		if (giaInstallata()) return;
		let chiuso = false;
		try {
			chiuso = localStorage.getItem(CHIAVE_CHIUSO) === "1";
		} catch {}
		if (chiuso) return;

		// eslint-disable-next-line react-hooks/set-state-in-effect -- dipende da navigator, noto solo dopo il montaggio
		if (suIos()) setModo("ios");

		const suPrompt = (e: Event) => {
			e.preventDefault();
			setEvento(e as EventoInstallazione);
			setModo("android");
		};
		const suInstallata = () => setModo(null);
		window.addEventListener("beforeinstallprompt", suPrompt);
		window.addEventListener("appinstalled", suInstallata);
		return () => {
			window.removeEventListener("beforeinstallprompt", suPrompt);
			window.removeEventListener("appinstalled", suInstallata);
		};
	}, []);

	function chiudi() {
		setModo(null);
		try {
			localStorage.setItem(CHIAVE_CHIUSO, "1");
		} catch {}
	}

	async function installa() {
		if (!evento) return;
		await evento.prompt();
		const { outcome } = await evento.userChoice;
		setEvento(null);
		if (outcome === "accepted") setModo(null);
		else chiudi();
	}

	return (
		<AnimatePresence>
			{modo && (
				<motion.div
					role="dialog"
					aria-label="Installa Garden"
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 16 }}
					className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-lift md:hidden"
				>
					{/* eslint-disable-next-line @next/next/no-img-element -- icona statica minuscola */}
					<img src="/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
					<div className="min-w-0 flex-1 text-sm">
						<p className="font-semibold text-ink">Installa Garden</p>
						{modo === "ios" ? (
							<p className="text-ink-2">
								Tocca <IconaCondividi /> e poi «Aggiungi alla schermata Home».
							</p>
						) : (
							<p className="text-ink-2">Aprilo dalla Home, a tutto schermo.</p>
						)}
					</div>
					{modo === "android" && (
						<button
							type="button"
							onClick={installa}
							className="shrink-0 rounded-xl bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-strong"
						>
							Installa
						</button>
					)}
					<button
						type="button"
						onClick={chiudi}
						aria-label="Chiudi"
						className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:text-ink"
					>
						<svg viewBox="0 0 20 20" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
							<path d="M5 5l10 10M15 5 5 15" />
						</svg>
					</button>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

function IconaCondividi() {
	return (
		<svg viewBox="0 0 20 20" className="inline size-4 -translate-y-px align-middle" aria-label="Condividi" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
			<path d="M10 12.5V3M6.5 6 10 2.5 13.5 6" />
			<path d="M6.5 9H5a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 5 17h10a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 15 9h-1.5" />
		</svg>
	);
}

"use client";

import { useEffect, useState } from "react";

type Tema = "chiaro" | "scuro" | "auto";

const CHIAVE = "garden-tema";

/**
 * Applica la scelta salvata prima che la pagina si disegni (va in <head>),
 * così non si vede il tema sbagliato per un attimo. «auto» = segue il sistema:
 * nessun data-theme, decide la media query in globals.css.
 */
export const scriptTema = `(function(){try{var t=localStorage.getItem("${CHIAVE}");if(t==="chiaro")document.documentElement.dataset.theme="light";else if(t==="scuro")document.documentElement.dataset.theme="dark";}catch(e){}})();`;

function applica(t: Tema) {
	const html = document.documentElement;
	if (t === "chiaro") html.dataset.theme = "light";
	else if (t === "scuro") html.dataset.theme = "dark";
	else delete html.dataset.theme;
	try {
		if (t === "auto") localStorage.removeItem(CHIAVE);
		else localStorage.setItem(CHIAVE, t);
	} catch {
		// Navigazione privata o archivio bloccato: la scelta vale solo per questa pagina.
	}
}

const VOCI: { valore: Tema; nome: string; icona: React.ReactNode }[] = [
	{
		valore: "chiaro",
		nome: "Chiaro",
		icona: (
			<svg viewBox="0 0 20 20" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
				<circle cx="10" cy="10" r="3.4" />
				<path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" />
			</svg>
		),
	},
	{
		valore: "scuro",
		nome: "Scuro",
		icona: (
			<svg viewBox="0 0 20 20" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
				<path d="M16.5 12.2A6.8 6.8 0 0 1 7.8 3.5a6.8 6.8 0 1 0 8.7 8.7Z" />
			</svg>
		),
	},
	{
		valore: "auto",
		nome: "Automatico (come il computer)",
		icona: (
			<svg viewBox="0 0 20 20" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
				<rect x="2.5" y="3.5" width="15" height="10" rx="1.8" />
				<path d="M7 16.5h6M10 13.5v3" strokeLinecap="round" />
			</svg>
		),
	},
];

/** Tre bottoni: chiaro, scuro, automatico. La scelta resta in questo browser. */
export function SceltaTema({ className = "" }: { className?: string }) {
	// Sul server non si sa cosa c'è salvato: si legge dopo il montaggio.
	const [tema, setTema] = useState<Tema | null>(null);
	useEffect(() => {
		let salvato: string | null = null;
		try {
			salvato = localStorage.getItem(CHIAVE);
		} catch {}
		// eslint-disable-next-line react-hooks/set-state-in-effect -- lettura una tantum di localStorage dopo il montaggio
		setTema(salvato === "chiaro" || salvato === "scuro" ? salvato : "auto");
	}, []);

	return (
		<div role="radiogroup" aria-label="Tema dei colori" className={`inline-flex gap-0.5 rounded-xl bg-surface-2 p-0.5 ${className}`}>
			{VOCI.map((v) => {
				const attivo = tema === v.valore;
				return (
					<button
						key={v.valore}
						type="button"
						role="radio"
						aria-checked={attivo}
						title={v.nome}
						onClick={() => {
							setTema(v.valore);
							applica(v.valore);
						}}
						className={`grid size-8 place-items-center rounded-lg transition-colors ${
							attivo ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink"
						}`}
					>
						{v.icona}
						<span className="sr-only">{v.nome}</span>
					</button>
				);
			})}
		</div>
	);
}

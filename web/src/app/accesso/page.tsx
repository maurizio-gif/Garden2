import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { ModuloAccesso } from "./modulo";

export const metadata: Metadata = { title: "Accesso" };

/** Schermata d'accesso. Il menu qui non c'è (vedi sidebar.tsx); su telefono il logo è già in testa alla pagina. */
export default function Pagina() {
	return (
		<div className="grid min-h-[70dvh] place-items-center py-6">
			<div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-card">
				<Logo className="mb-6 hidden h-12 w-auto md:block" />
				<h1 className="mb-1 text-lg font-semibold tracking-tight">Accesso riservato</h1>
				<p className="mb-5 text-sm text-ink-3">Il pannello contiene dati dei soci: serve la password.</p>
				<Suspense>
					<ModuloAccesso />
				</Suspense>
			</div>
		</div>
	);
}

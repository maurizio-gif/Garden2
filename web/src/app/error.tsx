"use client";

export default function Errore({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<div role="alert" className="mx-auto mt-16 max-w-md rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
			<h1 className="text-lg font-semibold">Non riesco a leggere i dati</h1>
			<p className="mt-2 text-sm text-ink-2">
				Il pannello non ha ricevuto risposta da Supabase. Controlla le variabili d&apos;ambiente e che la migrazione
				delle funzioni <code className="rounded bg-surface-2 px-1">dashboard_*</code> sia stata applicata: il
				dettaglio è nei log del server.
			</p>
			<button
				type="button"
				onClick={reset}
				className="mt-5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
			>
				Riprova
			</button>
		</div>
	);
}

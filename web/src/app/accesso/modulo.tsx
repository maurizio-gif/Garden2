"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { accedi, type StatoAccesso } from "./azioni";

export function ModuloAccesso() {
	const da = useSearchParams().get("da") ?? "/";
	const [stato, invia, inCorso] = useActionState<StatoAccesso, FormData>(accedi, { errore: null });

	return (
		<form action={invia} className="flex flex-col gap-3">
			<input type="hidden" name="da" value={da} />
			{/* username nascosto: aiuta i gestori di password del telefono a salvarla */}
			<input type="text" name="username" autoComplete="username" value="garden" readOnly hidden />
			<label className="flex flex-col gap-1.5 text-sm">
				<span className="font-medium">Password</span>
				<input
					type="password"
					name="password"
					required
					autoFocus
					autoComplete="current-password"
					aria-invalid={stato.errore ? true : undefined}
					aria-describedby={stato.errore ? "errore-accesso" : undefined}
					className="rounded-xl border border-line bg-surface px-3 py-2.5 text-base outline-none focus:border-accent"
				/>
			</label>
			{stato.errore && (
				<p id="errore-accesso" role="alert" className="text-sm text-bad">
					{stato.errore}
				</p>
			)}
			<button
				type="submit"
				disabled={inCorso}
				className="mt-1 rounded-xl bg-accent-soft px-4 py-2.5 font-semibold text-accent-strong disabled:opacity-60"
			>
				{inCorso ? "Accesso…" : "Entra"}
			</button>
			<p className="text-xs text-ink-3">Resti dentro su questo dispositivo, anche chiudendo l&apos;app.</p>
		</form>
	);
}

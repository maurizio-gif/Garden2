import { dataOra } from "@/lib/format";

const OLTRE_ORE = 6;

/**
 * Dice da dove arrivano i numeri e quanto sono freschi. Il pannello deve dirlo
 * da solo: se il sync con Info4U si ferma, un «0 accessi oggi» sembrerebbe vero.
 */
export function StatoDati({
	modo,
	aggiornatoAl,
	adesso,
	fresco = "Aggiornato",
	fermo = "Dati fermi al",
	vuoto = "Nessun dato sincronizzato",
}: {
	modo: "reale" | "demo";
	aggiornatoAl: string | null;
	adesso: number;
	/** Testo davanti alla data quando i dati sono recenti: «Aggiornato 5 nov, 18:21». */
	fresco?: string;
	/** Testo davanti alla data quando sono vecchi: «Dati fermi al 5 nov, 18:21». */
	fermo?: string;
	/** Testo quando non c'è nessuna data. */
	vuoto?: string;
}) {
	const ore = aggiornatoAl ? (adesso - new Date(aggiornatoAl).getTime()) / 3_600_000 : null;
	const vecchio = ore === null || ore > OLTRE_ORE;

	return (
		<div className="flex flex-wrap items-center gap-2 text-xs">
			{modo === "demo" && (
				<span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 font-medium text-warn">
					<Punto />
					Dati di prova (Supabase non collegato)
				</span>
			)}
			{aggiornatoAl ? (
				<span
					className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
						vecchio ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent-strong"
					}`}
				>
					<Punto />
					{vecchio
						? `${fermo} ${dataOra(aggiornatoAl)}: il sync con Info4U non gira da un po'`
						: `${fresco} ${dataOra(aggiornatoAl)}`}
				</span>
			) : (
				<span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 font-medium text-warn">
					<Punto />
					{vuoto}
				</span>
			)}
		</div>
	);
}

function Punto() {
	return <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />;
}

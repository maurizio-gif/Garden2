import { NOMI_STATO } from "@/lib/contatti";
import type { StatoContatto } from "@/lib/types";

const TONI: Record<StatoContatto, string> = {
	attivo: "bg-accent-soft text-accent-strong",
	in_scadenza: "bg-warn-soft text-warn",
	in_partenza: "bg-accent-soft text-accent-strong",
	scaduto: "bg-warn-soft text-warn",
	ex: "bg-surface-2 text-ink-2",
	mai: "bg-surface-2 text-ink-3",
};

/** Lo stato di una persona come etichetta colorata (il testo dice lo stato, il colore aiuta). */
export function StatoBadge({ stato }: { stato: StatoContatto }) {
	return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONI[stato]}`}>{NOMI_STATO[stato]}</span>;
}

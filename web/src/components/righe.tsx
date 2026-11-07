import { StaggerItem, Stagger } from "./motion-kit";
import { dataBreve, euro, frase, iniziali, nomeCompleto, quandoRelativo } from "@/lib/format";
import type { Vendita } from "@/lib/types";

const riga =
	"flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2";

function Avatar({ nome, cognome }: { nome: string | null; cognome: string | null }) {
	return (
		<span
			aria-hidden="true"
			className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-strong"
		>
			{iniziali(nome, cognome)}
		</span>
	);
}

/** Ultimi abbonamenti venduti. Le righe entrano a cascata e scorrono di un filo al passaggio del mouse. */
export function ListaVendite({
	vendite,
	adesso,
	conDurata = false,
}: {
	vendite: (Vendita & { inizio?: string | null; fine?: string | null })[];
	adesso: number;
	conDurata?: boolean;
}) {
	if (vendite.length === 0) {
		return <p className="px-3 py-6 text-sm text-ink-3">Nessuna vendita da mostrare.</p>;
	}
	return (
		<Stagger as="ul" nested className="-mx-3 m-0 list-none p-0" delay={0.1} step={0.045}>
			{vendite.map((v, i) => (
				<StaggerItem as="li" key={`${v.quando}-${i}`} hover="nudge" className={riga}>
					<Avatar nome={v.nome} cognome={v.cognome} />
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{nomeCompleto(v.nome, v.cognome)}</p>
						<p className="truncate text-xs text-ink-3">
							{frase(v.abbonamento) || "Abbonamento"}
							{v.categoria ? ` · ${frase(v.categoria)}` : ""}
							{conDurata && v.inizio && v.fine
								? ` · dal ${dataBreve(v.inizio)} al ${dataBreve(v.fine)}`
								: ""}
						</p>
					</div>
					<div className="shrink-0 text-right">
						<p className="text-sm font-semibold tabular-nums">{v.totale != null ? euro.format(v.totale) : "—"}</p>
						<p className="text-xs text-ink-3">{quandoRelativo(v.quando, adesso)}</p>
					</div>
				</StaggerItem>
			))}
		</Stagger>
	);
}

/** Ultimi passaggi ai tornelli. */
export function ListaAccessi({
	accessi,
}: {
	accessi: { quando: string; nome: string | null; cognome: string | null; servizio: string | null }[];
}) {
	if (accessi.length === 0) {
		return <p className="px-3 py-6 text-sm text-ink-3">Nessun accesso da mostrare.</p>;
	}
	const ora = new Intl.DateTimeFormat("it-IT", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Rome",
	});
	return (
		<Stagger as="ul" nested className="-mx-3 m-0 list-none p-0" delay={0.1} step={0.035}>
			{accessi.map((a, i) => (
				<StaggerItem as="li" key={`${a.quando}-${i}`} hover="nudge" className={riga}>
					<Avatar nome={a.nome} cognome={a.cognome} />
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{nomeCompleto(a.nome, a.cognome)}</p>
						<p className="truncate text-xs text-ink-3">{a.servizio ? frase(a.servizio) : "Ingresso"}</p>
					</div>
					<p className="shrink-0 text-sm tabular-nums text-ink-2">{ora.format(new Date(a.quando))}</p>
				</StaggerItem>
			))}
		</Stagger>
	);
}

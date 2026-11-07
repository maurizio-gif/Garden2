import { CountUp } from "./count-up";
import { StaggerItem } from "./motion-kit";

type Props = {
	etichetta: string;
	valore: number;
	opzioni?: Intl.NumberFormatOptions;
	/** Riga sotto il numero: cosa conta, in parole. */
	nota: string;
	icona: React.ReactNode;
	/** `attenzione` colora l'icona e aggiunge l'etichetta accanto: il colore da solo non basta. */
	tono?: "neutro" | "attenzione";
	/** Confronto con un periodo di riferimento (solo dove ha senso, es. gli incassi). */
	delta?: { percentuale: number; riferimento: string };
};

/** Scheda con un solo numero grande: sale al passaggio del mouse e il numero conta da zero. */
export function Kpi({ etichetta, valore, opzioni, nota, icona, tono = "neutro", delta }: Props) {
	const attenzione = tono === "attenzione";
	return (
		<StaggerItem
			hover="lift"
			className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card"
		>
			<div className="flex items-center justify-between gap-3">
				<p className="min-h-[3.75rem] text-sm font-medium text-ink-2 xl:min-h-10">{etichetta}</p>
				<span
					className={`grid size-9 place-items-center rounded-xl ${
						attenzione ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent-strong"
					}`}
				>
					{icona}
				</span>
			</div>

			<p className="mt-4 whitespace-nowrap text-2xl font-semibold leading-none tracking-tight sm:text-[2rem]">
				<CountUp value={valore} options={opzioni} />
			</p>

			<div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
				{delta && <Delta {...delta} />}
				<span className={delta ? "text-ink-3" : ""}>{delta ? delta.riferimento : nota}</span>
				{attenzione && !delta && (
					<span className="rounded-full bg-warn-soft px-2 py-0.5 font-medium text-warn">Da seguire</span>
				)}
			</div>
		</StaggerItem>
	);
}

function Delta({ percentuale }: { percentuale: number; riferimento: string }) {
	const su = percentuale >= 0;
	const testo = `${su ? "+" : "−"}${Math.abs(Math.round(percentuale))}%`;
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
				su ? "bg-accent-soft text-accent-strong" : "bg-warn-soft text-warn"
			}`}
		>
			<svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
				<path
					d={su ? "M6 10V2.5M2.8 5.5 6 2.3l3.2 3.2" : "M6 2v7.5M2.8 6.5 6 9.7l3.2-3.2"}
					fill="none"
					stroke="currentColor"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
			<span className="sr-only">{su ? "in aumento di" : "in calo di"}</span>
			{testo}
		</span>
	);
}

const traccia = {
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.7,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	className: "size-5",
	"aria-hidden": true,
} as const;

export const Icone = {
	persone: (
		<svg viewBox="0 0 24 24" {...traccia}>
			<circle cx="9" cy="8.5" r="3.2" />
			<path d="M3.5 19c.6-3.3 2.9-5 5.5-5s4.9 1.7 5.5 5" />
			<path d="M16 5.8a3 3 0 0 1 0 5.4M17.5 14.3c1.8.5 2.8 2 3.1 4.2" />
		</svg>
	),
	scadenza: (
		<svg viewBox="0 0 24 24" {...traccia}>
			<rect x="3.5" y="5" width="17" height="15" rx="2.5" />
			<path d="M3.5 10h17M8 3v4M16 3v4" />
			<path d="M12 13.2v2.6l1.7 1" />
		</svg>
	),
	rate: (
		<svg viewBox="0 0 24 24" {...traccia}>
			<circle cx="12" cy="12" r="8.5" />
			<path d="M12 7.5v5l3 1.8" />
		</svg>
	),
	incassi: (
		<svg viewBox="0 0 24 24" {...traccia}>
			<rect x="3" y="6" width="18" height="12" rx="2.5" />
			<circle cx="12" cy="12" r="2.6" />
			<path d="M6.5 9.5v.01M17.5 14.5v.01" />
		</svg>
	),
};

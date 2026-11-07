import { StaggerItem } from "./motion-kit";

/** Riquadro bianco con titolo, per grafici e liste. Entra con la cascata della pagina. */
export function Card({
	titolo,
	sottotitolo,
	children,
	className = "",
}: {
	titolo: string;
	sottotitolo?: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<StaggerItem as="section" className={`flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card ${className}`}>
			<div className="mb-5">
				<h2 className="text-base font-semibold tracking-tight">{titolo}</h2>
				{sottotitolo && <p className="mt-0.5 text-sm text-ink-3">{sottotitolo}</p>}
			</div>
			<div className="flex min-h-0 flex-1 flex-col">{children}</div>
		</StaggerItem>
	);
}

export function Titolo({ children }: { children: React.ReactNode }) {
	return <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{children}</h1>;
}

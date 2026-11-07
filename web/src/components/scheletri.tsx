/** Segnaposto mentre arrivano i dati: stessa impronta della pagina vera, così non salta nulla. */

export function ScheletroHome() {
	return (
		<div aria-busy="true" aria-label="Caricamento in corso" role="status">
			<div className="skeleton mb-4 h-6 w-48 rounded-full" />
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				{Array.from({ length: 4 }, (_, i) => (
					<div key={i} className="skeleton h-[148px] rounded-2xl" />
				))}
			</div>
			<div className="mt-4 grid gap-4 lg:grid-cols-5">
				<div className="skeleton h-[340px] rounded-2xl lg:col-span-3" />
				<div className="skeleton h-[340px] rounded-2xl lg:col-span-2" />
			</div>
			<div className="skeleton mt-4 h-72 rounded-2xl" />
		</div>
	);
}

export function ScheletroLista() {
	return (
		<div aria-busy="true" aria-label="Caricamento in corso" role="status">
			<div className="skeleton mb-4 h-6 w-48 rounded-full" />
			<div className="skeleton h-[520px] rounded-2xl" />
		</div>
	);
}

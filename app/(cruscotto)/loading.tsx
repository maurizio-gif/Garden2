/** Lo scheletro che si vede mentre la pagina arriva: stessa disposizione, niente salti. */
export default function Caricamento() {
	return (
		<div className="contenitore" aria-busy="true" aria-label="Caricamento in corso">
			<div className="scheletro-pagina">
				<div className="sk sk-hero" />
				<div className="sk-riga">
					{[0, 1, 2, 3, 4, 5].map((i) => (
						<div key={i} className="sk sk-chip" />
					))}
				</div>
				<div className="griglia quattro">
					{[0, 1, 2, 3].map((i) => (
						<div key={i} className="sk sk-indicatore" />
					))}
				</div>
				<div className="griglia principale">
					<div className="sk sk-grande" />
					<div className="sk sk-grande" />
				</div>
				<div className="griglia secondaria">
					<div className="sk sk-grande" />
					<div className="sk sk-grande" />
				</div>
			</div>
		</div>
	);
}

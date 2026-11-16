import Link from "next/link";
import { nomeCompleto } from "@/lib/format";

/**
 * Il nome di una persona: se c'è la sua scheda è un link (/contatti/<id>),
 * altrimenti testo. Usato in ogni elenco del pannello.
 */
export function NomePersona({
	id,
	nome,
	cognome,
	className = "",
}: {
	id?: string | null;
	nome: string | null;
	cognome: string | null;
	className?: string;
}) {
	const testo = nomeCompleto(nome, cognome);
	if (!id) return <span className={className}>{testo}</span>;
	return (
		<Link
			href={`/contatti/${id}`}
			className={`underline-offset-2 hover:text-accent-strong hover:underline focus-visible:text-accent-strong ${className}`}
		>
			{testo}
		</Link>
	);
}

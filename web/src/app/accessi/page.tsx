import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Titolo } from "@/components/card";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { ListaAccessi } from "@/components/righe";
import { ScheletroLista } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { leggiAccessi } from "@/lib/data";

export const metadata: Metadata = { title: "Accessi" };

export default function Pagina() {
	return (
		<>
			<div className="mb-4">
				<Titolo>Accessi</Titolo>
			</div>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto />
			</Suspense>
		</>
	);
}

async function Contenuto() {
	const { dati: d, modo, adesso } = await leggiAccessi();
	return (
		<Stagger className="flex flex-col gap-4">
			<StaggerItem>
				<StatoDati
					modo={modo}
					aggiornatoAl={d.ultimo_accesso}
					adesso={adesso}
					fresco="Ultimo accesso"
					fermo="Ultimo accesso registrato il"
					vuoto="Nessun accesso registrato"
				/>
			</StaggerItem>
			<Card
				titolo="Ultimi passaggi ai tornelli"
				sottotitolo={d.accessi.length > 0 ? `Gli ultimi ${d.accessi.length}` : undefined}
			>
				<ListaAccessi accessi={d.accessi} />
			</Card>
		</Stagger>
	);
}

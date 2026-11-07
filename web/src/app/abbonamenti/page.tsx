import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Titolo } from "@/components/card";
import { Stagger, StaggerItem } from "@/components/motion-kit";
import { ListaVendite } from "@/components/righe";
import { ScheletroLista } from "@/components/scheletri";
import { StatoDati } from "@/components/stato-dati";
import { leggiAbbonamenti } from "@/lib/data";

export const metadata: Metadata = { title: "Abbonamenti" };

export default function Pagina() {
	return (
		<>
			<div className="mb-4">
				<Titolo>Abbonamenti</Titolo>
			</div>
			<Suspense fallback={<ScheletroLista />}>
				<Contenuto />
			</Suspense>
		</>
	);
}

async function Contenuto() {
	const { dati: d, modo, adesso } = await leggiAbbonamenti();
	return (
		<Stagger className="flex flex-col gap-4">
			<StaggerItem>
				<StatoDati modo={modo} aggiornatoAl={d.aggiornato_al} adesso={adesso} />
			</StaggerItem>
			<Card
				titolo="Ultime vendite"
				sottotitolo={
					d.abbonamenti.length > 0
						? `Le ultime ${d.abbonamenti.length}, escluse le quote associative`
						: "Escluse le quote associative"
				}
			>
				<ListaVendite vendite={d.abbonamenti} adesso={adesso} conDurata />
			</Card>
		</Stagger>
	);
}

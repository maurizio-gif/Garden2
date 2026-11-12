"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eliminaVistaDb, salvaVistaDb } from "@/lib/data";

/** Salva i filtri attuali con un nome e torna alla stessa analisi. */
export async function salvaVista(formData: FormData) {
	const nome = String(formData.get("nome") ?? "").trim();
	const query = String(formData.get("query") ?? "");
	if (!nome) return;
	await salvaVistaDb(nome, query);
	revalidatePath("/analisi");
	redirect(query ? `/analisi?${query}` : "/analisi");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function eliminaVista(formData: FormData) {
	const id = String(formData.get("id") ?? "");
	if (!UUID.test(id)) return;
	await eliminaVistaDb(id);
	revalidatePath("/analisi");
}

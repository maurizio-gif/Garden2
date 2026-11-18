"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_ACCESSO, DURATA_ACCESSO, gettone, percorsoSicuro, uguali } from "@/lib/accesso";

export type StatoAccesso = { errore: string | null };

export async function accedi(_prima: StatoAccesso, form: FormData): Promise<StatoAccesso> {
	const password = process.env.DASHBOARD_PASSWORD;
	const data = String(form.get("password") ?? "");
	const da = percorsoSicuro(form.get("da"));

	if (password) {
		if (!uguali(data, password)) {
			// Rallenta chi prova password a raffica.
			await new Promise((r) => setTimeout(r, 800));
			return { errore: "Password sbagliata." };
		}
		(await cookies()).set(COOKIE_ACCESSO, await gettone(password), {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: DURATA_ACCESSO,
		});
	}
	redirect(da);
}

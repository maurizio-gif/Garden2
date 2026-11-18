/**
 * Accesso al pannello con una password sola (DASHBOARD_PASSWORD).
 *
 * Dopo l'accesso il browser tiene un cookie con un gettone derivato dalla
 * password (HMAC): non contiene la password e smette di valere da solo se la
 * password cambia. Serve soprattutto all'app installata sul telefono, che non
 * ricorda la password chiesta dalla finestra del browser (Basic Auth).
 *
 * Usato sia da src/proxy.ts sia dall'azione di accesso: solo Web Crypto.
 */
export const COOKIE_ACCESSO = "garden_accesso";
/** 400 giorni: il massimo che i browser accettano per un cookie. */
export const DURATA_ACCESSO = 400 * 24 * 60 * 60;

export async function gettone(password: string) {
	const chiave = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const firma = await crypto.subtle.sign("HMAC", chiave, new TextEncoder().encode("garden-pannello-accesso-v1"));
	return Array.from(new Uint8Array(firma), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Confronto a tempo costante (sulla lunghezza del più lungo). */
export function uguali(a: string, b: string) {
	const x = new TextEncoder().encode(a);
	const y = new TextEncoder().encode(b);
	let diff = x.length ^ y.length;
	for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
	return diff === 0;
}

/** Dove tornare dopo l'accesso: solo percorsi interni. */
export function percorsoSicuro(da: unknown) {
	return typeof da === "string" && da.startsWith("/") && !da.startsWith("//") && !da.startsWith("/accesso") ? da : "/";
}

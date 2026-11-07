const FUSO = "Europe/Rome";

export const euro = new Intl.NumberFormat("it-IT", {
	style: "currency",
	currency: "EUR",
	maximumFractionDigits: 0,
});

export const intero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: "always" });

/** «ottobre 2026» da una data AAAA-MM-GG. */
export function meseLungo(iso: string) {
	return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(
		new Date(`${iso}T00:00:00Z`),
	);
}

/** «ott» da una data AAAA-MM-GG. */
export function meseCorto(iso: string) {
	return new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" })
		.format(new Date(`${iso}T00:00:00Z`))
		.replace(".", "");
}

/** «5 nov, 18:21» nel fuso di Roma. */
export function dataOra(iso: string) {
	return new Intl.DateTimeFormat("it-IT", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: FUSO,
	}).format(new Date(iso));
}

/** «5 nov 2026». */
export function dataBreve(iso: string) {
	return new Intl.DateTimeFormat("it-IT", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: FUSO,
	}).format(new Date(iso));
}

/** «oggi», «ieri», «3 giorni fa», altrimenti la data. `adesso` arriva da fuori per non leggere l'orologio qui. */
export function quandoRelativo(iso: string, adesso: number) {
	const giorni = Math.floor((adesso - new Date(iso).getTime()) / 86_400_000);
	if (giorni <= 0) return "oggi";
	if (giorni === 1) return "ieri";
	if (giorni < 7) return `${giorni} giorni fa`;
	return dataBreve(iso);
}

/** I nomi in Info4U sono spesso tutti maiuscoli: «ROSSI MARIO» → «Mario Rossi». */
export function nomeCompleto(nome: string | null, cognome: string | null) {
	const parole = [nome, cognome]
		.filter(Boolean)
		.join(" ")
		.toLowerCase()
		.replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, lettera: string) => sep + lettera.toUpperCase());
	return parole || "Senza nome";
}

export function iniziali(nome: string | null, cognome: string | null) {
	return ((nome?.[0] ?? "") + (cognome?.[0] ?? "")).toUpperCase() || "?";
}

/** «FAMILY NUOTO» → «Family nuoto». */
export function frase(testo: string | null) {
	if (!testo) return "";
	const t = testo.trim().toLowerCase();
	return t.charAt(0).toUpperCase() + t.slice(1);
}

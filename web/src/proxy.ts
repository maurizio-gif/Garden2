import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ACCESSO, DURATA_ACCESSO, gettone, uguali } from "@/lib/accesso";

/**
 * Cancello d'ingresso: se DASHBOARD_PASSWORD è impostata, ogni pagina chiede
 * la password. Chi non ha ancora fatto l'accesso finisce sulla pagina
 * /accesso; dopo, un cookie lo tiene dentro per 400 giorni (anche nell'app
 * installata sul telefono, che chiusa e riaperta non ricorda la finestra della
 * password del browser). È una protezione semplice, non un sistema di account.
 *
 * Vale ancora anche la vecchia password con la finestra del browser (Basic
 * Auth): chi la usa riceve il cookie e non gliela si chiede più.
 *
 * Senza DASHBOARD_PASSWORD non filtra nulla; in quel caso src/lib/data.ts
 * rifiuta comunque di servire dati veri in produzione.
 */
export async function proxy(request: NextRequest) {
	const password = process.env.DASHBOARD_PASSWORD;
	if (!password) return NextResponse.next();
	if (request.nextUrl.pathname === "/accesso") return NextResponse.next();

	const atteso = await gettone(password);
	const cookie = request.cookies.get(COOKIE_ACCESSO)?.value;
	if (cookie && uguali(cookie, atteso)) return NextResponse.next();

	if (basicGiusta(request.headers.get("authorization"), password)) {
		const risposta = NextResponse.next();
		risposta.cookies.set(COOKIE_ACCESSO, atteso, opzioniCookie());
		return risposta;
	}

	// Una pagina aperta dal browser va alla schermata d'accesso; il resto
	// (dati delle pagine, export) riceve un 401 e Next ricarica la pagina.
	const pagina = request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/html");
	if (pagina) {
		const url = request.nextUrl.clone();
		url.pathname = "/accesso";
		url.search = "";
		const da = request.nextUrl.pathname + request.nextUrl.search;
		if (da !== "/") url.searchParams.set("da", da);
		return NextResponse.redirect(url);
	}
	return new NextResponse("Accesso riservato", { status: 401, headers: { "Cache-Control": "no-store" } });
}

function opzioniCookie() {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax" as const,
		path: "/",
		maxAge: DURATA_ACCESSO,
	};
}

function basicGiusta(intestazione: string | null, attesa: string) {
	const [schema, codificato] = (intestazione ?? "").split(" ");
	if (schema !== "Basic" || !codificato) return false;
	let credenziali: string;
	try {
		credenziali = new TextDecoder().decode(Uint8Array.from(atob(codificato), (c) => c.charCodeAt(0)));
	} catch {
		return false;
	}
	const separatore = credenziali.indexOf(":");
	return separatore >= 0 && uguali(credenziali.slice(separatore + 1), attesa);
}

export const config = {
	// Tutto tranne i file statici di Next e quelli della PWA (manifest, service
	// worker, icone, pagina offline): non hanno dati e il telefono li scarica
	// senza password.
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icon-|icon\\.svg|apple-icon).*)",
	],
};

import { NextResponse, type NextRequest } from "next/server";

/**
 * Cancello d'ingresso minimo: se DASHBOARD_PASSWORD è impostata, ogni pagina
 * chiede utente e password (l'utente è libero, conta solo la password) con la
 * finestra del browser. È una protezione semplice, non un sistema di account:
 * serve a non lasciare aperti i dati dei soci finché non c'è un login vero.
 *
 * Senza DASHBOARD_PASSWORD non filtra nulla; in quel caso src/lib/data.ts
 * rifiuta comunque di servire dati veri in produzione.
 */
export function proxy(request: NextRequest) {
	const password = process.env.DASHBOARD_PASSWORD;
	if (!password) return NextResponse.next();

	const intestazione = request.headers.get("authorization") ?? "";
	const [schema, codificato] = intestazione.split(" ");
	if (schema === "Basic" && codificato && passwordGiusta(codificato, password)) {
		return NextResponse.next();
	}

	return new NextResponse("Accesso riservato", {
		status: 401,
		headers: {
			"WWW-Authenticate": 'Basic realm="Garden", charset="UTF-8"',
			"Cache-Control": "no-store",
		},
	});
}

function passwordGiusta(codificato: string, attesa: string) {
	let credenziali: string;
	try {
		const byte = Uint8Array.from(atob(codificato), (c) => c.charCodeAt(0));
		credenziali = new TextDecoder().decode(byte);
	} catch {
		return false;
	}
	const separatore = credenziali.indexOf(":");
	if (separatore < 0) return false;
	const data = credenziali.slice(separatore + 1);

	// Confronto a tempo costante sulla lunghezza fissa dei due testi.
	const a = new TextEncoder().encode(data);
	const b = new TextEncoder().encode(attesa);
	let diff = a.length ^ b.length;
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
	}
	return diff === 0;
}

export const config = {
	// Tutto tranne i file statici di Next.
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Le pagine aperte senza sessione: l'accesso, il link per scegliere la password
// e la pagina che la imposta. Tutto il resto richiede di essere entrati; chi e'
// abilitato (staff_users) lo ricontrolla poi il layout del cruscotto.
const PUBBLICHE = ['/login', '/auth/link', '/imposta-password'];

export async function middleware(request: NextRequest) {
	const inviate: { name: string; value: string; options: CookieOptions }[] = [];

	const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(daScrivere: { name: string; value: string; options: CookieOptions }[]) {
				daScrivere.forEach(({ name, value }) => request.cookies.set(name, value));
				inviate.push(...daScrivere);
			},
		},
	});

	// getClaims verifica il token in locale e rinnova la sessione scaduta.
	const { data } = await supabase.auth.getClaims();
	const entrato = typeof data?.claims?.email === 'string';
	const { pathname } = request.nextUrl;
	const pubblica = PUBBLICHE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

	if (!entrato && !pubblica) {
		return NextResponse.redirect(new URL('/login', request.url));
	}

	const risposta = NextResponse.next({ request });
	inviate.forEach(({ name, value, options }) => risposta.cookies.set(name, value, options));
	return risposta;
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/sidebar";
import { Logo } from "@/components/logo";
import { SceltaTema, scriptTema } from "@/components/tema";
import { Pwa } from "@/components/pwa";

export const metadata: Metadata = {
	title: { default: "Garden · Pannello", template: "%s · Garden" },
	description: "Pannello di gestione di Garden: abbonamenti, incassi e accessi.",
	// Dentro ci sono dati di persone: niente motori di ricerca.
	robots: { index: false, follow: false },
	// Da telefono si installa come app (manifest in app/manifest.ts).
	applicationName: "Garden",
	appleWebApp: { capable: true, title: "Garden", statusBarStyle: "default" },
	formatDetection: { telephone: false },
};

export const viewport: Viewport = {
	// cover: nell'app installata la pagina arriva fino ai bordi, i margini li dà env(safe-area-inset-*).
	viewportFit: "cover",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
		{ media: "(prefers-color-scheme: dark)", color: "#0f1311" },
	],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		// suppressHydrationWarning: lo script qui sotto mette data-theme su <html> prima di React.
		<html lang="it" className="h-full" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: scriptTema }} />
			</head>
			<body className="min-h-full">
				<Providers>
					<div className="min-h-dvh md:flex">
						<Sidebar />
						{/* relative + overflow-x-clip: le tabelle sr-only dei grafici non allargano la pagina su telefono.
						    pb-24 (+ zona della barra Home dell'iPhone): spazio per la barra di navigazione in basso su telefono */}
						<main className="relative min-w-0 flex-1 overflow-x-clip px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-6 md:px-10 md:pb-12 md:pt-10">
							{/* Su telefono la barra è in basso: logo e tema stanno in testa alla pagina. */}
							<div className="mb-5 flex items-center justify-between gap-4 md:hidden">
								<Logo className="h-11 w-auto" />
								<SceltaTema />
							</div>
							<div className="mx-auto w-full max-w-6xl">{children}</div>
						</main>
					</div>
					<Pwa />
				</Providers>
			</body>
		</html>
	);
}

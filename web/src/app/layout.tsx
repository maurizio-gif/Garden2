import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/sidebar";
import { Logo } from "@/components/logo";
import { SceltaTema, scriptTema } from "@/components/tema";

export const metadata: Metadata = {
	title: { default: "Garden · Pannello", template: "%s · Garden" },
	description: "Pannello di gestione di Garden: abbonamenti, incassi e accessi.",
	// Dentro ci sono dati di persone: niente motori di ricerca.
	robots: { index: false, follow: false },
};

export const viewport: Viewport = {
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
						{/* pb-24: spazio per la barra di navigazione in basso su telefono */}
						<main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 md:px-10 md:pb-12 md:pt-10">
							{/* Su telefono la barra è in basso: logo e tema stanno in testa alla pagina. */}
							<div className="mb-5 flex items-center justify-between gap-4 md:hidden">
								<Logo className="h-11 w-auto" />
								<SceltaTema />
							</div>
							<div className="mx-auto w-full max-w-6xl">{children}</div>
						</main>
					</div>
				</Providers>
			</body>
		</html>
	);
}

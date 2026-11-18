import type { MetadataRoute } from "next";

/**
 * Manifest della PWA: dal telefono il pannello si aggiunge alla schermata
 * Home e si apre a tutto schermo, senza la barra del browser.
 */
export default function manifest(): MetadataRoute.Manifest {
	return {
		id: "/",
		name: "Garden · Pannello",
		short_name: "Garden",
		description: "Pannello di gestione di Garden: abbonamenti, incassi e accessi.",
		lang: "it",
		start_url: "/",
		scope: "/",
		display: "standalone",
		orientation: "portrait",
		background_color: "#f6f5f1",
		theme_color: "#1d7a4f",
		icons: [
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	};
}

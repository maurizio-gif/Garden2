/*
 * Service worker del pannello Garden.
 *
 * Le pagine contengono dati di persone: NON si mettono in cache, si chiedono
 * sempre alla rete. Se la rete manca si mostra /offline.html.
 * In cache vanno solo i file statici (JS/CSS con hash, icone), che non
 * contengono dati e rendono l'apertura dell'app più veloce.
 */
const VERSIONE = "garden-v2";
const DI_BASE = ["/offline.html", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(VERSIONE)
			.then((cache) => cache.addAll(DI_BASE))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((nomi) => Promise.all(nomi.filter((n) => n !== VERSIONE).map((n) => caches.delete(n))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const richiesta = event.request;
	if (richiesta.method !== "GET") return;
	const url = new URL(richiesta.url);
	if (url.origin !== self.location.origin) return;

	// Pagine: sempre dalla rete, pagina d'attesa se offline.
	if (richiesta.mode === "navigate") {
		event.respondWith(fetch(richiesta).catch(() => caches.match("/offline.html")));
		return;
	}

	// File statici con hash nel nome: non cambiano mai, prima la cache.
	if (url.pathname.startsWith("/_next/static/") || /^\/icon-[\w-]+\.png$/.test(url.pathname)) {
		event.respondWith(
			caches.match(richiesta).then(
				(trovata) =>
					trovata ||
					fetch(richiesta).then((risposta) => {
						if (risposta.ok) {
							const copia = risposta.clone();
							caches.open(VERSIONE).then((cache) => cache.put(richiesta, copia));
						}
						return risposta;
					}),
			),
		);
	}
	// Tutto il resto (dati, export, RSC): rete, senza cache.
});

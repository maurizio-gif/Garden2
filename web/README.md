# Garden · pannello

Pannello web per Garden: panoramica con numeri e grafici, ultimi abbonamenti
venduti, ultimi passaggi ai tornelli. Legge i dati che
`ops/sync-info4u` porta da Info4U a Supabase.

Next.js 16 (App Router, Cache Components), Tailwind 4, [motion](https://motion.dev)
per le animazioni, `@supabase/supabase-js` lato server.

## Avvio

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Senza variabili d'ambiente parte con **dati di prova** inventati. Per i dati veri
copia `.env.example` in `.env.local` e compila le tre variabili.

Prima dei dati veri serve applicare la migrazione
`supabase/migrations/20261107120000_dashboard_rpc.sql`, che crea tre funzioni di
sola lettura (`dashboard_home`, `dashboard_abbonamenti_recenti`,
`dashboard_accessi_recenti`). Le può chiamare solo la `service_role`.

## Sicurezza

I dati sono di persone. Per questo:

- la chiave `service_role` sta solo sul server (`src/lib/data.ts` è `server-only`);
- se `DASHBOARD_PASSWORD` è impostata, ogni pagina chiede la password
  (`src/proxy.ts`, finestra del browser);
- **in produzione, con la chiave Supabase ma senza `DASHBOARD_PASSWORD`, il
  pannello non serve dati veri.**

È una protezione minima, non un sistema di account: il passo giusto è un login
con Supabase Auth e i permessi per ruolo.

## Dove sono le animazioni

| Effetto | File |
|---|---|
| Cambio pagina: la nuova entra sfocata e si mette a fuoco | `src/app/template.tsx` |
| Pillola della voce attiva che scorre da una voce all'altra | `src/components/sidebar.tsx` (`layoutId`) |
| Entrata a cascata di schede e righe | `src/components/motion-kit.tsx` (`Stagger`, `StaggerItem`) |
| Scheda che si solleva al passaggio del mouse; riga che scorre | `StaggerItem hover="lift" \| "nudge"` |
| Numeri che contano da 0 | `src/components/count-up.tsx` |
| Barre che crescono (colonne e barre orizzontali) | `src/components/bar-chart.tsx`, `ranked-bars.tsx` |

«Riduci movimento» del sistema è rispettato: niente spostamenti, i numeri
compaiono già finali, le barre non crescono.

## Come si contano i numeri

Le definizioni stanno nel SQL della migrazione (commento in testa), non nel
pannello. In breve: i «prodotti» escludono QUOTA ASSOCIATIVA e QUOTE EXTRA; un
abbonamento è attivo se non cancellato e oggi è tra inizio e fine (le
sospensioni non si sottraggono); «in scadenza» conta le persone il cui ultimo
prodotto finisce entro 30 giorni; le rate scadute sono quelle non pagate degli
ultimi 90 giorni; gli incassi sono netti degli storni; le date nel futuro
(Info4U ne contiene) si scartano.

Ogni pagina mostra anche **quando sono stati sincronizzati i dati** e avvisa se
il sync è fermo da più di 6 ore.

## Controlli

```bash
npm run lint && npx tsc --noEmit && npm run build
```

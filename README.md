# Garden, cruscotto

Dashboard web di Garden Sporting Center sui dati di Info4U sincronizzati su
Supabase (`ops/sync-info4u`, schema in `supabase/migrations`).

Next.js 14, solo lato server: le tabelle hanno la RLS attiva senza policy e la
pagina le legge con la service role.

## Avvio

```
cp .env.example .env.local   # poi compila i valori
npm install
npm run dev                  # http://localhost:3100
```

Variabili: `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (mai con il
prefisso `NEXT_PUBLIC_`). Senza chiave, in sviluppo `DIREZIONE_PROVA` puo'
puntare a un file JSON con i numeri della schermata.

## Direzione

I numeri arrivano da `direzione_leggi`, che legge `direzione_cache` (calcolata
da `direzione_riepilogo` ogni dieci minuti con pg_cron: la pagina legge una
riga invece di ricalcolare in 1,6 secondi): vendite e fatturato a pari giorni,
soci attivi, ultimi 12 mesi, con il confronto con l'anno prima. Chi apre dopo
mezzanotte o con una combinazione di gruppi mai calcolata la ricalcola da solo. I prodotti si raggruppano con la tabella
`prodotti_gruppi` (categoria Info4U -> gruppo): una categoria non elencata
finisce in «Altro». Si corregge con una riga SQL, senza toccare il codice.

## Accesso

Login con email e password di Supabase Auth, ma solo per chi sta in
`staff_users` (ruolo `admin` o `lettore`). **Nessuna mail parte da Supabase**:
dalla pagina Utenti un amministratore abilita una persona e il cruscotto
genera un link per scegliere la password, da mandare a mano (per esempio su
WhatsApp). Lo stesso tasto «Nuovo link» serve a chi dimentica la password.

Il link si consuma con il tasto «Continua» e non aprendo la pagina, cosi' le
anteprime di WhatsApp non lo bruciano. Vale per il tempo impostato in
Supabase Auth (di solito 1 ora, al massimo 24).

Il primo amministratore (`maurizio@ready2digital.it`) e' gia' in `staff_users`;
il suo primo link si crea con lo script:

```
SUPABASE_SERVICE_ROLE_KEY=... node --env-file=.env.local scripts/crea-utente.mjs maurizio@ready2digital.it admin
```

Il registro (`registro_accessi`) tiene accessi, link generati e modifiche ai
ruoli, mai le password.

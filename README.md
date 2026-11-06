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

I numeri arrivano da `direzione_riepilogo` (vendite e fatturato a pari giorni,
soci attivi, ultimi 12 mesi). I prodotti si raggruppano con la tabella
`prodotti_gruppi` (categoria Info4U -> gruppo): una categoria non elencata
finisce in «Altro». Si corregge con una riga SQL, senza toccare il codice.

**Prima di metterlo online serve il login**: la pagina non ha ancora nessuna
autenticazione.

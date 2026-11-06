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

## Le altre sezioni

Abbonamenti, Incassato, Vendite, Accessi, Soci e Operatori seguono lo stesso
schema della Direzione: una funzione `sez_<nome>(oggi, gruppi)` calcola un json
e `cruscotto_leggi(sezione, gruppi)` lo tiene in `cruscotto_cache`, che pg_cron
rinfresca ogni mezz'ora (gli accessi, che leggono milioni di righe, ogni ora).
Solo Abbonamenti e Vendite hanno il filtro per gruppo di prodotto.

Definizioni da conoscere (sono scelte, si cambiano nelle funzioni):

- **Rinnovo**: la persona aveva lo stesso gruppo di abbonamento finito da meno
  di 30 giorni; **ritorno** se era fermo da piu' tempo; **nuovo** se non ne aveva.
  Le quote associative non contano.
- **Sconto**: uno sconto applicato (`sconto_id`) su un prodotto non-corso. Nei
  corsi il listino e' il prezzo dell'intero corso e il totale la quota della
  lezione, quindi non e' uno sconto.
- **Disdette**: non ci sono, il gestionale di Garden non le registra; la sezione
  Vendite mostra le sospensioni.
- **Accessi**: ingressi consentiti (`tipo_accesso >= 2`). Il riferimento e'
  l'ultimo giorno caricato, finche' lo storico non e' completo.
- **Soci**: solo aggregati (eta', sesso, zona), mai nomi o recapiti.

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

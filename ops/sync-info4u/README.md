# Sincronizzazione Info4U → Supabase (Garden)

Stesso script di Ronchiverdi (`sync-abbonamenti.ps1`), puntato al progetto
Supabase di Garden e con lo storico che parte dal **1 gennaio 2016**.

Per tutto il resto (utente SQL di sola lettura, copia dello script sul
server, schedulazione ogni 5 minuti, log) vale la guida di Ronchiverdi:
`ops/sync-info4u/README.md` di quel repository.

## Cosa cambia rispetto a Ronchiverdi

- **Schema**: `supabase/migrations/20261105090000_baseline_info4u.sql`. Solo le
  tabelle che il sync scrive (persone, abbonamenti, rate, transazioni,
  modifiche, sospensioni, accessi, certificati, prenotazioni, corsi, omaggi,
  ricevute, quote, CRM di Info4U, anagrafiche di servizio, stato del sync).
  Restano fuori sito, staff, ticket, email SendGrid, voucher, personal
  training, tesseramento CSI e i report di Ronchiverdi.
- **`trova_o_crea_persona`**: stessa firma, ma a Garden non c'è nessuna fonte
  oltre a Info4U. Trova la scheda per `source_utente_id` o la crea, senza la
  deduplicazione per nome e cellulare.
- **Data di partenza**: `TransazioniDal` (default `2016-01-01`) vale per
  vendite, cassa, rate, modifiche e tabelle extra. Le vendite entrano se
  fatte da quella data **o** ancora valide da quella data, così un annuale
  venduto a dicembre 2015 non manca.
- **Date in SQL Server**: il server è in italiano, le date si scrivono
  `'20160101'`, mai `'2016-01-01'` (vedi `mappa-dbgym.md`).

## Configurare

Copia `config.example.json` in `config.json` e metti password dell'utente SQL
e service role key del progetto Garden. **Non committare `config.json`.**

## Da fare dopo la prima corsa

- Le tabelle di report di Ronchiverdi (`abbonamenti_gruppi`,
  `abbonamenti_mappatura`, `abbonamenti_macro_settori`, obiettivi) non sono
  state portate: servono quando si costruisce il pannello di Garden.
- Sospensioni, `Accessi` e le altre tabelle «extra» di Garden hanno volumi
  doppi rispetto a Ronchiverdi (6,5 milioni di accessi in tutto): il primo
  carico richiede più giri.

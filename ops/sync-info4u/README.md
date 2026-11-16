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

## Due attività pianificate (dal 16 novembre 2026)

Dall'11 al 16 novembre 2026 il sync si è fermato: nel giro da 5 minuti lo
script rileggeva ogni 6 ore tutta `crm_pratiche` (~700.000 righe) in una volta
sola, il processo restava appeso per ore con 3-4 GB di memoria e Windows non
faceva partire i giri successivi. Ora:

- **giro da 5 minuti** (l'attività che c'è già, senza parametri): vendite,
  cassa, rate, modifiche, persone senza acquisti e passaggi ai tornelli di
  oggi (`accessi_corrente`, a blocchi da 2.000). Dura pochi secondi. Persone e
  tornelli girano anche con `"ExtraAttivo": false`, che spegne solo la parte
  pesante.
- **giro notturno** (attività nuova): gli altri dati aggiuntivi (CRM, email,
  certificati, prenotazioni, ricevute, archivio storico degli accessi) con `-Extra`. Si ferma da solo
  dopo `ExtraMaxMinuti` (50) e il giro dopo riprende da dove era arrivato;
  `crm_pratiche` si riscrive a blocchi da 2.000 righe, al più una volta al
  giorno.
- ogni chiamata ha un tempo massimo: 120 secondi verso Supabase
  (`TimeoutHttpSecondi`), 300 secondi per una query su Info4U
  (`TimeoutSqlSecondi`).

### Aggiornare il server

1. Sostituisci `C:\Scripts\sync-garden\sync-abbonamenti.ps1` con la versione
   nuova di questo repository.
2. In `config.json` togli la riga `"ExtraAttivo": false,` se l'avevi messa
   (oppure mettila a `true`).
3. Prova il giro notturno a mano e guarda che scriva una riga per tabella:

   ```powershell
   cd C:\Scripts\sync-garden
   powershell -NoProfile -ExecutionPolicy Bypass -File .\sync-abbonamenti.ps1 -Extra
   ```

4. Crea l'attività notturna (PowerShell come amministratore; utente e
   password sono quelli con cui gira già l'attività da 5 minuti):

   ```powershell
   $azione = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\Scripts\sync-garden\sync-abbonamenti.ps1" -Extra'
   $quando = New-ScheduledTaskTrigger -Daily -At 2:00
   $regole = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
   Register-ScheduledTask -TaskName "Garden sync dati aggiuntivi" -Action $azione -Trigger $quando -Settings $regole -User "UTENTE" -Password "PASSWORD"
   ```

5. Sull'attività da 5 minuti imposta anche un tempo massimo (in Utilità di
   pianificazione → Impostazioni → «Arresta l'attività se viene eseguita per
   più di» 30 minuti): se un giro si pianta, Windows lo chiude e quello dopo
   riparte.

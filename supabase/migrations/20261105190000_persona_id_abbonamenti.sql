-- Correzione alla migrazione persone_trigger.
--
-- zz_salta_update_identici su persone scartava le riscritture identiche, ma in
-- un upsert con return=representation una riga scartata non torna nella
-- risposta: il sync non conosceva l'id di quella persona e scriveva la vendita
-- con persona_id vuoto (a ogni acquisto di una persona gia' presente e
-- invariata). Si toglie il trigger: la riscrittura identica costa poco e
-- aggiornato_il non cambia comunque (lo decide persone_prima_di_scrivere).
drop trigger if exists zz_salta_update_identici on public.persone;

-- In piu', come per le altre tabelle di Info4U, la vendita prende da sola la
-- persona con quel source_utente_id quando il sync non gliela passa.
create trigger abbonamenti_imposta_persona
	before insert or update of source_utente_id, persona_id on public.abbonamenti
	for each row execute function public.info4u_imposta_persona();

-- Recupero delle vendite gia' scritte senza persona.
update public.abbonamenti a
set persona_id = p.id
from public.persone p
where p.source_utente_id = a.source_utente_id
	and a.persona_id is null;

-- Garden: i trigger di Ronchiverdi che legano le righe di Info4U alla persona
-- (persona_id) e sistemano i dati della scheda. Servono al sync, che scrive le
-- persone in blocco con un upsert su source_utente_id e non imposta persona_id
-- sulle altre tabelle.

-- ──────────────────────────────────────────── scheda della persona

-- Prima di ogni scrittura su persone: email minuscola, cellulare_norm sempre
-- coerente con cellulare, aggiornato_il solo se la scheda e' cambiata davvero
-- (cosi' zz_salta_update_identici scarta le riscritture identiche del sync).
create or replace function public.persone_prima_di_scrivere()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
	new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
	new.cellulare_norm := normalizza_cellulare(new.cellulare);
	if tg_op = 'UPDATE'
		and (to_jsonb(new) - 'aggiornato_il') is distinct from (to_jsonb(old) - 'aggiornato_il') then
		new.aggiornato_il := now();
	end if;
	return new;
end;
$$;

create trigger persone_prima_di_scrivere
	before insert or update on public.persone
	for each row execute function public.persone_prima_di_scrivere();

create trigger zz_salta_update_identici
	before update on public.persone
	for each row execute function suppress_redundant_updates_trigger();

-- ───────────────────────────────── persona_id sulle righe di Info4U

-- Riga nuova (o con source_utente_id cambiato): prende la persona che ha quel
-- source_utente_id, se c'e' gia'.
create or replace function public.info4u_imposta_persona()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
	if new.persona_id is null and new.source_utente_id is not null then
		select p.id into new.persona_id from public.persone p where p.source_utente_id = new.source_utente_id;
	end if;
	return new;
end;
$$;

create trigger abbonamenti_modifiche_imposta_persona before insert or update of source_utente_id on public.abbonamenti_modifiche for each row execute function public.info4u_imposta_persona();
create trigger transazioni_imposta_persona before insert or update of source_utente_id on public.transazioni for each row execute function public.info4u_imposta_persona();
create trigger crm_pratiche_imposta_persona before insert or update of source_utente_id on public.crm_pratiche for each row execute function public.info4u_imposta_persona();
create trigger crm_memo_imposta_persona before insert or update of source_utente_id on public.crm_memo for each row execute function public.info4u_imposta_persona();
create trigger email_info4u_imposta_persona before insert or update of source_utente_id on public.email_info4u for each row execute function public.info4u_imposta_persona();
create trigger certificati_imposta_persona before insert or update of source_utente_id on public.certificati for each row execute function public.info4u_imposta_persona();
create trigger quote_associative_imposta_persona before insert or update of source_utente_id on public.quote_associative for each row execute function public.info4u_imposta_persona();
create trigger prenotazioni_iscrizioni_imposta_persona before insert or update of source_utente_id on public.prenotazioni_iscrizioni for each row execute function public.info4u_imposta_persona();
create trigger corsi_iscrizioni_imposta_persona before insert or update of source_utente_id on public.corsi_iscrizioni for each row execute function public.info4u_imposta_persona();
create trigger omaggi_iscrizioni_imposta_persona before insert or update of source_utente_id on public.omaggi_iscrizioni for each row execute function public.info4u_imposta_persona();
create trigger ricevute_imposta_persona before insert or update of source_utente_id on public.ricevute for each row execute function public.info4u_imposta_persona();

-- Il contrario: una persona nuova (o con source_utente_id cambiato) prende le
-- righe che aspettavano la sua scheda. Va solo sulle schede nuove o con ID
-- cambiato, non a ogni riscrittura identica dell'upsert.
create or replace function public.info4u_collega_persona_nuova()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
	t text;
begin
	if new.source_utente_id is null then
		return new;
	end if;
	if tg_op = 'UPDATE' and old.source_utente_id is not distinct from new.source_utente_id then
		return new;
	end if;

	foreach t in array array[
		'abbonamenti', 'abbonamenti_modifiche', 'transazioni',
		'crm_pratiche', 'crm_memo', 'email_info4u', 'certificati', 'quote_associative',
		'prenotazioni_iscrizioni', 'corsi_iscrizioni', 'omaggi_iscrizioni', 'ricevute'
	] loop
		execute format(
			'update public.%I set persona_id = $1
			 where source_utente_id = $2 and persona_id is distinct from $1', t)
		using new.id, new.source_utente_id;
	end loop;
	return new;
end;
$$;

create trigger persone_collega_info4u
	after insert or update of source_utente_id on public.persone
	for each row execute function public.info4u_collega_persona_nuova();

-- Serve al trigger qui sopra: le altre tabelle hanno gia' il loro indice.
create index abbonamenti_modifiche_utente_idx on public.abbonamenti_modifiche (source_utente_id);

revoke execute on function public.info4u_collega_persona_nuova() from public, anon, authenticated;
revoke execute on function public.info4u_imposta_persona() from public, anon, authenticated;
revoke execute on function public.persone_prima_di_scrivere() from public, anon, authenticated;

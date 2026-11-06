-- Accesso al cruscotto: chi e' abilitato e il registro di cosa succede. Le
-- credenziali stanno in Supabase Auth; qui c'e' solo l'elenco degli
-- abilitati (come staff_users di Athlon e del CRM di Ronchiverdi). Le tabelle
-- hanno la RLS attiva senza policy: le legge solo il server con la service role.

create table public.staff_users (
	email text primary key check (email = lower(btrim(email))),
	nome text,
	cognome text,
	ruolo text not null default 'lettore' check (ruolo in ('admin', 'lettore')),
	attivo boolean not null default true,
	creato_il timestamptz not null default now(),
	creato_da text,
	ultimo_accesso timestamptz
);
alter table public.staff_users enable row level security;

create table public.registro_accessi (
	id bigint generated always as identity primary key,
	creato_il timestamptz not null default now(),
	email text,
	azione text not null,
	dettagli jsonb
);
alter table public.registro_accessi enable row level security;
create index registro_accessi_creato_il_idx on public.registro_accessi (creato_il desc);

-- Il primo amministratore: gli altri li abilita lui dalla pagina Utenti.
insert into public.staff_users (email, ruolo, creato_da)
values ('maurizio@ready2digital.it', 'admin', 'migrazione');

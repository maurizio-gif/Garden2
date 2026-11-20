-- «Incassato» comprende anche i pagamenti Amministrazione e Banca.
--
-- In Info4U questi due metodi non movimentano la cassa fisica
-- (CassaTipiPagamenti.MovimentaCassa = 0, tab «No cassa» dei Movimenti di
-- cassa), ma per Garden sono incassi veri: TeamSystem li conta nei Movimenti
-- di cassa e senza di loro mancavano ~69.000 € dal 1 gennaio al 16 novembre
-- 2026 (Amministrazione 69.022 €, Banca 200 €).
--
-- Resta fuori il borsellino: è credito già incassato con un altro metodo
-- quando è stato caricato, contarlo di nuovo lo raddoppierebbe.
--
-- La regola sta in una sola funzione, public.e_incassato(), che il planner
-- espande in linea (sql, immutable). Le funzioni del pannello che filtravano
-- su t.movimenta_cassa vengono riscritte sostituendo quel filtro, partendo
-- dalla definizione che c'è nel database (così vale anche per funzioni create
-- fuori dalle migration, come sez_incassato). Rieseguirla non fa nulla: il
-- filtro già avvolto in e_incassato( non viene toccato di nuovo.

create or replace function public.e_incassato(p_movimenta_cassa boolean, p_metodo text)
returns boolean
language sql
immutable
parallel safe
as $$
	select coalesce(p_movimenta_cassa, false)
		or coalesce(lower(p_metodo) in ('amministrazione', 'banca'), false)
$$;

comment on function public.e_incassato(boolean, text) is
	'true se il movimento di cassa conta come incassato: movimenta cassa in Info4U, oppure è pagato con Amministrazione o Banca. Il borsellino resta fuori.';

do $$
declare
	f record;
	def text;
	nuova text;
begin
	for f in
		select p.oid, p.proname
		from pg_proc p
		join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public'
			and p.prokind = 'f'
			and p.proname <> 'e_incassato'
			and pg_get_functiondef(p.oid) ~ '(?<!e_incassato\()\mt\.movimenta_cassa\M'
	loop
		def := pg_get_functiondef(f.oid);
		nuova := regexp_replace(def, '(?<!e_incassato\()\mt\.movimenta_cassa\M',
			'public.e_incassato(t.movimenta_cassa, t.metodo_pagamento)', 'g');
		-- etichetta del metodo nelle pagine Finanza e Incassi: Amministrazione e
		-- Banca hanno la loro voce invece di finire in «Altro»
		nuova := replace(nuova,
			'in (''contanti'', ''bancomat'', ''bonifico'', ''finanziamento'')',
			'in (''contanti'', ''bancomat'', ''bonifico'', ''finanziamento'', ''amministrazione'', ''banca'')');
		execute nuova;
		raise notice 'riscritta %', f.proname;
	end loop;
end
$$;

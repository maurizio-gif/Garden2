-- Cruscotto Direzione: l'elenco delle ultime vendite, con il nominativo.
--
-- Non sta nella cache della Direzione (che si rinfresca ogni dieci minuti):
-- si legge dal vivo, e costa pochi millisecondi perche' prende le ultime righe
-- per data di vendita. Tutte le vendite di oggi, e comunque almeno le ultime
-- `p_minime` quando la giornata e' tranquilla, fino a `p_massime`.
-- Le date nel futuro (ce ne sono due nel gestionale, nel 2208 e nel 2707) non
-- contano come vendite recenti.
-- Il campo ultime_vendite di direzione_riepilogo non si usa piu': resta nella
-- cache, senza nominativi.

create or replace function public.direzione_ultime_vendite(
	p_gruppi text[] default null,
	p_minime integer default 12,
	p_massime integer default 60
)
returns jsonb
language sql stable
set search_path to 'public'
as $$
with
oggi as (select public.direzione_oggi() as giorno),
ultime as (
	select
		a.data_vendita, a.abbonamento, a.totale,
		coalesce(g.gruppo, 'Altro') as gruppo,
		p.nome, p.cognome,
		coalesce(nullif(btrim(a.venditore_nome), ''), nullif(btrim(a.operatore_nome), '')) as venduto_da,
		(a.data_vendita at time zone 'Europe/Rome')::date = o.giorno as di_oggi,
		row_number() over (order by a.data_vendita desc) as pos
	from public.abbonamenti a
	cross join oggi o
	left join public.prodotti_gruppi g on g.categoria = a.categoria
	left join public.persone p on p.id = a.persona_id
	where a.cancellato_il is null
		and a.data_vendita <= now()
		and (p_gruppi is null or coalesce(g.gruppo, 'Altro') = any (p_gruppi))
	order by a.data_vendita desc
	limit p_massime
)
select coalesce(jsonb_agg(
	jsonb_build_object(
		'data_vendita', data_vendita, 'abbonamento', abbonamento, 'totale', totale, 'gruppo', gruppo,
		'nome', nome, 'cognome', cognome, 'venduto_da', venduto_da, 'di_oggi', di_oggi
	) order by data_vendita desc
), '[]'::jsonb)
from ultime
where di_oggi or pos <= p_minime;
$$;

revoke execute on function public.direzione_ultime_vendite(text[], integer, integer) from public, anon, authenticated;
grant execute on function public.direzione_ultime_vendite(text[], integer, integer) to service_role;

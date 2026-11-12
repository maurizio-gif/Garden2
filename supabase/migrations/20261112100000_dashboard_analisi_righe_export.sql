-- L'elenco delle vendite della pagina Analisi serve anche per l'esportazione in
-- CSV: alza il tetto di righe per chiamata da 200 a 20.000. Il pannello ne
-- chiede 50 per pagina, l'esportazione tutte quelle del filtro (fino al tetto).

create or replace function public.dashboard_analisi_righe(
	p_filtri jsonb,
	p_limite integer default 50,
	p_salta integer default 0,
	p_ordine text default 'data'
)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
	with b as (
		select * from public.dashboard_base(p_filtri)
	),
	pagina as (
		select * from b
		order by
			case when p_ordine = 'importo' then b.totale end desc nulls last,
			b.data_vendita desc nulls last,
			b.id
		limit least(greatest(coalesce(p_limite, 50), 1), 20000)
		offset greatest(coalesce(p_salta, 0), 0)
	)
	select jsonb_build_object(
		'totale', (select count(*) from b),
		'righe', coalesce((
			select jsonb_agg(jsonb_build_object(
				'vendita', p.data_vendita, 'inizio', p.data_inizio, 'fine', p.data_fine,
				'nome', p.nome, 'cognome', p.cognome,
				'abbonamento', p.abbonamento, 'categoria', p.categoria, 'gruppo', p.gruppo,
				'durata', p.durata_etichetta, 'operatore', p.operatore, 'totale', p.totale
			) order by
				case when p_ordine = 'importo' then p.totale end desc nulls last,
				p.data_vendita desc nulls last, p.id)
			from pagina p
		), '[]'::jsonb)
	);
$$;

revoke execute on function public.dashboard_analisi_righe(jsonb, integer, integer, text) from public, anon, authenticated;
grant execute on function public.dashboard_analisi_righe(jsonb, integer, integer, text) to service_role;

/** Un colore per gruppo, lo stesso in tutti i grafici; sabbia e grigio per quote e altro. */
const COLORI: Record<string, string> = {
	'Fitness e wellness': '#0f9d6b',
	'Nuoto': '#1ba8e0',
	'Corsi': '#f2a516',
	'Junior e camp': '#ff7a59',
	'Personal training': '#7c5cff',
	'Quote e tessere': '#c9d1cc',
	'Altro': '#aab4af',
	// Abbonamenti: tipo di vendita e rinnovo
	'Nuovi': '#0f9d6b',
	'Rinnovi': '#1ba8e0',
	'Ritorni': '#f2a516',
	'Rinnovati': '#0f9d6b',
	'Non rinnovati': '#ff7a59',
	'Da rinnovare': '#ff7a59',
	// Incassato: metodo di pagamento e servizio
	'Contanti': '#f2a516',
	'Carte e bancomat': '#1ba8e0',
	'RID e bonifici': '#0f9d6b',
	'Assegni': '#7c5cff',
	'Abbonamenti': '#0f9d6b',
	'Campi e prenotazioni': '#1ba8e0',
	'Shop': '#ff7a59',
	'Bar e borsellino': '#7c5cff',
	// serie singole
	'Accessi': '#1ba8e0',
	'Sospensioni': '#7c5cff',
	'Nuovi iscritti': '#0f9d6b',
	'Soci': '#0f9d6b',
};
/** Colori per serie senza un colore fisso (gli operatori): si assegnano in ordine. */
export const PALETTE = ['#0f9d6b', '#1ba8e0', '#f2a516', '#ff7a59', '#7c5cff', '#e0559b', '#aab4af'];

export const coloreGruppo = (gruppo: string) => COLORI[gruppo] ?? '#aab4af';

/** «Nuoto,Corsi» -> ['Nuoto', 'Corsi'], solo i gruppi che esistono; null = tutti. */
export function leggiGruppi(param: string | undefined, validi: string[]): string[] | null {
	if (!param) return null;
	const scelti = param.split(',').filter((g) => validi.includes(g));
	return scelti.length > 0 && scelti.length < validi.length ? scelti : null;
}

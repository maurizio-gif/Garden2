/** Verdi a scalare per i gruppi di prodotto; sabbia e grigio per quote e altro. */
const COLORI: Record<string, string> = {
	'Fitness e wellness': '#14372b',
	'Nuoto': '#2f8f63',
	'Corsi': '#4cbf7c',
	'Junior e camp': '#8cc9a6',
	'Personal training': '#bfe0cd',
	'Quote e tessere': '#d8cfb8',
	'Altro': '#c3c9c5',
};

export const coloreGruppo = (gruppo: string) => COLORI[gruppo] ?? '#c3c9c5';

/** «Nuoto,Corsi» -> ['Nuoto', 'Corsi'], solo i gruppi che esistono; null = tutti. */
export function leggiGruppi(param: string | undefined, validi: string[]): string[] | null {
	if (!param) return null;
	const scelti = param.split(',').filter((g) => validi.includes(g));
	return scelti.length > 0 && scelti.length < validi.length ? scelti : null;
}

/** Un colore per gruppo, lo stesso in tutti i grafici; sabbia e grigio per quote e altro. */
const COLORI: Record<string, string> = {
	'Fitness e wellness': '#0f9d6b',
	'Nuoto': '#1ba8e0',
	'Corsi': '#f2a516',
	'Junior e camp': '#ff7a59',
	'Personal training': '#7c5cff',
	'Quote e tessere': '#c9d1cc',
	'Altro': '#aab4af',
};

export const coloreGruppo = (gruppo: string) => COLORI[gruppo] ?? '#aab4af';

/** «Nuoto,Corsi» -> ['Nuoto', 'Corsi'], solo i gruppi che esistono; null = tutti. */
export function leggiGruppi(param: string | undefined, validi: string[]): string[] | null {
	if (!param) return null;
	const scelti = param.split(',').filter((g) => validi.includes(g));
	return scelti.length > 0 && scelti.length < validi.length ? scelti : null;
}

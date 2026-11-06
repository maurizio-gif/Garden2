const intero = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' });
const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' });
const percentuale = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatIntero = (n: number) => intero.format(n);
export const formatEuro = (n: number) => euro.format(n);

/** Variazione in percentuale di `ora` rispetto a `prima`; null se non c'e' un termine di confronto. */
export function variazione(ora: number, prima: number): number | null {
	if (!prima) return null;
	return ((ora - prima) / prima) * 100;
}

export function formatVariazione(v: number | null): string {
	if (v === null) return '—';
	const segno = v > 0 ? '+' : v < 0 ? '−' : '';
	return `${segno}${percentuale.format(Math.abs(v))}%`;
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** «2026-03-01» -> «mar» */
export const meseBreve = (iso: string) => MESI[Number(iso.slice(5, 7)) - 1];

/** «2026-03-01» -> «2026» */
export const annoDi = (iso: string) => iso.slice(0, 4);

const dataLunga = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });
export const formatData = (iso: string) => dataLunga.format(new Date(`${iso}T12:00:00`));

const orario = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
const giornoBreve = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' });
export const formatOrario = (iso: string) => orario.format(new Date(iso));
export const formatGiornoBreve = (iso: string) => giornoBreve.format(new Date(iso));

export type Formato = 'intero' | 'euro' | 'euroBreve' | 'percento';

/** Il formato si passa per nome ai componenti client: una funzione non attraversa il confine con il server. */
export function formattaPer(formato: Formato, n: number): string {
	if (formato === 'euro') return formatEuro(n);
	if (formato === 'percento') return `${new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)}%`;
	if (formato === 'euroBreve') {
		if (Math.abs(n) >= 1_000_000) return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(n / 1_000_000)} M€`;
		return Math.abs(n) >= 1000 ? `${formatIntero(n / 1000)}k €` : `${formatIntero(n)} €`;
	}
	return formatIntero(n);
}

/** Saluto in base all'ora di Roma. */
export function saluto(adesso: Date = new Date()): string {
	const ora = Number(new Intl.DateTimeFormat('it-IT', { hour: 'numeric', hour12: false, timeZone: 'Europe/Rome' }).format(adesso));
	return ora < 13 ? 'Buongiorno' : ora < 18 ? 'Buon pomeriggio' : 'Buonasera';
}

const giornoSettimana = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' });
export const formatGiornoLungo = (d: Date) => giornoSettimana.format(d);

/** «ROSSI» -> «Rossi», «de luca» -> «De Luca», «D'ANGELO» -> «D'Angelo». */
export const capitalizza = (t: string) => t.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase());

export function nominativo(nome: string | null, cognome: string | null): string {
	const intero = [nome, cognome].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
	return intero ? capitalizza(intero) : 'Cliente non collegato';
}

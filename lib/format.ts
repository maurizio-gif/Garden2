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

import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
	subsets: ['latin'],
	weight: ['400', '500', '600'],
	variable: '--font-poppins',
	display: 'swap',
});

export const metadata: Metadata = {
	title: 'Cruscotto Garden',
	description: 'I numeri del club, sempre aggiornati.',
	robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="it" className={poppins.variable}>
			<body>{children}</body>
		</html>
	);
}

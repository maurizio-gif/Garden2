/** @type {import('next').NextConfig} */
const nextConfig = {
	// Il cruscotto e' interno: niente indicizzazione.
	async headers() {
		return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
	},
};

export default nextConfig;

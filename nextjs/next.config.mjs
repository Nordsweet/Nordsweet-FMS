/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: false,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};
export default function configure(phase) {
  if (phase === 'phase-development-server') {
    return { ...nextConfig, output: undefined, rewrites: async () => [
      { source: '/index.html', destination: '/' },
      { source: '/:tool.html', destination: '/:tool' },
    ] };
  }
  return nextConfig;
}

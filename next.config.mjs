/** Header keamanan untuk semua halaman. */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Test E2E memakai folder build sendiri supaya tidak bentrok dengan `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  experimental: {
    // Unggah foto produk lewat Server Action (batas bawaan hanya 1 MB).
    serverActions: { bodySizeLimit: '4mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

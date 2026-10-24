import type { NextConfig } from 'next';

// Baseline security headers (security.md §3.5). Nonce-based CSP lands with P9 hardening.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
];

const config: NextConfig = {
  transpilePackages: ['@ms/engine', '@ms/content', '@ms/ui'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;

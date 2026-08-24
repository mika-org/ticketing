import type { NextConfig } from 'next';

const next_config: NextConfig = {
  poweredByHeader: false,
  experimental: { optimizePackageImports: ['lucide-react'] },
};

export default next_config;

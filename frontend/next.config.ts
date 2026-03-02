import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: false,
  outputFileTracingRoot: __dirname,
  distDir: '.next',
  experimental: {
    optimizePackageImports: ['@mantine/core', '@tabler/icons-react'],
  },
};

export default nextConfig;

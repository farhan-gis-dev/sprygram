const net = require('net');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const HOST = 'localhost';
const PORT = 5177;
const CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'sprygram-spa';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || `http://${HOST}:${PORT}`;
const DEV_DIST_DIR = '.next';
const REDIRECT_URI = process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI || `${APP_URL}/auth/oidc/callback`;
const POST_LOGOUT_REDIRECT_URI =
  process.env.NEXT_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI || `${APP_URL}/profiles`;
const OIDC_SCOPE = process.env.NEXT_PUBLIC_OIDC_SCOPE || 'openid profile email';

const checkPortAvailable = (port, host) =>
  new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });

const run = async () => {
  const available = await checkPortAvailable(PORT, HOST);

  if (!available) {
    console.error(
      `[sprysnap] Port ${PORT} is busy. Stop the process using ${PORT} and rerun npm run dev.`,
    );
    process.exit(1);
  }

  const cacheDirs = ['.next', '.next-dev'];
  for (const cacheDir of cacheDirs) {
    const resolved = path.join(__dirname, '..', cacheDir);
    if (fs.existsSync(resolved)) {
      fs.rmSync(resolved, { recursive: true, force: true });
      console.log(`[sprysnap] Cleared ${cacheDir} cache`);
    }
  }

  console.log(`[sprysnap] Starting on ${APP_URL}`);
  console.log(`[sprysnap] OIDC client: ${CLIENT_ID}`);
  console.log(`[sprysnap] OIDC redirect: ${REDIRECT_URI}`);
  console.log(`[sprysnap] Next dist dir: ${DEV_DIST_DIR}`);

  const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'dev', '-p', String(PORT), '-H', HOST], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: CLIENT_ID,
      NEXT_PUBLIC_APP_URL: APP_URL,
      NEXT_DIST_DIR: DEV_DIST_DIR,
      NEXT_PUBLIC_OIDC_REDIRECT_URI: REDIRECT_URI,
      NEXT_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI: POST_LOGOUT_REDIRECT_URI,
      NEXT_PUBLIC_OIDC_SCOPE: OIDC_SCOPE,
    },
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });
};

run().catch((err) => {
  console.error('[sprysnap] Failed to start dev server:', err);
  process.exit(1);
});

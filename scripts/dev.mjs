#!/usr/bin/env node
// Run Voxora for development: ASP.NET Core API + Angular dev server, over HTTPS.
// Works on Windows, Linux and macOS.
//
//   npm run dev        # https://localhost:4200
//   npm run dev:lan    # also reachable from other devices on the network
//
//   browser --https--> Angular dev server (:4200, cert in .certs/)
//           --https--> API (:7239)  via proxy.conf.json (/api, /hubs)
//
// Certificates:
//   - mkcert installed (+ `mkcert -install` run once): trusted cert for
//     localhost, 127.0.0.1 and your LAN IP. Required for --lan without warnings.
//   - otherwise: the ASP.NET Core dev cert is exported (localhost only). Trust it
//     once with `dotnet dev-certs https --trust` (Windows/macOS).

import { spawn, spawnSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_PROJECT = path.join(ROOT, 'Voxora.Api');
const API_PORT = 7239;
const API_HTTP_PORT = 5286;
const WEB_PORT = 4200;
const API_URL = `https://localhost:${API_PORT}`;
const CERT_DIR = path.join(ROOT, '.certs');
const CERT = path.join(CERT_DIR, 'dev-cert.pem');
const KEY = path.join(CERT_DIR, 'dev-key.pem');
const IS_WIN = process.platform === 'win32';

const LAN = process.argv.includes('--lan');
const HOST = LAN ? '0.0.0.0' : 'localhost';

const log = msg => console.log(`==> ${msg}`);
const warn = msg => console.warn(`Warning: ${msg}`);
function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

// Run a command synchronously. No shell, so paths with spaces stay intact
// (dotnet/mkcert/where are real executables on Windows too).
function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

function hasCommand(cmd) {
  const r = run(IS_WIN ? 'where' : 'which', [cmd]);
  return r.status === 0;
}

function portInUse(port) {
  const tryHost = host => new Promise(resolve => {
    const socket = net.connect({ port, host });
    socket.setTimeout(500);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
  // Check IPv4 and IPv6 loopback: `localhost` may bind to either.
  return Promise.all([tryHost('127.0.0.1'), tryHost('::1')])
    .then(([v4, v6]) => v4 || v6);
}

function lanIp() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return '';
}

// ---- Certificates ----------------------------------------------------------

function mkcertCaRoot() {
  if (!hasCommand('mkcert')) return null;
  const r = run('mkcert', ['-CAROOT']);
  const dir = r.stdout?.trim();
  return dir ? path.join(dir, 'rootCA.pem') : null;
}

function certIsUsable(requiredNames, caFile) {
  if (!fs.existsSync(CERT) || !fs.existsSync(KEY)) return false;
  let cert;
  try {
    cert = new X509Certificate(fs.readFileSync(CERT));
  } catch {
    return false;
  }
  // Renew if expiring within a day.
  if (new Date(cert.validTo).getTime() - Date.now() < 24 * 3600 * 1000) return false;

  const sans = cert.subjectAltName ?? '';
  if (!requiredNames.every(name => sans.includes(name))) return false;

  // With mkcert available, replace certs its CA did not sign.
  if (caFile && fs.existsSync(caFile)) {
    try {
      const ca = new X509Certificate(fs.readFileSync(caFile));
      if (!cert.checkIssued(ca) || !cert.verify(ca.publicKey)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function ensureWebCert(ip) {
  const caFile = mkcertCaRoot();
  const useMkcert = caFile !== null;

  const names = ['localhost', '127.0.0.1'];
  if (useMkcert && ip) names.push(ip);

  if (certIsUsable(useMkcert ? names : ['localhost'], useMkcert ? caFile : null)) {
    return;
  }

  fs.mkdirSync(CERT_DIR, { recursive: true });

  if (useMkcert) {
    log(`Creating trusted dev certificate with mkcert for: ${names.join(' ')}`);
    if (!fs.existsSync(caFile)) {
      warn('mkcert CA not installed yet. Run `mkcert -install` once (as your normal user).');
    }
    const r = run('mkcert', ['-cert-file', CERT, '-key-file', KEY, ...names], { stdio: 'inherit' });
    if (r.status !== 0) fail('mkcert failed to create the certificate.');
    return;
  }

  log('mkcert not found: using the ASP.NET Core dev certificate (localhost only).');
  const base = path.join(CERT_DIR, 'dev-cert');
  const r = run('dotnet', [
    'dev-certs', 'https', '--export-path', `${base}.pem`, '--format', 'Pem', '--no-password'
  ]);
  if (r.status !== 0 || !fs.existsSync(`${base}.key`)) {
    fail(`could not export the ASP.NET Core dev certificate.\n${r.stdout ?? ''}${r.stderr ?? ''}`);
  }
  fs.renameSync(`${base}.key`, KEY);
  if (LAN) {
    warn('this certificate only covers localhost. Other devices will see a certificate ' +
      'warning; install mkcert for a certificate that includes your LAN IP.');
  }
}

function ensureApiCert() {
  if (run('dotnet', ['dev-certs', 'https', '--check']).status !== 0) {
    log('Creating ASP.NET Core HTTPS development certificate...');
    run('dotnet', ['dev-certs', 'https'], { stdio: 'inherit' });
  }
  if (!IS_WIN && process.platform !== 'darwin') return;
  // On Windows/macOS also make sure it is trusted (shows a one-time OS prompt).
  if (run('dotnet', ['dev-certs', 'https', '--check', '--trust']).status !== 0) {
    log('Trusting the ASP.NET Core dev certificate (confirm the OS prompt)...');
    run('dotnet', ['dev-certs', 'https', '--trust'], { stdio: 'inherit' });
  }
}

// ---- Processes ---------------------------------------------------------------

const children = [];
let stopping = false;

function start(label, cmd, args) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    shell: false,
    // Own process group on POSIX so we can kill the whole tree.
    detached: !IS_WIN,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' }
  });
  for (const stream of [child.stdout, child.stderr]) {
    readline.createInterface({ input: stream }).on('line', line => {
      console.log(`[${label}] ${line}`);
    });
  }
  child.on('exit', code => {
    if (!stopping) {
      console.error(`[${label}] exited with code ${code}`);
      stop(code || 1);
    }
  });
  children.push(child);
  return child;
}

function killTree(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  try {
    if (IS_WIN) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    // already gone
  }
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log('\n==> Stopping...');
  children.forEach(killTree);
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
process.on('SIGHUP', () => stop(0));

function getHealth() {
  return new Promise(resolve => {
    const req = https.get(`${API_URL}/api/health/database`,
      { rejectUnauthorized: false, timeout: 2000 },
      res => {
        let body = '';
        res.on('data', d => (body += d));
        res.on('end', () => resolve(res.statusCode === 200 ? body : null));
      });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- Main -------------------------------------------------------------------

async function main() {
  if (!hasCommand('dotnet')) fail("'dotnet' is not installed (https://dotnet.microsoft.com/download).");

  for (const port of [API_PORT, API_HTTP_PORT, WEB_PORT]) {
    if (await portInUse(port)) fail(`port ${port} is already in use. Stop the other process first.`);
  }

  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    log('Installing npm packages...');
    // npm is a .cmd script on Windows, which needs a shell.
    const r = run('npm', ['install'], { cwd: ROOT, stdio: 'inherit', shell: IS_WIN });
    if (r.status !== 0) fail('npm install failed.');
  }

  const ip = lanIp();
  ensureWebCert(ip);
  ensureApiCert();

  log(`Starting API on ${API_URL} ...`);
  const api = start('api', 'dotnet', [
    'run', '--project', API_PROJECT, '--launch-profile', 'https',
    // Works around NETSDK1226 on some Linux SDK installs; harmless elsewhere.
    '-p:AllowMissingPrunePackageData=true'
  ]);

  log('Waiting for API to come up...');
  let health = null;
  for (let i = 0; i < 120 && !health; i++) {
    if (api.exitCode !== null) return; // exit handler already reported it
    health = await getHealth();
    if (!health) await sleep(1000);
  }
  if (!health) {
    console.error('Error: API did not respond within 120 seconds.');
    return stop(1);
  }

  log(`API is up. Database: ${health}`);
  if (!health.includes('"connected":true')) {
    warn('database is not reachable. Is MySQL running? (see Voxora.Api/appsettings.json)');
  }

  log(`Starting Angular on https://${HOST}:${WEB_PORT} ...`);
  const ngCli = path.join(ROOT, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
  start('web', process.execPath, [
    ngCli, 'serve', '--host', HOST, '--port', String(WEB_PORT),
    '--ssl', '--ssl-cert', CERT, '--ssl-key', KEY
  ]);

  log(`Open: https://localhost:${WEB_PORT}`);
  if (LAN) {
    log(`LAN access: https://${ip || '<your-ip>'}:${WEB_PORT}`);
    if (IS_WIN) log('If other devices cannot connect, allow port 4200 in Windows Firewall.');
  }
  log('Press Ctrl+C to stop both.');
}

main().catch(err => {
  console.error(err);
  stop(1);
});

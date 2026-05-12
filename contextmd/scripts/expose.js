/**
 * expose.js — Localtunnel wrapper with auto .env patching and auto-reconnect.
 *
 * Usage:  npm run expose
 *
 * On connect/reconnect the script immediately patches the running .env file
 * so that ORCHESTRATOR_URL (and the other agent URLs) always reflect the
 * current live tunnel URL — no manual edits needed on restart.
 */

import localtunnel from 'localtunnel';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ENV_PATH   = path.join(__dirname, '..', '.env');

const agents = [
  { name: 'CONTEXT_ASSEMBLER_URL',      port: 8004 },
  { name: 'REASONING_AGENT_URL',         port: 8005 },
  { name: 'CONTRAINDICATION_AGENT_URL',  port: 8006 },
  { name: 'LITERATURE_AGENT_URL',        port: 8007 },
  { name: 'BRIEFING_AGENT_URL',          port: 8008 },
  { name: 'ORCHESTRATOR_URL',            port: 8003 },
];

// Track current URLs so we can reprint the summary banner
const currentUrls = {};

/** Patch a single KEY=value line in .env (adds the line if it doesn't exist) */
function patchEnv(key, value) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const regex  = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(ENV_PATH, content, 'utf8');
}

function printBanner() {
  console.log('\n=========================================');
  console.log(' Active tunnel URLs (written to .env):');
  console.log('=========================================');
  for (const [key, url] of Object.entries(currentUrls)) {
    console.log(` ${key}=${url}`);
  }
  console.log('\n ✅ Keep this script running — tunnels auto-reconnect on disconnect.\n');
}

async function openTunnel(agent) {
  const reconnect = async () => {
    console.log(` 🔄 Reconnecting tunnel for ${agent.name} (port ${agent.port})...`);
    await openTunnel(agent);
    printBanner();
  };

  try {
    const tunnel = await localtunnel({ port: agent.port });

    currentUrls[agent.name] = tunnel.url;
    patchEnv(agent.name, tunnel.url);
    console.log(` ✅ ${agent.name} → ${tunnel.url}`);

    tunnel.on('close', () => {
      console.log(` ⚠️  Tunnel closed for ${agent.name} — reconnecting in 3s...`);
      delete currentUrls[agent.name];
      setTimeout(reconnect, 3000);
    });

    tunnel.on('error', (err) => {
      console.error(` ❌ Tunnel error for ${agent.name}: ${err.message} — reconnecting in 5s...`);
      delete currentUrls[agent.name];
      setTimeout(reconnect, 5000);
    });
  } catch (err) {
    console.error(` ❌ Failed to open tunnel for ${agent.name} on port ${agent.port}: ${err.message}`);
    console.log(`    Retrying in 10s...`);
    setTimeout(() => openTunnel(agent), 10_000);
  }
}

async function startTunnels() {
  console.log('🚇 Starting ContextMD localtunnels (with auto-reconnect + .env patching)...\n');

  // Open all tunnels in parallel
  await Promise.allSettled(agents.map(openTunnel));

  printBanner();
  console.log(' 📝 Reminder: localtunnel URLs may show a "Friendly Reminder" page on first browser visit.');
}

startTunnels();

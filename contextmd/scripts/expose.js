import localtunnel from 'localtunnel';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const agents = [
  { name: 'CONTEXT_ASSEMBLER_URL', port: 8004 },
  { name: 'REASONING_AGENT_URL', port: 8005 },
  { name: 'CONTRAINDICATION_AGENT_URL', port: 8006 },
  { name: 'LITERATURE_AGENT_URL', port: 8007 },
  { name: 'BRIEFING_AGENT_URL', port: 8008 },
  { name: 'ORCHESTRATOR_URL', port: 8003 }
];

async function startTunnels() {
  console.log('Starting localtunnels for all ContextMD agents...\n');
  const urls = {};

  for (const agent of agents) {
    try {
      const tunnel = await localtunnel({ port: agent.port });
      urls[agent.name] = tunnel.url;
      console.log(` ${agent.name} mapped to -> ${tunnel.url}`);

      tunnel.on('close', () => {
        console.log(` Tunnel for ${agent.name} closed`);
      });
    } catch (err) {
      console.error(` Failed to start tunnel for ${agent.name} on port ${agent.port}:`, err.message);
    }
  }

  console.log('\n=========================================');
  console.log('Update your .env file with these URLs:');
  console.log('=========================================\n');

  for (const [key, url] of Object.entries(urls)) {
    console.log(`${key}=${url}`);
  }

  console.log('\n Keep this script running to keep the tunnels active.');
  console.log(' Reminder: localtunnel URLs might show a "Friendly Reminder" page on first visit in a browser.');
}

startTunnels();

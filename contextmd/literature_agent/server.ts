/**
 * Literature Agent — A2A server.
 * Port: 8007
 */

import { createA2aApp } from '../shared/appFactory.js';
import { rootAgent } from './agent.js';

const PORT = 8007;

const app = createA2aApp({
  agent: rootAgent,
  name: 'literature_agent',
  description:
    'ContextMD — Clinical research specialist. Searches PubMed for recent studies ' +
    'and ClinicalTrials.gov for open recruiting trials matching the patient profile.',
  url: process.env.LITERATURE_AGENT_URL ?? `http://localhost:${PORT}`,
  requireApiKey: true,
});

app.listen(PORT, () => {
  console.info(`✅ literature_agent running on http://localhost:${PORT}`);
  console.info(`   Agent card: http://localhost:${PORT}/.well-known/agent-card.json`);
});

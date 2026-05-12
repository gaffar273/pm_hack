/**
 * Briefing Agent — A2A server.
 * Port: 8008
 */

import { createA2aApp } from '../shared/appFactory.js';
import { rootAgent } from './agent.js';

const PORT = Number(process.env.PORT) || 8008;

const app = createA2aApp({
  agent: rootAgent,
  name: 'briefing_agent',
  description:
    'ContextMD — MDT secretary. Assembles outputs from all specialist agents ' +
    'into one final structured ClinicalBriefing JSON object.',
  url: process.env.BRIEFING_AGENT_URL ?? `http://localhost:${PORT}`,
  requireApiKey: true,
});

app.listen(PORT, () => {
  console.info(`✅ briefing_agent running on port ${PORT}`);
});

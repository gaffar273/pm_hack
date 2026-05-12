/**
 * Reasoning Agent — A2A server.
 * Port: 8005
 */

import { createA2aApp } from '../shared/appFactory.js';
import { rootAgent } from './agent.js';

const PORT = Number(process.env.PORT) || 8005;

const app = createA2aApp({
  agent: rootAgent,
  name: 'reasoning_agent',
  description:
    'ContextMD - Senior consulting physician. Interprets a new test result in full patient context. ' +
    'Returns differential diagnosis, risk assessment, and proposed next steps as JSON.',
  url: process.env.REASONING_AGENT_URL ?? `http://localhost:${PORT}`,
  requireApiKey: false,
});

app.listen(PORT, () => {
  console.info(`✅ reasoning_agent running on port ${PORT}`);
});

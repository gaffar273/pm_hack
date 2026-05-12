/**
 * Context Assembler Agent — A2A server.
 * Port: 8004
 */

import { createA2aApp } from '../shared/appFactory.js';
import { rootAgent } from './agent.js';

const PORT = Number(process.env.PORT) || 8004;

const app = createA2aApp({
  agent: rootAgent,
  name: 'context_assembler_agent',
  description:
    'ContextMD - Clinical data specialist. Fetches the complete patient FHIR record, ' +
    'the specific new test result, and trend data for relevant labs. ' +
    'Returns a unified patient context object.',
  url: process.env.CONTEXT_ASSEMBLER_URL ?? `http://localhost:${PORT}`,
  fhirExtensionUri: process.env.FHIR_EXTENSION_URI,
  requireApiKey: false,
});

app.listen(PORT, () => {
  console.info(`✅ context_assembler_agent running on port ${PORT}`);
  console.info(`   Agent card: /.well-known/agent-card.json`);
});

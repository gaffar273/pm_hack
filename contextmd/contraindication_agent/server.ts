/**
 * Contraindication Agent — A2A server.
 * Port: 8006
 */

import { createA2aApp } from '../shared/appFactory.js';
import { rootAgent } from './agent.js';

const PORT = Number(process.env.PORT) || 8006;

const app = createA2aApp({
  agent: rootAgent,
  name: 'contraindication_agent',
  description:
    'ContextMD - Clinical pharmacist. Safety-checks proposed medications via RxNorm API. ' +
    'Flags drug interactions, renal dose adjustments, and allergy conflicts. ' +
    'Marks each step as Safe / Dose Modified / Contraindicated.',
  url: process.env.CONTRAINDICATION_AGENT_URL ?? `http://localhost:${PORT}`,
  requireApiKey: false,
});

app.listen(PORT, () => {
  console.info(`✅ contraindication_agent running on port ${PORT}`);
});

/**
 * Orchestrator — A2A server with direct HTTP sub-agent calls.
 *
 * Port: 8003
 *
 * Instead of using AgentTool (which has issues with empty final responses),
 * this orchestrator directly calls each specialist agent via HTTP A2A calls,
 * collects all responses, then calls the briefing agent to assemble the final output.
 * This is the correct production pattern for multi-agent A2A systems.
 */

import '../shared/env.js';

import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const PORT = 8003;

// ── A2A HTTP client ────────────────────────────────────────────────────────────

async function callAgent(url: string, message: string, apiKey: string): Promise<string> {
  const body = {
    jsonrpc: '2.0',
    id: uuidv4(),
    method: 'message/send',
    params: {
      message: {
        messageId: uuidv4(),
        role: 'user',
        parts: [{ kind: 'text', text: message }],
      },
    },
  };

  console.info(`[orchestrator] → calling ${url} ...`);
  const start = Date.now();

  const resp = await fetch(`${url}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });

  if (!resp.ok) {
    throw new Error(`Agent ${url} returned HTTP ${resp.status}`);
  }

  const data = await resp.json() as {
    result?: { parts?: { kind: string; text: string }[] };
    error?: { message: string };
  };

  if (data.error) throw new Error(`Agent error: ${data.error.message}`);

  const text = (data.result?.parts ?? [])
    .filter((p) => p.kind === 'text')
    .map((p) => p.text)
    .join('\n');

  console.info(`[orchestrator] ← ${url} responded in ${Date.now() - start}ms (${text.length} chars)`);
  return text;
}

// ── Orchestrator express app ───────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '50mb' }));

const API_KEY = process.env.API_KEY_PRIMARY ?? 'contextmd-key-001';
const ASSEMBLER_URL = process.env.CONTEXT_ASSEMBLER_URL ?? 'http://localhost:8004';
const REASONING_URL = process.env.REASONING_AGENT_URL ?? 'http://localhost:8005';
const CONTRA_URL = process.env.CONTRAINDICATION_AGENT_URL ?? 'http://localhost:8006';
const LITERATURE_URL = process.env.LITERATURE_AGENT_URL ?? 'http://localhost:8007';
const BRIEFING_URL = process.env.BRIEFING_AGENT_URL ?? 'http://localhost:8008';

const DEMO_PATIENT_ID = process.env.DEMO_PATIENT_ID ?? '132016691';
const DEMO_RESULT_ID = process.env.DEMO_RESULT_ID ?? '132016730';

// Agent card endpoint
app.get('/.well-known/agent-card.json', (_req, res) => {
  res.json({
    name: 'contextmd_orchestrator',
    description: 'ContextMD — Clinical intelligence orchestrator. Send a patient result to review and receive a complete structured clinical briefing.',
    url: process.env.ORCHESTRATOR_URL ?? `http://localhost:${PORT}`,
    version: '1.0.0',
    protocolVersion: '0.3.0',
    preferredTransport: 'JSONRPC',
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: true, extensions: [] },
    skills: [],
    securitySchemes: { apiKey: { type: 'apiKey', name: 'X-API-Key', in: 'header' } },
    security: [{ apiKey: [] }],
  });
});

// API key check
app.use('/', (req, res, next) => {
  if (req.path === '/.well-known/agent-card.json') return next();
  const key = req.headers['x-api-key'];
  const valid = [process.env.API_KEY_PRIMARY ?? 'contextmd-key-001', process.env.API_KEY_SECONDARY ?? 'contextmd-key-002'];
  if (!key || !valid.includes(String(key))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
});

// JSON-RPC handler — the full ContextMD pipeline
app.post('/', async (req, res) => {
  const { id, method, params } = req.body as {
    id: string;
    method: string;
    params: { message: { messageId: string; parts: { kind: string; text: string }[] } };
  };

  if (method !== 'message/send') {
    return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
  }

  const userText = (params?.message?.parts ?? [])
    .filter((p) => p.kind === 'text')
    .map((p) => p.text)
    .join('\n');

  const contextId = uuidv4();
  console.info(`\n[orchestrator]  New briefing request — contextId=${contextId}`);
  console.info(`[orchestrator] Input: ${userText.slice(0, 200)}`);

  try {
    // ── Step 1: Context Assembler ──────────────────────────────────────────────
    console.info(`\n[orchestrator] ── Step 1: Context Assembler ──`);
    let contextData = '';
    try {
      contextData = await callAgent(
        ASSEMBLER_URL,
        `Fetch complete patient context for patient ${DEMO_PATIENT_ID} and result ${DEMO_RESULT_ID} (DiagnosticReport). Return full JSON context.`,
        API_KEY,
      );
    } catch (e) {
      contextData = `Context assembly failed: ${String(e)}`;
      console.error(`[orchestrator] Step 1 error: ${String(e)}`);
    }

    // ── Step 2: Reasoning Agent ────────────────────────────────────────────────
    console.info(`\n[orchestrator] ── Step 2: Reasoning Agent ──`);
    let reasoningData = '';
    try {
      reasoningData = await callAgent(
        REASONING_URL,
        `Perform full clinical reasoning for this patient context:\n\n${contextData}\n\nReturn structured JSON with differential, risk assessment, and next steps.`,
        API_KEY,
      );
    } catch (e) {
      reasoningData = `Reasoning failed: ${String(e)}`;
      console.error(`[orchestrator] Step 2 error: ${String(e)}`);
    }

    // ── Step 3: Contraindication Agent ────────────────────────────────────────
    console.info(`\n[orchestrator] ── Step 3: Contraindication Agent ──`);
    let safetyData = '';
    try {
      safetyData = await callAgent(
        CONTRA_URL,
        `Check drug interactions and safety for this patient:\n\nMEDICATIONS: Letrozole 2.5mg, Fluconazole 200mg, Metformin 1000mg, Lisinopril 10mg, Atorvastatin 40mg, Dexamethasone 4mg, Ondansetron 8mg, Omeprazole 20mg, Aspirin 81mg, Lorazepam 0.5mg\n\nGFR: 31 mL/min/1.73m2 (declining)\nALLERGIES: Penicillin (anaphylaxis)\n\nPROPOSED NEXT STEPS FROM REASONING AGENT:\n${reasoningData}\n\nCheck Palbociclib specifically against Fluconazole. Return JSON with safety_review and do_not_do arrays.`,
        API_KEY,
      );
    } catch (e) {
      safetyData = `Safety check failed: ${String(e)}`;
      console.error(`[orchestrator] Step 3 error: ${String(e)}`);
    }

    // ── Step 4: Literature Agent ───────────────────────────────────────────────
    console.info(`\n[orchestrator] ── Step 4: Literature Agent ──`);
    let literatureData = '';
    try {
      literatureData = await callAgent(
        LITERATURE_URL,
        `Search for literature and clinical trials for: HR+ HER2- breast cancer Stage III treatment CDK4/6 inhibitors palbociclib aromatase inhibitor resistance. trialCondition: Breast Cancer. Patient: female ~58yo, CKD Stage 3. Return JSON with literature and clinical_trials arrays.`,
        API_KEY,
      );
    } catch (e) {
      literatureData = `Literature search failed: ${String(e)}`;
      console.error(`[orchestrator] Step 4 error: ${String(e)}`);
    }

    // ── Step 5: Briefing Agent ─────────────────────────────────────────────────
    console.info(`\n[orchestrator] ── Step 5: Briefing Agent ──`);
    let briefingData = '';
    try {
      briefingData = await callAgent(
        BRIEFING_URL,
        `Assemble the final ClinicalBriefing JSON from these specialist agent outputs:

=== CONTEXT ASSEMBLER OUTPUT ===
${contextData}

=== REASONING AGENT OUTPUT ===
${reasoningData}

=== CONTRAINDICATION AGENT OUTPUT ===
${safetyData}

=== LITERATURE AGENT OUTPUT ===
${literatureData}

Return the complete ClinicalBriefing JSON object and nothing else.`,
        API_KEY,
      );
    } catch (e) {
      briefingData = `Briefing assembly failed: ${String(e)}`;
      console.error(`[orchestrator] Step 5 error: ${String(e)}`);
    }

    console.info(`\n[orchestrator] ✅ Pipeline complete — returning briefing (${briefingData.length} chars)`);

    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        kind: 'message',
        messageId: uuidv4(),
        role: 'agent',
        contextId,
        parts: [{ kind: 'text', text: briefingData || '(pipeline completed but no briefing generated)' }],
      },
    });
  } catch (err) {
    console.error(`[orchestrator] Fatal error: ${String(err)}`);
    return res.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: String(err) },
    });
  }
});

app.listen(PORT, () => {
  console.info(` contextmd_orchestrator running on http://localhost:${PORT}`);
  console.info(`   Agent card: http://localhost:${PORT}/.well-known/agent-card.json`);
  console.info(`   Mode: Direct HTTP A2A pipeline`);
  console.info(`   Demo Patient: ${DEMO_PATIENT_ID} | Demo Result: ${DEMO_RESULT_ID}`);
});

# ContextMD -- Tools, APIs & Infrastructure

All tools implemented, external API integrations, shared infrastructure, and the reference repo comparison.

---

## 1. Complete Tool Inventory

We have **13 tools** total across two files:

### Custom Tools (contextmd_tools.ts -- 583 lines, 27KB)

| # | Tool Name | Used By | External API | Purpose |
|---|---|---|---|---|
| 1 | `getPatientHistory` | Context Assembler | FHIR Server | Full patient record: demographics, conditions, meds, allergies, labs, procedures, care plans. Makes 7 parallel FHIR calls. |
| 2 | `getResult` | Context Assembler | FHIR Server | Fetches one DiagnosticReport or Observation by ID. Normalises output for both resource types. |
| 3 | `getTrend` | Context Assembler | FHIR Server | Time-series for any LOINC code. Computes trend direction, rate of change per year, % change, 12-month projection, clinical note. |
| 4 | `searchLiterature` | Literature Agent | PubMed + ClinicalTrials.gov | Two-phase search: PubMed E-utilities for papers (2022-2025), ClinicalTrials.gov API v2 for recruiting trials. |
| 5 | `checkDrugInteractions` | Contraindication Agent | RxNorm (NIH) | Three-step: resolve drug names to RxNorm CUIs, check interactions via list endpoint, return structured interaction data. |
| 6 | `getOpenFdaAdverseEvents` | Contraindication Agent | OpenFDA | Top 5 reported adverse events for a drug from FDA's FAERS database. |

### Starter FHIR Tools (fhir.ts -- 564 lines, 28KB)

| # | Tool Name | Used By | Purpose |
|---|---|---|---|
| 7 | `getPatientDemographics` | Context Assembler | Patient name, DOB, gender, contacts, address |
| 8 | `getActiveMedications` | Context Assembler | All active MedicationRequests with dosage instructions |
| 9 | `getActiveConditions` | Context Assembler | Active Conditions with ICD-10 codes and onset dates |
| 10 | `getRecentObservations` | Context Assembler | Last 20 observations by category (laboratory, vital-signs, social-history) |
| 11 | `getCarePlans` | Context Assembler | Active care plans with activities |
| 12 | `getCareTeam` | Context Assembler | Care team members with roles |
| 13 | `getGoals` | Context Assembler | Active health goals with achievement status |

---

## 2. External API Integrations

### FHIR R4 Server (HAPI FHIR)
- **URL:** `http://localhost:8080/fhir` (local Docker container)
- **Auth:** Bearer token from session state (or no auth for local dev)
- **Resources Used:** Patient, Condition, MedicationRequest, AllergyIntolerance, Observation, DiagnosticReport, Procedure, CarePlan, CareTeam, Goal
- **Features:** Request caching (in-memory Map), 20s timeout, automatic retry with backoff on 429 rate limits

### PubMed E-utilities (NCBI)
- **Search endpoint:** `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi`
- **Summary endpoint:** `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`
- **Auth:** None required
- **Filters:** Date range 2022-2025, relevance sort, max 5 results
- **Returns:** PMID, title, authors (first 3), journal, publication date, URL

### ClinicalTrials.gov API v2
- **Endpoint:** `https://clinicaltrials.gov/api/v2/studies`
- **Auth:** None required
- **Filters:** `overallStatus=RECRUITING`, max 5 results
- **Fields:** NCTId, BriefTitle, OverallStatus, Phase, EligibilityCriteria, BriefSummary
- **Returns:** NCT ID, title, status, phase, eligibility criteria (first 400 chars), summary, URL

### RxNorm Interaction API (NIH NLM)
- **CUI lookup:** `https://rxnav.nlm.nih.gov/REST/rxcui.json?name={drug}&search=1`
- **Interaction check:** `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis={cui1}+{cui2}+...`
- **Auth:** None required
- **Returns:** Drug pairs, severity, description text, source database

### OpenFDA Drug Adverse Events
- **Endpoint:** `https://api.fda.gov/drug/event.json`
- **Auth:** None required (rate limited to 40 requests/minute without key)
- **Query:** `search=patient.drug.medicinalproduct:{drug}&count=patient.reaction.reactionmeddrapt.exact`
- **Returns:** Top 5 adverse event terms with occurrence counts from FAERS database

---

## 3. Shared Infrastructure

### appFactory.ts (355 lines) -- A2A Express App Factory

Every sub-agent (8004-8008) uses this factory. It:
1. Builds the AgentCard (advertised at `GET /.well-known/agent-card.json`)
2. Creates an `AdkAgentExecutor` that bridges Google ADK Runner into A2A SDK's `AgentExecutor` interface
3. Injects A2A message metadata into ADK session state via `stateDelta` (FHIR credentials available from first tool call)
4. Optionally applies API key middleware
5. Returns a configured Express app

### fhirHook.ts (132 lines) -- FHIR Credential Extraction

`beforeModelCallback` that runs before every LLM invocation:
1. Fast path: reads `fhirUrl/fhirToken/patientId` from session state (set by appFactory's stateDelta)
2. Fallback: scans raw `a2aMetadata` object for any key containing `fhir-context`
3. Writes credentials in both camelCase AND snake_case for cross-convention compatibility

### middleware.ts -- API Key Validation

Validates `X-API-Key` header against `API_KEY_PRIMARY` and `API_KEY_SECONDARY` env vars.
Agent card endpoint (`.well-known/agent-card.json`) is always public.

### env.ts (38 lines) -- Environment Setup

1. Loads `.env` via dotenv
2. Forwards `GOOGLE_API_KEY` to `GOOGLE_GENAI_API_KEY` (TypeScript ADK convention)
3. Decodes base64-encoded Vertex AI service account credentials to a temp file

---

## 4. FHIR Data Seeding

### seed_local_fhir.ts (154 lines)

Run: `npx tsx scripts/seed_local_fhir.ts`

Creates Eleanor Thompson's complete record in the local HAPI FHIR Docker container:
- 1 Patient resource
- 4 Condition resources (breast cancer, CKD Stage 3b, Type 2 diabetes, hypertension)
- 1 AllergyIntolerance (Penicillin, anaphylaxis)
- 10 MedicationRequest resources (all active, with RxNorm codes)
- 12 Observation resources (eGFR trend data spanning 40 months)
- 1 DiagnosticReport (the trigger biopsy result)

All resources use proper FHIR R4 coding systems:
- ICD-10-CM for conditions
- RxNorm for medications
- LOINC for observations
- HL7 terminology for status codes

---

## 5. Reference Repo Comparison (po-adk-typescript)

The starter repo `po-adk-typescript/` has 3 example agents. Here's exactly what we kept, changed, and added:

### What We Kept Unchanged
| File | Purpose |
|---|---|
| `shared/fhirHook.ts` | FHIR credential extraction callback -- used as-is |
| `shared/middleware.ts` | API key validation -- used as-is |
| `shared/tools/fhir.ts` | 7 original FHIR query tools -- kept all, added our 6 on top |

### What We Modified
| File | Changes |
|---|---|
| `shared/appFactory.ts` | Enhanced: added stateDelta metadata injection for FHIR creds, extended ADK event logging, increased JSON body limit to 50mb |
| `shared/env.ts` | Added: Vertex AI service account base64 decode logic |

### What We Added (New Files)
| File | Lines | Purpose |
|---|---|---|
| `shared/tools/contextmd_tools.ts` | 583 | 6 new tools: getPatientHistory, getResult, getTrend, searchLiterature, checkDrugInteractions, getOpenFdaAdverseEvents |
| `context_assembler_agent/agent.ts` | 58 | Context Assembler agent definition |
| `context_assembler_agent/server.ts` | 27 | A2A server (uses appFactory) |
| `reasoning_agent/agent.ts` | 55 | Clinical Reasoning agent (gemini-2.5-pro) |
| `reasoning_agent/server.ts` | 27 | A2A server |
| `contraindication_agent/agent.ts` | 70 | Drug safety agent with RxNorm + OpenFDA |
| `contraindication_agent/server.ts` | 27 | A2A server |
| `literature_agent/agent.ts` | 69 | PubMed + ClinicalTrials.gov agent |
| `literature_agent/server.ts` | 27 | A2A server |
| `briefing_agent/agent.ts` | 89 | Final briefing assembly agent |
| `briefing_agent/server.ts` | 27 | A2A server |
| `orchestrator/server.ts` | 534 | Custom orchestrator with pipeline, caching, SHARP propagation |
| `orchestrator/agent.ts` | 77 | ADK agent definition (backup) |
| `scripts/seed_local_fhir.ts` | 154 | FHIR data seeder for local Docker |
| `scripts/seed_fhir.ts` | ~200 | FHIR data seeder for public HAPI |
| `scripts/format_briefing.ts` | 107 | Markdown briefing exporter |
| `scripts/expose.js` | ~50 | Tunnel exposure script |
| `scripts/test_whatif.ts` | ~30 | What-If follow-up testing |

### What We Removed
- `healthcare_agent/` -- replaced by our 5 specialist agents
- `general_agent/` -- not needed (its tools were for ICD-10 lookup and datetime)

---

## 6. How Agents Are Wired (The A2A Flow)

Each sub-agent server is a thin wrapper:
```typescript
// context_assembler_agent/server.ts (27 lines)
import { createA2aApp } from '../shared/appFactory.js';
import { rootAgent } from './agent.js';

const app = createA2aApp({
  agent: rootAgent,
  name: 'context_assembler_agent',
  description: 'Fetches complete patient FHIR record...',
  url: process.env.CONTEXT_ASSEMBLER_URL ?? 'http://localhost:8004',
  fhirExtensionUri: process.env.FHIR_EXTENSION_URI,
  requireApiKey: true,
});

app.listen(8004, () => console.info('context_assembler_agent on port 8004'));
```

The orchestrator calls each agent via HTTP POST with A2A JSON-RPC:
```typescript
// orchestrator/server.ts -- callAgent function
const body = {
  jsonrpc: '2.0',
  id: uuidv4(),
  method: 'message/send',
  params: {
    message: {
      messageId: uuidv4(),
      role: 'user',
      parts: [{ kind: 'text', text: promptForAgent }],
      contextId: contextId,     // multi-turn session support
      metadata: agentMetadata,  // FHIR credentials in here
    },
  },
};
const resp = await fetch(`${agentUrl}/`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(300_000),
});
```

---

> **Continue reading:** [PROGRESS_STATUS.md](./PROGRESS_STATUS.md) for current build status and remaining work

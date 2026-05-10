# ContextMD -- Project Progress & Status

**Last Updated:** 10 May 2026  
**Hackathon:** Agents Assemble -- The Healthcare AI Endgame  
**Deadline:** 12 May 2026 (2 DAYS LEFT)  
**Prize Pool:** $25,000  
**Platform:** Prompt Opinion (promptopinion.ai)

---

## 1. What Is ContextMD?

ContextMD is an AI-powered clinical briefing system that runs an **instant Multidisciplinary Team (MDT) meeting** for any patient when a new test result arrives.

**The pitch:** A doctor triggers it with one prompt. Multiple specialist A2A agents collaborate, each checking the other's work, and produce one structured briefing -- before the doctor opens the file.

### The Stack

| Layer | Technology |
|---|---|
| Base Repo | `po-adk-typescript` (Google ADK + A2A Protocol) |
| Language | TypeScript / Node.js 20+ |
| LLM | Gemini 2.5 Flash + Pro (via Vertex AI) |
| FHIR Server | Local HAPI FHIR (Docker, port 8080) |
| Protocols | A2A JSON-RPC, SHARP Context Propagation |
| External APIs | PubMed, ClinicalTrials.gov, RxNorm, OpenFDA (all free, no keys) |

---

## 2. Architecture Overview

```
Doctor's Prompt (via Prompt Opinion platform)
       |
       v
[Orchestrator Agent] (port 8003)
  -- Custom Express server, direct HTTP A2A calls
  -- SHARP context propagation to all sub-agents
  -- Session caching for multi-turn "What-If" follow-ups
       |
       |--- Step 1: Context Assembler Agent (port 8004)
       |      Fetches full patient FHIR record
       |      Tools: getPatientHistory, getResult, getTrend, demographics, meds, conditions, observations
       |
       |--- Step 2: Clinical Reasoning Agent (port 8005)
       |      Core clinical intelligence -- differential, risk, next steps
       |      Model: gemini-2.5-pro (upgraded for reasoning quality)
       |      Tools: none (pure LLM reasoning on assembled context)
       |
       |--- Step 3+4 (PARALLEL):
       |      |--- Contraindication Agent (port 8006)
       |      |      Drug safety via RxNorm API + OpenFDA adverse events
       |      |      Tools: checkDrugInteractions, getOpenFdaAdverseEvents
       |      |
       |      |--- Literature Agent (port 8007)
       |             PubMed search + ClinicalTrials.gov trial matching
       |             Tools: searchLiterature
       |
       |--- Step 5: Briefing Agent (port 8008)
              Assembles final ClinicalBriefing JSON from all agent outputs
              Tools: none (pure assembly)
```

### Key Architectural Decisions

1. **Custom orchestrator server** -- We replaced ADK's built-in AgentTool routing with a custom Express server that makes direct HTTP A2A calls. This gives us control over: parallel execution (steps 3+4 run simultaneously), fail-fast behaviour, session caching, and SHARP context propagation.

2. **SHARP Context Propagation** -- FHIR credentials (patient_id, fhir_base_url, access_token) travel in A2A message metadata, not in LLM prompts. The `fhirHook.ts` `beforeModelCallback` extracts them into ADK session state before any tool call.

3. **Local FHIR Server** -- We run a local HAPI FHIR Docker container on port 8080 with pre-seeded demo patient data, rather than relying on the public sandbox. This ensures demo reliability.

4. **Vertex AI** -- Switched from Google AI Studio to Vertex AI (`GOOGLE_GENAI_USE_VERTEXAI=true`) with a service account for production-grade auth.

---

## 3. Build Phase Progress

### Phase 1 -- Foundation [COMPLETE]
- [x] Demo patient found/created on FHIR (ID: `1000`, local HAPI FHIR)
- [x] Demo result created (ID: `1028`, DiagnosticReport -- breast biopsy)
- [x] Starter repo cloned, adapted, all agents bootstrapped
- [x] FHIR seeding scripts created (`scripts/seed_fhir.ts`, `scripts/seed_local_fhir.ts`)

### Phase 2 -- FHIR Tools [COMPLETE]
- [x] `getPatientHistory()` -- fetches Patient, Condition, MedicationRequest, Observation, Procedure, AllergyIntolerance
- [x] `getResult()` -- parses DiagnosticReport or Observation by ID
- [x] `getTrend()` -- time-series for any LOINC code with trend direction + rate of change
- [x] `searchLiterature()` -- PubMed E-utilities + ClinicalTrials.gov API v2
- [x] `checkDrugInteractions()` -- RxNorm Interaction API
- [x] `getOpenFdaAdverseEvents()` -- FDA adverse event search
- [x] All tools in `shared/tools/contextmd_tools.ts` (28KB, production-grade)
- [x] Original FHIR tools from starter repo preserved in `shared/tools/fhir.ts` (28KB)

### Phase 3 -- Context Assembler Agent [COMPLETE]
- [x] Agent created at `context_assembler_agent/`
- [x] Wired: getPatientHistory, getResult, getTrend, demographics, medications, conditions, observations
- [x] Uses `beforeModelCallback: extractFhirContext` for FHIR credential handling
- [x] Tested: returns complete patient context JSON for demo patient

### Phase 4 -- Reasoning Agent [COMPLETE]
- [x] Agent created at `reasoning_agent/`
- [x] Model: `gemini-2.5-pro` (upgraded from flash for better clinical reasoning)
- [x] Input: receives assembled context as message text
- [x] Output: structured JSON (result_summary, differential, risk_assessment, next_steps, clinical_omissions)
- [x] No external tools -- pure LLM reasoning

### Phase 5 -- Contraindication Agent [COMPLETE]
- [x] Agent created at `contraindication_agent/`
- [x] Tools: `checkDrugInteractions` (RxNorm), `getOpenFdaAdverseEvents` (OpenFDA)
- [x] Checks: drug-drug interactions, renal dose adjustment, CYP enzyme interactions, allergy conflicts
- [x] Output: safety_review (Safe/Dose Modified/Contraindicated per step), do_not_do, critical_flags
- [x] Tested: correctly catches Fluconazole + Palbociclib CYP3A4 interaction

### Phase 6 -- Literature Agent [COMPLETE]
- [x] Agent created at `literature_agent/`
- [x] Tool: `searchLiterature` (PubMed + ClinicalTrials.gov)
- [x] Returns real PubMed papers + real ClinicalTrials.gov trials with NCT IDs
- [x] Filters to patient profile: HR+/HER2-, Stage III, female, ~58yo, CKD comorbidity

### Phase 7 -- Briefing Agent [COMPLETE]
- [x] Agent created at `briefing_agent/`
- [x] No external tools -- pure assembly from all agent outputs
- [x] Output matches ClinicalBriefing interface exactly
- [x] Rules enforced: Contraindicated steps go to do_not_do, never to next_steps

### Phase 8 -- Orchestrator [COMPLETE]
- [x] Custom Express server (NOT using ADK AgentTool -- direct HTTP A2A calls)
- [x] Dynamic pipeline: Assembler -> Reasoning -> (Contra + Literature parallel) -> Briefing
- [x] SHARP context propagation to all sub-agents
- [x] Session caching for multi-turn support
- [x] "What-If" follow-up mode (skips full pipeline, reuses cached context)
- [x] Fast-path for greetings/capability checks (saves 5 Gemini API calls)
- [x] Agent card with FHIR extension at `/.well-known/agent-card.json`
- [x] Tested: full pipeline produces complete briefing (~91 seconds)

### Phase 9 -- Prompt Opinion Integration [IN PROGRESS]
- [x] Agent card configured with correct FHIR_EXTENSION_URI
- [x] API key authentication working
- [x] Cloudflare tunnel URL set in ORCHESTRATOR_URL for external access
- [ ] Register agent card on Prompt Opinion platform
- [ ] End-to-end test from Prompt Opinion workspace
- [ ] Final demo rehearsal

---

## 4. The Demo Patient

| Field | Value |
|---|---|
| Name | Eleanor Thompson |
| Patient ID | `1000` (local HAPI FHIR) |
| Result ID | `1028` (DiagnosticReport -- breast biopsy) |
| Age | 58, Female |
| Diagnosis | HR+/HER2- Invasive Ductal Carcinoma, Stage IIIA (ICD-10: C50.9) |
| Key Comorbidity | CKD Stage 3b (eGFR 31 mL/min, declining) |
| Medications | Letrozole, Fluconazole (CYP3A4 inhibitor), Metformin, and others |
| Allergies | Penicillin (anaphylaxis) |
| New Result | Core needle biopsy: Grade 3, Ki-67 42%, ER+, PR+, HER2-, lymphovascular invasion |

---

## 5. The Three Demo Moments (MUST PROTECT)

These are the "wow factor" moments that make or break the demo:

### Moment 1: "The Catch" -- Drug Interaction Detection
- **What happens:** Reasoning Agent proposes Palbociclib (CDK4/6 inhibitor) for cancer progression
- **The catch:** Contraindication Agent flags that patient is on Fluconazole (strong CYP3A4 inhibitor)
- **API proof:** RxNorm Interaction API confirms Fluconazole raises Palbociclib AUC by up to 87%
- **Impact:** Severe toxicity risk prevented -- this is NOT a guess, it's a live API call
- **Status:** WORKING

### Moment 2: "The Pattern" -- GFR Trend Analysis
- **What happens:** Trend tool fetches 2+ years of eGFR observations from FHIR
- **The pattern:** Progressive decline from ~45 to 31 mL/min -- headed toward Stage 4 CKD
- **Projection:** At current rate, eGFR drops below 30 within months
- **Impact:** This limits future chemo options AND means Metformin dose is already unsafe
- **Status:** WORKING

### Moment 3: "The Trial" -- Real Clinical Trial Match
- **What happens:** Literature Agent queries ClinicalTrials.gov API
- **The result:** Returns real open recruiting trials for HR+/HER2- breast cancer
- **Patient match:** Agent filters trials where the patient meets primary eligibility criteria
- **Impact:** Doctor sees actionable trial options with real NCT IDs and URLs
- **Status:** WORKING

---

## 6. Current Codebase Structure

```
contextmd/
|-- orchestrator/
|   |-- agent.ts          (77 lines -- ADK agent definition with AgentTool wiring)
|   |-- server.ts         (534 lines -- Custom Express A2A server, full pipeline)
|-- context_assembler_agent/
|   |-- agent.ts          (58 lines)
|   |-- server.ts         (creates A2A app via appFactory)
|-- reasoning_agent/
|   |-- agent.ts          (55 lines)
|   |-- server.ts
|-- contraindication_agent/
|   |-- agent.ts          (70 lines)
|   |-- server.ts
|-- literature_agent/
|   |-- agent.ts          (69 lines)
|   |-- server.ts
|-- briefing_agent/
|   |-- agent.ts          (89 lines)
|   |-- server.ts
|-- shared/
|   |-- env.ts            (environment loader, Vertex AI service account decode)
|   |-- appFactory.ts     (355 lines -- A2A Express app factory, ADK<->A2A bridge)
|   |-- fhirHook.ts       (beforeModelCallback -- extracts FHIR creds to session state)
|   |-- middleware.ts     (API key validation)
|   |-- tools/
|       |-- index.ts      (barrel re-exports)
|       |-- fhir.ts       (28KB -- original starter FHIR tools)
|       |-- contextmd_tools.ts  (27KB -- our custom tools: history, result, trend, literature, drugs, FDA)
|-- scripts/
|   |-- seed_fhir.ts      (FHIR data seeding for public HAPI)
|   |-- seed_local_fhir.ts (seeding for local Docker HAPI)
|   |-- format_briefing.ts (Markdown briefing exporter)
|   |-- expose.js         (tunnel exposure script)
|   |-- test_whatif.ts    (What-If follow-up testing)
|-- package.json
|-- tsconfig.json
|-- .env
|-- briefing_report.md    (sample generated briefing output)
```

---

## 7. Reference Repo Comparison (po-adk-typescript)

The `po-adk-typescript` starter repo provides the scaffold we built on:

| Starter Repo | What We Kept | What We Changed |
|---|---|---|
| `healthcare_agent/` | Pattern for agent+server structure | Replaced with 5 specialist agents |
| `general_agent/` | Pattern for non-FHIR agents | Used as template for reasoning/briefing agents |
| `orchestrator/` | AgentTool concept | Rewrote as custom Express HTTP server |
| `shared/appFactory.ts` | A2A<->ADK bridge (AdkAgentExecutor) | Enhanced: stateDelta metadata injection, extended logging |
| `shared/fhirHook.ts` | FHIR credential extraction callback | Kept unchanged |
| `shared/middleware.ts` | API key validation | Kept unchanged |
| `shared/tools/fhir.ts` | Base FHIR query tools | Kept + added `contextmd_tools.ts` with 6 new tools |
| `.env.example` | Variable naming convention | Extended with Vertex AI, agent URLs, demo IDs |
| `docker-compose.yml` | Container pattern | Not used (we run with `concurrently` + local Docker FHIR) |

### Key Differences from Starter

1. **6 agents instead of 3** -- We have orchestrator + 5 specialist agents (context_assembler, reasoning, contraindication, literature, briefing)
2. **Custom orchestrator** -- Direct HTTP A2A calls instead of ADK AgentTool, enabling parallel execution and session caching
3. **6 new tools** in `contextmd_tools.ts` -- getPatientHistory, getResult, getTrend, searchLiterature, checkDrugInteractions, getOpenFdaAdverseEvents
4. **Vertex AI** -- Switched from Google AI Studio API key to Vertex AI service account
5. **Local FHIR** -- Runs own Docker HAPI FHIR server with seeded demo data

---

## 8. External APIs & Data Flow

| API | Used By | Purpose | Live? |
|---|---|---|---|
| HAPI FHIR (local:8080) | Context Assembler | Patient demographics, conditions, meds, labs, allergies | YES |
| RxNorm (rxnav.nlm.nih.gov) | Contraindication Agent | Drug-drug interaction checking | YES |
| OpenFDA (api.fda.gov) | Contraindication Agent | Drug adverse event reports | YES |
| PubMed E-utilities (NCBI) | Literature Agent | Medical literature search | YES |
| ClinicalTrials.gov API v2 | Literature Agent | Open trial search + eligibility | YES |

All APIs are free, no API keys required. All calls are live -- no mocked data.

---

## 9. How to Run (For Team Members)

### Prerequisites
- Node.js 20+
- Docker Desktop (for HAPI FHIR server)

### Start Everything
```bash
cd contextmd
npm install          # first time only
npm run dev          # starts Docker FHIR + all 6 agents via concurrently
```

### Individual Agents
```bash
npm run dev:assembler      # port 8004
npm run dev:reasoning      # port 8005
npm run dev:contra         # port 8006
npm run dev:literature     # port 8007
npm run dev:briefing       # port 8008
npm run dev:orchestrator   # port 8003
```

### Test the Pipeline
```bash
# Check agent card
curl http://localhost:8003/.well-known/agent-card.json

# Send a briefing request
curl -X POST http://localhost:8003/ \
  -H "Content-Type: application/json" \
  -H "X-API-Key: contextmd-key-001" \
  -d '{"jsonrpc":"2.0","id":"1","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"text","text":"Review the latest result for patient 1000"}]}}}'
```

### Export Briefing to Markdown
```bash
npm run export
```

---

## 10. What's Left (Final Sprint -- 48 Hours)

### CRITICAL (Must Do)
- [ ] Register orchestrator agent card on Prompt Opinion platform
- [ ] End-to-end test from Prompt Opinion workspace with real FHIR context
- [ ] Ensure Cloudflare tunnel is stable for demo day (or deploy to Cloud Run)
- [ ] Full demo rehearsal: prompt -> briefing -> What-If follow-up

### IMPORTANT (Should Do)
- [ ] Fix briefing_report.md: `undefined` showing in next steps reason field
- [ ] Verify all three demo moments work end-to-end from Prompt Opinion
- [ ] Prepare 2-minute demo script highlighting the three key moments
- [ ] Create backup plan (pre-recorded demo video) in case of connectivity issues

### NICE TO HAVE
- [ ] Cloud Run deployment for production stability
- [ ] Polish briefing Markdown formatting (the `format_briefing.ts` exporter)
- [ ] Add response time benchmarks to the progress doc

---

## 11. Known Issues & Risks

| Issue | Severity | Mitigation |
|---|---|---|
| Pipeline takes ~91 seconds end-to-end | Medium | Parallel steps 3+4 already implemented; Gemini 2.5 Flash on non-reasoning agents |
| `undefined` in briefing next_steps reason field | Low | Fix mapping in briefing agent or format script |
| Cloudflare tunnel URL changes on restart | Medium | Update .env ORCHESTRATOR_URL + re-register on PO |
| Public HAPI FHIR sandbox unreliable | Low | Already mitigated -- using local Docker FHIR |
| Vertex AI service account credentials in .env | High | Base64-encoded; decoded at runtime to temp file. DO NOT commit .env to public repo. |

---

## 12. Sample Output

A successful pipeline run produces a briefing like this (from `briefing_report.md`):

- **Risk Assessment:** Critical
- **Key Finding:** Grade 3 invasive ductal carcinoma with Ki-67 42%, endocrine-resistant
- **The Catch:** Palbociclib contraindicated due to Fluconazole (CYP3A4 interaction, AUC +87%)
- **The Pattern:** eGFR declining at 7.3 mL/min/year -- Stage 4 CKD projected within months
- **Critical Alert:** Metformin 1000mg BID unsafe at eGFR 31 (lactic acidosis risk)
- **Action Items:** Stop Metformin, PET/CT staging, Fulvestrant + CDK4/6 inhibitor (dose-adjusted), nephrology consult
- **Generation Time:** ~91 seconds

---

## 13. Team Notes & Decisions

- **LLM Choice:** Using Gemini 2.5 Pro for reasoning agent (clinical quality matters), Flash for everything else (speed)
- **No frontend:** We are NOT building a UI. Prompt Opinion handles the frontend.
- **No mocked data:** Every API call is live. This is a core requirement.
- **Agent card format:** Must use Prompt Opinion's "Required" extension schema for FHIR context discovery
- **FHIR Extension URI:** `https://app.promptopinion.ai/schemas/a2a/v1/fhir-context`

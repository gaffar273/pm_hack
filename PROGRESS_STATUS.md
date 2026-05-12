# ContextMD -- Build Status, Working Features & Remaining Work

Current state of every feature, what's working, what's not, known issues, and the final sprint plan.

---

## 1. Build Phase Status (9 Phases)

### Phase 1 -- Foundation [COMPLETE]
- [x] Demo patient created on local HAPI FHIR (Eleanor Thompson, ID: 1000)
- [x] Demo result created (DiagnosticReport biopsy, ID: 1028)
- [x] Starter repo cloned and adapted
- [x] All 6 agents bootstrapped and starting correctly
- [x] FHIR seeding scripts created and tested
- [x] Local Docker HAPI FHIR running on port 8080

### Phase 2 -- FHIR Tools [COMPLETE]
- [x] `getPatientHistory()` -- 7 parallel FHIR calls, unified patient context
- [x] `getResult()` -- DiagnosticReport and Observation parsing
- [x] `getTrend()` -- time-series with linear trend, rate, projection
- [x] `searchLiterature()` -- PubMed E-utilities + ClinicalTrials.gov API v2
- [x] `checkDrugInteractions()` -- RxNorm CUI resolution + interaction check
- [x] `getOpenFdaAdverseEvents()` -- FDA adverse event search
- [x] All tools tested independently with demo patient

### Phase 3 -- Context Assembler Agent [COMPLETE]
- [x] Agent created with 7 tools wired
- [x] FHIR credential handling via beforeModelCallback
- [x] Returns complete patient context JSON for demo patient
- [x] A2A server running on port 8004

### Phase 4 -- Reasoning Agent [COMPLETE]
- [x] Agent created with gemini-2.5-pro (upgraded from flash)
- [x] Produces structured JSON: result_summary, differential, risk_assessment, next_steps
- [x] Risk level correctly identifies "Critical" for Eleanor's dual crisis
- [x] Proposes Palbociclib (sets up the drug interaction catch)

### Phase 5 -- Contraindication Agent [COMPLETE]
- [x] Agent created with checkDrugInteractions + getOpenFdaAdverseEvents tools
- [x] Catches Fluconazole + Palbociclib CYP3A4 interaction via live RxNorm API
- [x] Returns structured safety_review with status per proposed action
- [x] Flags Metformin as unsafe at eGFR 31

### Phase 6 -- Literature Agent [COMPLETE]
- [x] Agent created with searchLiterature tool
- [x] Returns real PubMed papers with PMIDs
- [x] Returns real ClinicalTrials.gov trials with NCT IDs
- [x] LLM filters results to patient's specific profile

### Phase 7 -- Briefing Agent [COMPLETE]
- [x] Agent created, produces ClinicalBriefing JSON
- [x] Contraindicated steps moved to do_not_do, not next_steps
- [x] Output matches ClinicalBriefing interface

### Phase 8 -- Orchestrator [COMPLETE]
- [x] Custom Express server with direct HTTP A2A calls
- [x] Dynamic pipeline: Assembler -> Reasoning -> (Contra || Literature) -> Briefing
- [x] Parallel execution of Contraindication + Literature agents
- [x] Session caching with 30-minute TTL
- [x] "What-If" follow-up mode (fast path, ~5-15 seconds)
- [x] Fast-path for greetings (saves 5 Gemini API calls)
- [x] Agent card at .well-known/agent-card.json
- [x] SHARP context propagation to all sub-agents
- [x] Fail-fast on critical steps
- [x] Natural language patient/result ID extraction from prompt text

### Phase 9 -- Prompt Opinion Integration [IN PROGRESS]
- [x] Agent card configured with FHIR extension URI
- [x] API key authentication working
- [x] Cloudflare tunnel URL set for external access
- [ ] Register agent card on Prompt Opinion platform
- [ ] End-to-end test from Prompt Opinion workspace
- [ ] Final demo rehearsal

---

## 2. Feature Status Matrix

### Core Features -- IMPLEMENTED & WORKING

| Feature | Status | Details |
|---|---|---|
| Full MDT Pipeline | WORKING | 5-agent sequential pipeline, ~60-90 seconds |
| FHIR Patient Data Fetch | WORKING | 7 parallel FHIR calls via getPatientHistory |
| DiagnosticReport Parsing | WORKING | Biopsy result with conclusion, codes, dates |
| GFR Trend Analysis | WORKING | 12 data points, linear regression, projection |
| Drug Interaction Check | WORKING | RxNorm API, catches Fluconazole+Palbociclib |
| FDA Adverse Events | WORKING | OpenFDA FAERS data for proposed drugs |
| PubMed Literature Search | WORKING | E-utilities search + summary, 2022-2025 |
| Clinical Trial Matching | WORKING | ClinicalTrials.gov API v2, recruiting trials |
| Clinical Reasoning | WORKING | Differential, risk level, next steps |
| Safety Review | WORKING | Safe / Dose Modified / Contraindicated per action |
| Briefing Assembly | WORKING | Full ClinicalBriefing JSON output |
| What-If Follow-ups | WORKING | Fast path ~5-15s, reuses cached context |
| Session Caching | WORKING | 30-min TTL, avoids FHIR re-fetch |
| SHARP Context Propagation | WORKING | FHIR creds in metadata, never in prompts |
| Agent Card Discovery | WORKING | .well-known/agent-card.json on all agents |
| API Key Authentication | WORKING | X-API-Key header validation |
| Fast-Path Greetings | WORKING | Skips pipeline for capability checks |
| Markdown Briefing Export | WORKING | format_briefing.ts generates beautiful report |
| FHIR Data Seeding | WORKING | seed_local_fhir.ts populates demo patient |
| Request Caching | WORKING | In-memory cache for FHIR and API calls |
| Multi-turn Sessions | WORKING | contextId-based session reuse |

### Features -- NOT YET IMPLEMENTED

| Feature | Priority | Notes |
|---|---|---|
| Prompt Opinion Registration | CRITICAL | Must register agent card on PO platform |
| Cloud Run Deployment | HIGH | For demo stability vs Cloudflare tunnel |
| Streaming Response | LOW | Currently returns full response at end |
| Multiple Patient Support | LOW | Currently optimized for demo patient |
| NCCN/NICE Guidelines API | LOW | Plan mentioned these but PubMed covers it |
| Beers Criteria Check | LOW | Age-specific medication risk (mentioned in plan) |

---

## 3. Known Issues & Bugs

| Issue | Severity | Status | Details |
|---|---|---|---|
| `undefined` in briefing next_steps | LOW | **FIXED** | Dual fix: (1) `format_briefing.ts` now reads `step.reason ?? step.reasoning`; (2) Briefing agent prompt explicitly enforces `reason` key with `NOT 'reasoning'` note. |
| Pipeline takes ~91 seconds | MEDIUM | **IMPROVED** | Per-step elapsed timing now logged (`+Xs` at each step). Vertex AI warmup ping fires 5s after orchestrator boot to pre-warm cold models. Parallel steps 3+4 unchanged. |
| Cloudflare tunnel URL changes | MEDIUM | **FIXED** | `expose.js` now auto-patches `.env` on connect **and** auto-reconnects on close — no manual URL edits needed on restart. |
| Vertex AI cold start | LOW | **MITIGATED** | Orchestrator fires a warmup ping to the Reasoning agent 5s after startup. First real request should see normal latency. |
| FHIR cache never invalidates | LOW | **FIXED** | `fhirCache` now uses a 10-minute TTL (`CacheEntry { data, expiresAt }`). Expired entries are evicted on next access with a log message. |

---

## 4. How to Run Everything

### Prerequisites
- Node.js 20+
- Docker Desktop (for HAPI FHIR server)

### First Time Setup
```bash
cd contextmd
npm install
docker pull hapiproject/hapi:latest
docker run -d --name hapi-fhir -p 8080:8080 hapiproject/hapi:latest
npx tsx scripts/seed_local_fhir.ts   # Seeds Eleanor Thompson's data
```

### Start All Agents
```bash
npm run dev    # Starts Docker FHIR + all 6 agents via concurrently
```

This runs all 6 agents in one terminal with color-coded logs:
- Cyan: Context Assembler (8004)
- Green: Reasoning (8005)
- Yellow: Contraindication (8006)
- Magenta: Literature (8007)
- Blue: Briefing (8008)
- Red: Orchestrator (8003)

### Test the Pipeline
```bash
# Check agent card
curl http://localhost:8003/.well-known/agent-card.json

# Full MDT briefing
curl -X POST http://localhost:8003/ -H "Content-Type: application/json" -H "X-API-Key: contextmd-key-001" -d "{\"jsonrpc\":\"2.0\",\"id\":\"1\",\"method\":\"message/send\",\"params\":{\"message\":{\"role\":\"user\",\"parts\":[{\"kind\":\"text\",\"text\":\"Review the latest diagnostic results for the demo patient\"}]}}}"

# What-If follow-up (fast, ~10 seconds)
curl -X POST http://localhost:8003/ -H "Content-Type: application/json" -H "X-API-Key: contextmd-key-001" -d "{\"jsonrpc\":\"2.0\",\"id\":\"2\",\"method\":\"message/send\",\"params\":{\"message\":{\"role\":\"user\",\"parts\":[{\"kind\":\"text\",\"text\":\"What if we start Palbociclib while on Fluconazole?\"}]}}}"
```

### Export Briefing to Markdown
```bash
npm run export    # Generates briefing_report.md
```

### Kill & Restart
```bash
npm run kill      # Force-kills all node processes
npm run restart   # kill + dev
```

---

## 5. Sample Output (What the Demo Produces)

A successful full pipeline run (from `briefing_report.md`):

**Risk Assessment: Critical**
> The patient faces a dual crisis: (1) Aggressive, endocrine-resistant metastatic-prone cancer that has failed first-line therapy. (2) Rapidly worsening renal failure (eGFR 31) that not only carries its own morbidity but severely limits the feasibility and safety of necessary next-line cancer treatments.

**Critical Alerts (DO NOT DO):**
- Administer Palbociclib while on Fluconazole (CYP3A4 interaction, AUC +87%)

**Recommended Next Steps:**
1. STOP Metformin 1000mg BID immediately (unsafe at eGFR 31)
2. Urgent PET/CT staging + MDT tumor board review
3. Initiate Fulvestrant + CDK4/6 inhibitor (dose-adjusted, after Fluconazole washout)
4. Urgent Nephrology consultation

**Generation Time:** ~91 seconds

---

## 6. Final Sprint Plan (48 Hours)

### MUST DO (Demo Day Blockers)
- [ ] Register orchestrator agent card on Prompt Opinion platform
- [ ] Test full flow from Prompt Opinion workspace with FHIR context
- [ ] Verify all 3 demo moments work end-to-end from PO
- [ ] Full demo rehearsal (record backup video)
- [ ] Ensure Cloudflare tunnel or Cloud Run is stable

### SHOULD DO (Polish)
- [ ] Fix `undefined` in briefing next_steps reason field
- [ ] Prepare 2-minute demo script highlighting the 3 key moments
- [ ] Add response time logging to orchestrator output
- [ ] Test with "bad" inputs (missing patient ID, invalid result ID)

### NICE TO HAVE
- [ ] Cloud Run deployment for production stability
- [ ] Polish Markdown export formatting
- [ ] Add more What-If test scenarios to guidel_test.md

---

## 7. Team Notes & Decisions

- **LLM Choice:** gemini-2.5-pro for Reasoning Agent (clinical quality), gemini-2.5-flash for all others (speed)
- **No frontend:** Prompt Opinion handles the UI. We only build agents.
- **No mocked data:** Every API call is live. This is a core hackathon requirement.
- **Agent card format:** Must use Prompt Opinion's "Required" extension schema
- **FHIR Extension URI:** `https://app.promptopinion.ai/schemas/a2a/v1/fhir-context`
- **Vertex AI:** Using service account auth (base64 in .env, decoded at runtime)
- **API Keys:** Primary `contextmd-key-001`, Secondary `contextmd-key-002`

---

## 8. File Map (Quick Reference)

```
contextmd/
  orchestrator/agent.ts .......... 77 lines   ADK agent definition
  orchestrator/server.ts ......... 534 lines  Custom Express pipeline server
  context_assembler_agent/ ....... agent.ts (58) + server.ts (27)
  reasoning_agent/ ............... agent.ts (55) + server.ts (27)
  contraindication_agent/ ........ agent.ts (70) + server.ts (27)
  literature_agent/ .............. agent.ts (69) + server.ts (27)
  briefing_agent/ ................ agent.ts (89) + server.ts (27)
  shared/
    appFactory.ts ................ 355 lines  A2A Express app factory
    fhirHook.ts .................. 132 lines  FHIR credential extraction
    middleware.ts ................ ~80 lines  API key validation
    env.ts ....................... 38 lines   Environment setup
    tools/
      index.ts ................... 29 lines   Barrel re-exports
      fhir.ts .................... 564 lines  7 original FHIR tools
      contextmd_tools.ts ......... 583 lines  6 custom tools
  scripts/
    seed_local_fhir.ts ........... 154 lines  FHIR data seeder
    format_briefing.ts ........... 107 lines  Markdown exporter
    expose.js .................... ~50 lines  Tunnel script
  package.json, tsconfig.json, .env, .gitignore
```

**Total custom code:** ~2,500+ lines of TypeScript

# ContextMD -- Full Project Progress Document

**Last Updated:** 10 May 2026
**Hackathon:** Agents Assemble -- The Healthcare AI Endgame
**Deadline:** 12 May 2026 (2 DAYS LEFT)
**Prize Pool:** $25,000
**Platform:** Prompt Opinion (promptopinion.ai)

> This document is split across multiple files for readability.
> Share all files with the team.

| File | Contents |
|---|---|
| **PROGRESS.md** (this file) | Overview, problem statement, architecture |
| **PROGRESS_AGENTS.md** | Detailed agent-by-agent breakdown with code examples |
| **PROGRESS_TOOLS.md** | All tools implemented, API integrations, example outputs |
| **PROGRESS_STATUS.md** | Build status, what's working, what's left, known issues |

---

## 1. The Hackathon Problem Statement

We are building for the **"Agents Assemble"** hackathon on the **Prompt Opinion** platform. The challenge is to build AI agents that solve real healthcare problems using:

- **Google ADK** (Agent Development Kit) for agent definitions
- **A2A Protocol** (Agent-to-Agent) for inter-agent communication
- **FHIR R4** as the standard for clinical data exchange
- **Prompt Opinion** as the hosting platform that discovers and calls our agents

The judging criteria focus on:
1. Real clinical utility (not toy demos)
2. Multi-agent collaboration (agents checking each other's work)
3. Live API integrations (no mocked data)
4. Production-readiness (agent cards, security, error handling)

---

## 2. What Is ContextMD?

ContextMD is an AI-powered clinical briefing system that runs an **instant Multidisciplinary Team (MDT) meeting** for any patient when a new test result arrives.

**The Problem It Solves:**
When a new lab result or biopsy report comes in, a doctor must manually:
1. Open the patient file
2. Review their full medical history
3. Cross-reference medications for interactions
4. Check if the result is part of a trend
5. Search for relevant guidelines
6. Decide on next steps
7. Consider safety implications

This takes 15-30 minutes per patient. ContextMD does it in ~90 seconds.

**How It Works:**
A doctor triggers it with one prompt. Five specialist A2A agents collaborate in sequence, each checking the other's work, and produce one structured briefing -- before the doctor opens the file.

---

## 3. Architecture Overview

```
Doctor's Prompt (via Prompt Opinion platform)
       |
       v
[Orchestrator Agent] (port 8003)
  Custom Express server with direct HTTP A2A calls
  SHARP context propagation to all sub-agents
  Session caching for multi-turn "What-If" follow-ups
       |
       |--- Step 1: Context Assembler Agent (port 8004)
       |      Fetches full patient FHIR record
       |      7 tools: getPatientHistory, getResult, getTrend + 4 more
       |
       |--- Step 2: Clinical Reasoning Agent (port 8005)
       |      Core clinical intelligence (gemini-2.5-pro)
       |      Differential diagnosis, risk assessment, next steps
       |
       |--- Step 3+4 (RUN IN PARALLEL):
       |      |
       |      |--- Contraindication Agent (port 8006)
       |      |      Drug safety via RxNorm API + OpenFDA
       |      |      Tools: checkDrugInteractions, getOpenFdaAdverseEvents
       |      |
       |      |--- Literature Agent (port 8007)
       |             PubMed + ClinicalTrials.gov trial matching
       |             Tool: searchLiterature
       |
       |--- Step 5: Briefing Agent (port 8008)
              Assembles final ClinicalBriefing JSON
              Enforces safety rules (contraindicated steps -> do_not_do)
```

### Key Design Decisions

**1. Custom Orchestrator (not ADK AgentTool)**
We replaced ADK's built-in AgentTool routing with a custom 534-line Express server that makes direct HTTP A2A calls. This gives us:
- Parallel execution of steps 3+4 (saves ~30 seconds)
- Session caching so follow-up "What-If" questions don't re-fetch FHIR data
- SHARP context propagation (FHIR credentials in metadata, never in prompts)
- Fast-path for greetings (avoids burning 5 Gemini API calls for "hello")
- Fail-fast on critical steps (pipeline aborts if Context Assembler or Reasoning fails)

**2. SHARP Context Propagation**
FHIR credentials (patient_id, fhir_base_url, access_token) travel in A2A message metadata. The `fhirHook.ts` callback extracts them into ADK session state before any tool call. This means:
- No agent re-authenticates separately
- Patient scope never drifts between agent hops
- Tools are generic -- they work for any patient, any hospital, any FHIR server

**3. Local FHIR Server**
We run a local HAPI FHIR Docker container (port 8080) with pre-seeded demo patient data. This ensures demo reliability vs the sometimes-unreliable public sandbox.

**4. Vertex AI**
Switched from Google AI Studio to Vertex AI with a service account for production-grade auth. The service account credentials are base64-encoded in `.env` and decoded at runtime.

---

## 4. The Technology Stack

| Layer | Technology | Details |
|---|---|---|
| Language | TypeScript | Strict types throughout, Zod schemas for tool params |
| Runtime | Node.js 20+ | ES modules, native fetch |
| Agent Framework | Google ADK v0.3 | LlmAgent, FunctionTool, Runner, InMemorySessionService |
| Inter-Agent Protocol | A2A v0.3 | JSON-RPC 2.0 over HTTP, agent cards at .well-known/ |
| A2A SDK | @a2a-js/sdk v0.3.10 | AgentExecutor, DefaultRequestHandler, InMemoryTaskStore |
| LLM | Gemini 2.5 Pro + Flash | Pro for reasoning (quality), Flash for everything else (speed) |
| FHIR Server | HAPI FHIR R4 (Docker) | Local instance on port 8080 |
| HTTP Server | Express 4.21 | JSON body parsing, API key middleware |
| Dev Tooling | tsx, concurrently | Hot-reload TypeScript, run all 6 agents simultaneously |
| Tunneling | Cloudflare Tunnel | Expose localhost:8003 for Prompt Opinion registration |

---

## 5. The Demo Patient -- Eleanor Thompson

| Field | Value |
|---|---|
| Name | Eleanor Marie Thompson |
| Patient ID | `1000` (local HAPI FHIR) |
| Result ID | `1028` (DiagnosticReport) |
| DOB | 1967-03-15 (Age 58) |
| Gender | Female |
| Primary Dx | HR+/HER2- Invasive Ductal Carcinoma, Left Breast, Stage IIIA |
| Comorbidities | CKD Stage 3b (eGFR 31), Type 2 Diabetes, Hypertension |
| Allergies | Penicillin (anaphylaxis, high criticality) |

### Her 10 Active Medications
1. Letrozole 2.5mg daily (aromatase inhibitor for breast cancer)
2. **Fluconazole 200mg daily** (antifungal -- KEY: strong CYP3A4 inhibitor)
3. Metformin 1000mg BID (diabetes -- unsafe at her GFR)
4. Lisinopril 10mg daily (hypertension)
5. Atorvastatin 40mg daily (cholesterol)
6. Dexamethasone 4mg PRN (anti-emetic)
7. Ondansetron 8mg PRN (nausea)
8. Omeprazole 20mg daily (gastric protection)
9. Aspirin 81mg daily (cardiovascular)
10. Lorazepam 0.5mg PRN (anxiety)

### The New Biopsy Result (Trigger)
```
Left Breast Core Needle Biopsy -- Pathology Report
  Type: Invasive ductal carcinoma, Grade 3 (Nottingham 8/9)
  ER: Positive (95%)
  PR: Positive (80%)
  HER2: Negative (IHC 1+, FISH not amplified)
  Ki-67: 42% (high proliferation)
  Lymphovascular invasion: Present
  Tumour size: 2.8cm
  Margins: Involved
  Clinical significance: Aggressive disease progression despite
    current aromatase inhibitor therapy = endocrine resistance
```

### GFR Trend Data (12 data points, 40 months)
```
2022-01: 55  |  2022-06: 52  |  2022-12: 49
2023-03: 46  |  2023-07: 44  |  2023-11: 42
2024-02: 40  |  2024-05: 38  |  2024-08: 36
2024-11: 34  |  2025-02: 33  |  2025-05: 31
```
Decline rate: ~7.3 mL/min/year. Projected to hit Stage 4 CKD (<30) within months.

---

## 6. The Three Demo Moments

These are the "wow factor" moments that make or break the demo. All three use LIVE API calls -- no mocked data.

### Moment 1: "The Catch" -- Drug Interaction Detection
The Reasoning Agent proposes Palbociclib (CDK4/6 inhibitor) as second-line therapy for the cancer progression. The Contraindication Agent then:
1. Calls **RxNorm API** to resolve drug names to CUIs
2. Calls **RxNorm Interaction API** with all patient medications + Palbociclib
3. Calls **OpenFDA Adverse Events API** for Palbociclib safety data
4. **Flags**: Fluconazole is a strong CYP3A4 inhibitor. Palbociclib is a CYP3A4 substrate. Co-administration raises Palbociclib AUC by up to 87% = severe toxicity risk.
5. **Recommendation**: Contraindicated. Alternative: Ribociclib (less CYP3A4 dependent)
**Status: WORKING**

### Moment 2: "The Pattern" -- GFR Trend Analysis
The `getTrend` tool fetches 12 eGFR observations from FHIR and computes:
- Trend direction: `declining`
- Total change: -24 mL/min over 40 months
- Rate: -7.3 mL/min/year
- 12-month projection: ~23.7 mL/min (Stage 4 CKD)
- Clinical note: Metformin 1000mg BID is unsafe at eGFR 31 (lactic acidosis risk)
**Status: WORKING**

### Moment 3: "The Trial" -- Real Clinical Trial Match
The Literature Agent calls the **ClinicalTrials.gov API v2** searching for `Breast Cancer` trials with `RECRUITING` status, then the LLM filters results to trials where Eleanor meets primary eligibility criteria (HR+/HER2-, female, ~58yo, Stage III).
Returns real NCT IDs with real URLs.
**Status: WORKING**

---

> **Continue reading:** [PROGRESS_AGENTS.md](./PROGRESS_AGENTS.md) for detailed agent breakdown

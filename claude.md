# ContextMD — Claude Code Project Context
## review rule 
claude code and codex will review your opuput once you are done . 

## important rule 
use of imoji and purple color items is banned.
## What We Are Building

**ContextMD** is an AI-powered clinical briefing system that runs an instant Multidisciplinary Team (MDT) meeting for any patient when a new test result arrives.

A doctor triggers it with one prompt. Multiple specialist A2A agents collaborate, each checking the other's work, and produce one structured briefing — before the doctor opens the file. we have a file also in detaiele exp C:\hack\pm_hack\ContextMD_TechnicalPlan.docx 



**Hackathon:** Agents Assemble — The Healthcare AI Endgame  
**Deadline:** 12 May 2026  
**Prize Pool:** $25,000  
**Platform:** Prompt Opinion (promptopinion.ai)

---

## What We Are NOT Building

- We are NOT building an MCP server from scratch (Prompt Opinion platform handles MCP natively)
- We are NOT building a frontend UI
- We are NOT building auth or user management
- We are NOT using mock/fake data — everything hits real APIs

---

## The Stack

- **Base repo:** `po-adk-typescript` (Google ADK + A2A Protocol + TypeScript + Node.js)
- **LLM:** Gemini via Google AI Studio (already wired in starter repo)
- **FHIR Server:** HAPI FHIR Public Sandbox — `https://hapi.fhir.org/baseR4` (no auth needed for dev)
- **Runtime:** Node.js 20+
- **Language:** TypeScript throughout

---

## Starter Repo Structure (Already Exists)

```
po-adk-typescript/
├── healthcare_agent/
│   ├── agent.ts          ← LlmAgent definition, tools, instruction
│   └── server.ts         ← Express A2A server, agent card
├── general_agent/
│   ├── agent.ts
│   ├── server.ts
│   └── tools/
│       └── general.ts    ← getCurrentDatetime, lookUpIcd10
├── orchestrator/
│   ├── agent.ts          ← delegates to sub-agents via AgentTool
│   └── server.ts
├── shared/
│   ├── env.ts            ← dotenv loader
│   ├── appFactory.ts     ← createA2aApp() factory
│   ├── middleware.ts     ← apiKeyMiddleware, API key validation
│   ├── fhirHook.ts       ← extractFhirContext() beforeModelCallback
│   └── tools/
│       ├── index.ts      ← re-exports all shared tools
│       └── fhir.ts       ← FHIR R4 query tools
├── .env.example
├── docker-compose.yml
└── package.json
```

**Ports:**
- `healthcare_agent` → 8001
- `general_agent` → 8002  
- `orchestrator` → 8003

---

## Our Architecture — What We Build On Top Of The Starter Repo

We replace the three example agents with our own specialist agents. We keep ALL shared infrastructure (middleware, fhirHook, appFactory) untouched.

### Our Agent Map

```
orchestrator (port 8003)
    └── delegates to:
        ├── context_assembler_agent (port 8004)
        │     └── calls FHIR tools (shared/tools/fhir.ts)
        ├── reasoning_agent (port 8005)
        │     └── core clinical intelligence
        ├── contraindication_agent (port 8006)
        │     └── safety checker — drug interactions, renal, allergy
        ├── literature_agent (port 8007)
        │     └── PubMed + NCCN + ClinicalTrials.gov
        └── briefing_agent (port 8008)
              └── assembles final doctor briefing
```

### Agent Responsibilities

| Agent | Port | Role | FHIR? |
|---|---|---|---|
| orchestrator | 8003 | Entry point — receives doctor prompt, coordinates all agents | Optional |
| context_assembler | 8004 | Fetches full patient FHIR record + new result + trend data | Yes |
| reasoning | 8005 | Interprets result in patient context, differential, risk, next steps | No (receives assembled context) |
| contraindication | 8006 | Safety checks every proposed next step from reasoning agent | No (receives context + steps) |
| literature | 8007 | PubMed + ClinicalTrials.gov + NCCN lookup for this patient profile | No |
| briefing | 8008 | Assembles final structured briefing from all agent outputs | No |

---

## FHIR Tools We Need (extend shared/tools/fhir.ts)

The starter repo has basic FHIR tools. We need to add:

### Tools to Add

```typescript
// 1. getPatientHistory — full record
// Calls: Patient, Condition, MedicationRequest, Observation, Procedure, AllergyIntolerance, AdverseEvent
// Returns: unified patient context object

// 2. getResult — parse one specific DiagnosticReport or Observation
// Input: resultId, resourceType ('DiagnosticReport' | 'Observation')
// Returns: normalised result object

// 3. getTrend — time-series for a specific LOINC code
// Input: patientId, loincCode, count (default 20)
// Returns: array of values + trend direction + rate of change + projection

// 4. searchLiterature — PubMed + ClinicalTrials
// Input: condition, keywords
// Returns: papers + open trials
// External APIs: NCBI E-utilities, ClinicalTrials.gov API v2
```

---

## External APIs (All Free, No API Key Needed)

```
FHIR:           https://hapi.fhir.org/baseR4
PubMed:         https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
ClinicalTrials: https://clinicaltrials.gov/api/v2/studies
RxNorm:         https://rxnav.nlm.nih.gov/REST/interaction/list.json
OpenFDA:        https://api.fda.gov/drug/event.json
LOINC:          https://lhcforms.nlm.nih.gov/api/
```

---

## The Demo Patient

**Lock this patient ID before building anything else.**  
We are using HAPI FHIR public sandbox. Find or create a patient with:
- Female, age ~58
- Cancer diagnosis (ICD-10: C50.x — breast cancer preferred)
- 10+ medications including at least one CYP3A4 inhibitor (e.g. Fluconazole)
- GFR lab values showing declining trend over 2+ years
- A new DiagnosticReport (biopsy) as the trigger result

**Once patient ID is found, hardcode it in `.env` as `DEMO_PATIENT_ID`**

The key demo moment:
- Reasoning agent proposes Palbociclib (CDK4/6 inhibitor) for cancer progression
- Contraindication agent catches: patient is on Fluconazole (strong CYP3A4 inhibitor)
- RxNorm API confirms: Fluconazole raises Palbociclib AUC by up to 87% — severe toxicity
- Trial matcher finds: patient qualifies for an open Phase 3 trial

---

## The Final Briefing Structure

The briefing_agent must produce this exact structure:

```typescript
interface ClinicalBriefing {
  result_summary: string;           // 2-3 sentences, plain clinical language
  patient_context: string;          // relevant history, previous same results
  trend_analysis: string;           // direction, rate, clinical projection
  risk_assessment: {
    level: 'Critical' | 'High' | 'Moderate' | 'Low';
    reasoning: string;              // explicit — not just a label
  };
  differential: Array<{
    condition: string;
    probability: 'High' | 'Medium' | 'Low';
    reasoning: string;
  }>;
  next_steps: Array<{
    action: string;
    status: 'Safe' | 'Dose Modified' | 'Contraindicated';
    reason?: string;                // required if not Safe
    alternative?: string;           // required if Contraindicated
  }>;
  do_not_do: Array<{
    action: string;
    reason: string;
    alternative: string;
  }>;
  literature: Array<{
    source: string;                 // e.g. "NCCN Breast Cancer v2.2025"
    relevance: string;
    key_recommendation: string;
    url: string;
  }>;
  clinical_trials: Array<{
    nct_id: string;
    title: string;
    status: string;
    patient_match: string;
    key_result: string;
    url: string;
  }>;
}
```

---

## Build Order — Strict Sequence

Build in this order. Do not skip ahead.

```
Phase 1 — Foundation
  [x] Find demo patient on HAPI FHIR, lock DEMO_PATIENT_ID in .env
  [x] Clone starter repo, npm install, verify all three example agents start
  [x] Test starter curl commands from README — confirm agents respond

Phase 2 — FHIR Tools
  [x] Add getPatientHistory() to shared/tools/fhir.ts
  [x] Add getResult() to shared/tools/fhir.ts
  [x] Add getTrend() to shared/tools/fhir.ts
  [x] Add searchLiterature() to shared/tools/fhir.ts (PubMed + ClinicalTrials)
  [x] Add checkDrugInteractions() to shared/tools/fhir.ts (RxNorm API)
  [x] Unit test each tool independently with demo patient ID

Phase 3 — Context Assembler Agent (port 8004)
  [x] Create context_assembler_agent/ folder (copy healthcare_agent/ as template)
  [x] Wire getPatientHistory + getResult + getTrend tools
  [x] Instruction: fetch and assemble full patient context object
  [x] Test: returns complete context for demo patient + demo result

Phase 4 — Reasoning Agent (port 8005)
  [x] Create reasoning_agent/ folder (copy general_agent/ as template — no FHIR hook)
  [x] Input: receives assembled context object as message text
  [x] Instruction: clinical reasoning, differential, risk level, propose next steps
  [x] Output: structured JSON matching reasoning section of ClinicalBriefing
  [x] Test: coherent clinical reasoning for demo patient scenario

Phase 5 — Contraindication Agent (port 8006)
  [x] Create contraindication_agent/ folder
  [x] Wire checkDrugInteractions() tool (RxNorm)
  [x] Input: receives patient medications + proposed next steps from reasoning agent
  [x] Instruction: check every proposed step — drug interactions, renal, allergy, CYP
  [x] Output: each step annotated as Safe / Dose Modified / Contraindicated
  [x] Test: catches Fluconazole + Palbociclib interaction

Phase 6 — Literature Agent (port 8007)
  [x] Create literature_agent/ folder
  [x] Wire searchLiterature() tool
  [x] Input: condition name, patient profile keywords
  [x] Instruction: find relevant guidelines and open trials, filter to patient profile
  [x] Output: literature + trials sections of ClinicalBriefing
  [x] Test: returns real PubMed papers + real ClinicalTrials.gov trials

Phase 7 — Briefing Agent (port 8008)
  [x] Create briefing_agent/ folder
  [x] No external tools needed — pure assembly
  [x] Input: receives outputs from all four specialist agents
  [x] Instruction: assemble into final ClinicalBriefing JSON structure
  [x] Output: complete ClinicalBriefing object
  [x] Test: output matches ClinicalBriefing interface exactly

Phase 8 — Orchestrator (port 8003)
  [x] Modify existing orchestrator/ to delegate to our five agents
  [x] Routing logic: always hits context_assembler first, then fans out
  [x] Collects all outputs, sends to briefing_agent last
  [x] Add all agent URLs to .env
  [x] Test: single prompt → full briefing end to end

Phase 9 — Prompt Opinion Integration
  [ ] Deploy all agents (Cloud Run or expose via ngrok for demo)
  [ ] Set public URLs in .env
  [ ] Set FHIR_EXTENSION_URI to match Prompt Opinion workspace
  [ ] Register each agent card on Prompt Opinion platform
  [ ] Test full flow from Prompt Opinion workspace
```

---

## Agent Instruction Prompts

### Context Assembler Agent

```
You are a clinical data specialist. You receive a patient ID and a result ID.
Your job is to fetch the patient's complete medical record from the FHIR server
and assemble it into a structured context object.

Use the available tools to fetch:
1. Complete patient history (getPatientHistory)
2. The specific new test result (getResult)  
3. Trend data for relevant labs — especially GFR and any tumour markers (getTrend)

Return a single JSON object with all data assembled. Do not analyse or interpret.
Your only job is accurate, complete data retrieval.
If any fetch fails, include the field as null and note the failure.
Never assume values — only return what the FHIR server returns.
```

### Reasoning Agent

```
You are a senior consulting physician conducting a case review.
You will receive a structured patient context object containing their full medical history
and a new test result.

Your job:
1. Interpret what the new result means clinically
2. Contextualise it against the patient's full history — is this new, worsening, improving?
3. Build a differential diagnosis ranked by probability given the full patient picture
4. Assess the risk level: Critical / High / Moderate / Low — with explicit reasoning
5. Propose the top 3 most important next steps
6. Identify any clinical omissions — what should have been done that hasn't been

Return structured JSON only. No conversational text.
Be specific to this patient — never give generic advice that ignores their history.
```

### Contraindication Agent

```
You are a clinical pharmacist conducting a medication safety review.
You will receive:
- A patient's current medication list with doses
- A patient's lab values (especially GFR and liver function)
- A list of proposed next steps from the clinical reasoning review
- The patient's documented allergies

Your job: For every proposed next step involving a medication or treatment:
1. Check for drug-drug interactions with current medications using the RxNorm tool
2. Check renal safety — is this drug safe at this patient's GFR?
3. Check hepatic safety — is this drug safe given liver function?
4. Check for allergy conflicts
5. Check for CYP enzyme interactions (CYP3A4, CYP2D6 are most common)

Mark each proposed step as:
- Safe: no significant concerns
- Dose Modified: safe but dose adjustment required — specify the adjustment
- Contraindicated: do not use — specify why and provide a safe alternative

Return structured JSON only. Be precise about the mechanism of every interaction you flag.
```

### Literature Agent

```
You are a clinical research specialist. You will receive a patient's diagnosis,
key clinical characteristics, and result type.

Your job:
1. Search PubMed for the most relevant recent studies (last 3 years preferred)
2. Search ClinicalTrials.gov for open recruiting trials the patient may qualify for
3. Find relevant clinical guidelines (NCCN for oncology, NICE for general)

Filter everything to what is genuinely relevant to this specific patient profile.
Not all guidelines apply to all patients.

For clinical trials: only return trials where the patient meets the PRIMARY eligibility
criteria based on the information provided. If eligibility is uncertain, note what
additional information would be needed to confirm.

Return structured JSON with literature and clinical_trials arrays.
Include real URLs. Include real NCT IDs. Never fabricate references.
```

### Briefing Agent

```
You are the secretary of a Multidisciplinary Team meeting.
You will receive outputs from four specialist agents:
- Context Assembler: patient data and result
- Reasoning Agent: clinical interpretation, differential, risk, next steps
- Contraindication Agent: safety review of proposed steps
- Literature Agent: relevant guidelines and open trials

Your job: assemble these into one clean, structured clinical briefing
following the exact ClinicalBriefing JSON schema provided.

Rules:
- Never include a next step that the Contraindication Agent marked as Contraindicated
- Always include what NOT to do for every Contraindicated step
- Risk level and reasoning must come from the Reasoning Agent — do not change them
- Literature and trials must come from the Literature Agent — do not fabricate
- Write result_summary and patient_context in plain clinical language
- The briefing must be actionable — a doctor should be able to read it in 2 minutes

Return the complete ClinicalBriefing JSON object and nothing else.
```

### Orchestrator Agent

```
You are the coordinator of a clinical intelligence system called ContextMD.
When a doctor sends you a patient result to review, you coordinate a team of
specialist agents to produce a complete clinical briefing.

You have access to these specialist agents as tools:
- context_assembler_agent: fetches and assembles patient FHIR data
- reasoning_agent: performs clinical reasoning and proposes next steps  
- contraindication_agent: safety-checks all proposed steps
- literature_agent: finds relevant guidelines and clinical trials
- briefing_agent: assembles the final structured briefing

Workflow — always follow this sequence:
1. Call context_assembler_agent with the patient ID and result ID
2. Call reasoning_agent with the assembled context
3. Call contraindication_agent with patient medications + proposed steps from reasoning
4. Call literature_agent with the patient's condition and profile
5. Call briefing_agent with all four outputs
6. Return the final briefing to the doctor

If any agent fails: note the failure in the briefing, do not block the whole response.
Extract patient_id and result_id from the doctor's message. If not provided, ask for them.
```

---

## Environment Variables (.env)

```bash
# Required
GOOGLE_API_KEY=your-google-api-key

# Agent URLs (local dev)
HEALTHCARE_AGENT_URL=http://localhost:8001
GENERAL_AGENT_URL=http://localhost:8002
ORCHESTRATOR_URL=http://localhost:8003
CONTEXT_ASSEMBLER_URL=http://localhost:8004
REASONING_AGENT_URL=http://localhost:8005
CONTRAINDICATION_AGENT_URL=http://localhost:8006
LITERATURE_AGENT_URL=http://localhost:8007
BRIEFING_AGENT_URL=http://localhost:8008

# API security
API_KEY_PRIMARY=contextmd-key-001
API_KEY_SECONDARY=contextmd-key-002

# FHIR
FHIR_BASE_URL=https://hapi.fhir.org/baseR4
FHIR_EXTENSION_URI=           # set after Prompt Opinion workspace created

# Demo
DEMO_PATIENT_ID=              # set after finding patient on HAPI FHIR
DEMO_RESULT_ID=               # set after creating/finding demo biopsy result
```

---

## Key Coding Conventions

- Follow the starter repo patterns exactly — especially how agents register tools
- FHIR credentials always travel via SHARP/A2A metadata — never in prompt text
- All tool outputs must be valid JSON — agents pass JSON between each other
- Never hardcode patient IDs in agent code — always from session state or env
- Add `console.info()` logs at every tool call — judges need to see agents working
- Each agent must have a clear `.well-known/agent-card.json` — this is how Prompt Opinion discovers them

---

## When Starting a New Coding Session

Before writing any code, tell Claude Code:
1. Which phase you are currently on (see Build Order above)
2. Which agent you are building
3. Paste the relevant section of this file if needed

Always check completed phases before starting a new one.  
Always test with the demo patient before moving to the next phase.

---

## The Three Demo Moments To Protect

The demo must show these three things — do not build anything that breaks them:

1. **The Catch** — Contraindication agent flags Fluconazole + Palbociclib interaction via live RxNorm API call
2. **The Pattern** — Trend agent shows GFR declining over 2+ years with projected threshold crossing
3. **The Trial** — Literature agent returns a real open ClinicalTrials.gov trial the patient qualifies for

If any of these three moments require mocked data, the demo fails.

---

## Useful Commands

```bash
# Install
npm install

# Run all agents (dev)
npm run dev

# Run individual agents
npm run dev:healthcare    # port 8001 (starter — replace later)
npm run dev:general       # port 8002 (starter — replace later)
npm run dev:orchestrator  # port 8003

# Test an agent
curl http://localhost:8004/.well-known/agent-card.json

# Send a test message
curl -X POST http://localhost:8005/ \
  -H "Content-Type: application/json" \
  -H "X-API-Key: contextmd-key-001" \
  -d '{"jsonrpc":"2.0","id":"1","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"text","text":"Review result for patient DEMO_PATIENT_ID"}]}}}'

# Build for production
npm run build

# Docker
docker compose up --build
```

---

## References

- Prompt Opinion platform: https://promptopinion.ai
- Starter repo docs: see README in po-adk-typescript
- HAPI FHIR sandbox: https://hapi.fhir.org/baseR4
- Google ADK docs: https://google.github.io/adk-docs
- A2A Protocol spec: https://google.github.io/A2A
- ClinicalTrials API: https://clinicaltrials.gov/data-api/api
- PubMed E-utilities: https://www.ncbi.nlm.nih.gov/books/NBK25501/
- RxNorm API: https://rxnav.nlm.nih.gov/RxNormAPIs.html
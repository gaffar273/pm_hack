# ContextMD -- Agent-by-Agent Breakdown

Detailed explanation of each agent: what it does, how it's built, its tools, its LLM prompt, and example input/output.

---

## Agent 1: Context Assembler (Port 8004)

**Role:** Clinical data specialist. Fetches the complete patient record from FHIR and assembles it into one unified context object.

**File:** `context_assembler_agent/agent.ts` (58 lines)
**Model:** gemini-2.5-flash
**Has FHIR Hook:** Yes (reads FHIR credentials from session state)

### Tools Available (7 total)

| Tool | Source | What It Does |
|---|---|---|
| `getPatientHistory` | contextmd_tools.ts | Fetches Patient + Conditions + Medications + Allergies + Observations + Procedures + CarePlans in one parallel call |
| `getResult` | contextmd_tools.ts | Fetches one specific DiagnosticReport or Observation by ID |
| `getTrend` | contextmd_tools.ts | Time-series for any LOINC code with trend direction + rate + projection |
| `getPatientDemographics` | fhir.ts | Patient name, DOB, gender, contacts, address |
| `getActiveMedications` | fhir.ts | All active MedicationRequests with dosage |
| `getActiveConditions` | fhir.ts | All active Conditions with ICD-10 codes |
| `getRecentObservations` | fhir.ts | Last 20 lab/vital observations |

### How getPatientHistory Works (The Big One)

This tool makes 7 FHIR API calls **in parallel** using `Promise.all`:

```
GET /Patient/{id}
GET /Condition?patient={id}&clinical-status=active&_count=50
GET /MedicationRequest?patient={id}&status=active&_count=50
GET /AllergyIntolerance?patient={id}&clinical-status=active&_count=20
GET /Observation?patient={id}&_sort=-date&_count=30&category=laboratory
GET /Procedure?patient={id}&_sort=-date&_count=20
GET /CarePlan?patient={id}&status=active&_count=10
```

Returns a unified JSON object:
```json
{
  "status": "success",
  "patient": { "id": "1000", "name": "Eleanor Marie Thompson", "birthDate": "1967-03-15", "gender": "female" },
  "conditions": [
    { "text": "HR+/HER2- Invasive Ductal Carcinoma, Left Breast, Stage IIIA", "onset": "2021-06-15" },
    { "text": "Chronic Kidney Disease Stage 3b", "onset": "2022-03-10" }
  ],
  "medications": [
    { "name": "Letrozole 2.5mg", "dosage": "Letrozole 2.5mg orally once daily", "authoredOn": "2025-01-01" },
    { "name": "Fluconazole 200mg", "dosage": "Fluconazole 200mg orally once daily (CYP3A4 inhibitor)" }
  ],
  "allergies": [{ "substance": "Penicillin", "criticality": "high", "reactions": ["Anaphylaxis"] }],
  "recentLabs": [{ "name": "eGFR (MDRD)", "value": "31 mL/min/1.73m2", "date": "2025-05-01" }],
  "procedures": [{ "name": "Lumpectomy", "performed": "2022-06-20", "status": "completed" }]
}
```

### How getTrend Works

Fetches all historical Observations for a LOINC code, sorts by date, then computes:
- Linear trend (declining / improving / stable)
- Rate of change per year
- Percentage change over the period
- 12-month linear projection
- Auto-generated clinical note

Example call: `getTrend({ loincCode: "33914-3", patientId: "1000" })`
LOINC 33914-3 = eGFR (Glomerular Filtration Rate)

Example output:
```json
{
  "status": "success",
  "loincCode": "33914-3",
  "unit": "mL/min/1.73m2",
  "dataPoints": [
    { "date": "2022-01-10", "value": 55, "unit": "mL/min/1.73m2" },
    { "date": "2025-05-01", "value": 31, "unit": "mL/min/1.73m2" }
  ],
  "summary": {
    "count": 12,
    "totalChange": "-24.00",
    "percentChange": "-43.6%",
    "changePerYear": "-7.27 mL/min/1.73m2/year",
    "trend": "declining",
    "projectedValueIn12Months": "23.7",
    "clinicalNote": "mL/min/1.73m2 has decreased by 24.0 over 40 months -- rate: -7.27/year. Projected: 23.7 in 12 months."
  }
}
```

---

## Agent 2: Clinical Reasoning Agent (Port 8005)

**Role:** Senior consulting physician conducting a case review.
**File:** `reasoning_agent/agent.ts` (55 lines)
**Model:** gemini-2.5-pro (upgraded for better clinical reasoning quality)
**Tools:** None -- pure LLM reasoning on the assembled context

This agent receives the full patient context JSON from the Context Assembler and produces:

1. **Result interpretation** -- what the biopsy finding means clinically
2. **Contextualisation** -- is this new, worsening, improving vs history?
3. **Differential diagnosis** -- ranked by probability
4. **Risk assessment** -- Critical/High/Moderate/Low with explicit reasoning
5. **Proposed next steps** -- top 3-5 actions with rationale
6. **Clinical omissions** -- what should have been done that hasn't

Example output structure:
```json
{
  "result_summary": "New breast biopsy shows Grade 3 invasive ductal carcinoma with Ki-67 42%, indicating aggressive disease progression despite Letrozole therapy...",
  "risk_assessment": {
    "level": "Critical",
    "reasoning": "Dual crisis: aggressive endocrine-resistant cancer + rapidly declining renal function (eGFR 31) limiting treatment options..."
  },
  "differential": [
    { "condition": "Endocrine-resistant HR+ breast cancer progression", "probability": "High", "reasoning": "..." },
    { "condition": "De novo triple-negative transformation", "probability": "Low", "reasoning": "ER/PR still positive" }
  ],
  "next_steps": [
    { "action": "Stop Metformin 1000mg BID immediately", "rationale": "Unsafe at eGFR 31 -- lactic acidosis risk" },
    { "action": "Start Palbociclib + Fulvestrant", "rationale": "Standard second-line for endocrine-resistant HR+ disease" },
    { "action": "Urgent PET/CT staging", "rationale": "Assess for distant metastasis" }
  ]
}
```

---

## Agent 3: Contraindication Agent (Port 8006)

**Role:** Clinical pharmacist conducting medication safety review.
**File:** `contraindication_agent/agent.ts` (70 lines)
**Model:** gemini-2.5-flash
**Tools:** `checkDrugInteractions` (RxNorm), `getOpenFdaAdverseEvents` (OpenFDA)

### How checkDrugInteractions Works

Three-step process:

**Step 1: Resolve drug names to RxNorm CUIs**
```
GET https://rxnav.nlm.nih.gov/REST/rxcui.json?name=Fluconazole&search=1
GET https://rxnav.nlm.nih.gov/REST/rxcui.json?name=Palbociclib&search=1
GET https://rxnav.nlm.nih.gov/REST/rxcui.json?name=Letrozole&search=1
```

**Step 2: Check interactions for all resolved CUIs**
```
GET https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=4450+1547220+72965
```

**Step 3: Return structured interactions**
```json
{
  "status": "success",
  "totalInteractionsFound": 3,
  "interactions": [
    {
      "drug1": "fluconazole",
      "drug2": "palbociclib",
      "severity": "high",
      "description": "CYP3A4 inhibitor increases plasma levels of CYP3A4 substrate...",
      "source": "DrugBank"
    }
  ]
}
```

### How getOpenFdaAdverseEvents Works
```
GET https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:palbociclib&count=patient.reaction.reactionmeddrapt.exact
```
Returns top 5 most reported adverse events for a drug from FDA's real adverse event database.

### Contraindication Agent Output
```json
{
  "safety_review": [
    {
      "proposed_action": "Start Palbociclib 125mg",
      "status": "Contraindicated",
      "concerns": ["Severe CYP3A4 interaction with concurrent Fluconazole"],
      "mechanism": "Fluconazole is a strong CYP3A4 inhibitor. Palbociclib is a CYP3A4 substrate. Co-administration raises Palbociclib AUC by up to 87%.",
      "fda_adverse_events": ["Neutropenia (45,231)", "Anaemia (12,847)", "Fatigue (11,502)"],
      "recommendation": "Do NOT start Palbociclib while on Fluconazole",
      "alternative": "Consider Ribociclib or discontinue Fluconazole first"
    }
  ],
  "do_not_do": [
    {
      "action": "Administer Palbociclib with concurrent Fluconazole",
      "reason": "CYP3A4 interaction -- Fluconazole raises Palbociclib AUC by 87%",
      "alternative": "Ribociclib, or stop Fluconazole 5 half-lives before starting Palbociclib"
    }
  ],
  "critical_flags": ["Metformin 1000mg BID unsafe at eGFR 31 -- immediate lactic acidosis risk"]
}
```

---

## Agent 4: Literature Agent (Port 8007)

**Role:** Clinical research specialist.
**File:** `literature_agent/agent.ts` (69 lines)
**Model:** gemini-2.5-flash
**Tools:** `searchLiterature`

### How searchLiterature Works

Two parallel searches:

**PubMed (NCBI E-utilities):**
```
GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
  ?db=pubmed&term=breast+cancer+HR%2B+HER2-+CDK4%2F6+inhibitor+treatment
  &sort=relevance&retmax=5&retmode=json&datetype=pdat&mindate=2022&maxdate=2025

GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi
  ?db=pubmed&id=38901234,38765432,...&retmode=json
```

**ClinicalTrials.gov (API v2):**
```
GET https://clinicaltrials.gov/api/v2/studies
  ?query.cond=Breast+Cancer&filter.overallStatus=RECRUITING
  &pageSize=5&fields=NCTId,BriefTitle,OverallStatus,Phase,EligibilityCriteria,BriefSummary
```

Returns real PMIDs, real NCT IDs, real URLs. The LLM then filters to what's relevant to Eleanor's specific profile.

---

## Agent 5: Briefing Agent (Port 8008)

**Role:** Secretary of the MDT meeting. Assembles all outputs into the final ClinicalBriefing JSON.
**File:** `briefing_agent/agent.ts` (89 lines)
**Model:** gemini-2.5-flash
**Tools:** None -- pure assembly

### Rules Enforced
- NEVER include a next_step the Contraindication Agent marked as Contraindicated
- ALWAYS include do_not_do entries for every Contraindicated step with alternatives
- Risk level and reasoning MUST come from the Reasoning Agent unchanged
- Literature and trials MUST come from the Literature Agent (never fabricated)
- Briefing must be readable by a doctor in under 2 minutes

### Final ClinicalBriefing JSON Schema
```json
{
  "result_summary": "2-3 sentences, plain clinical language",
  "patient_context": "Relevant history, previous same results",
  "trend_analysis": "Direction, rate, clinical projection",
  "risk_assessment": { "level": "Critical|High|Moderate|Low", "reasoning": "..." },
  "differential": [{ "condition": "...", "probability": "High|Medium|Low", "reasoning": "..." }],
  "next_steps": [{ "action": "...", "status": "Safe|Dose Modified", "reason": "...", "alternative": null }],
  "do_not_do": [{ "action": "...", "reason": "...", "alternative": "..." }],
  "literature": [{ "source": "...", "relevance": "...", "key_recommendation": "...", "url": "..." }],
  "clinical_trials": [{ "nct_id": "...", "title": "...", "status": "...", "patient_match": "...", "key_result": "...", "url": "..." }]
}
```

---

## Agent 6: Orchestrator (Port 8003)

**Role:** Entry point. Receives doctor prompt, coordinates all 5 agents, returns final briefing.
**File:** `orchestrator/server.ts` (534 lines) -- custom Express server
**Also:** `orchestrator/agent.ts` (77 lines) -- ADK agent definition (backup path)

### The Pipeline (Full MDT Mode)

```
Step 1: Context Assembler    [BLOCKING -- fail = abort]    ~15-20s
Step 2: Clinical Reasoning   [BLOCKING -- fail = abort]    ~20-30s
Step 3: Contraindication     [PARALLEL with Step 4]        ~10-15s
Step 4: Literature Search    [PARALLEL with Step 3]        ~10-15s
Step 5: Briefing Assembly    [BLOCKING]                    ~10-15s
                                              Total:       ~60-90s
```

### What-If Mode (Fast Path)

When the user's message contains "what if", "follow up", or "how about":
1. Skip full pipeline
2. Reuse cached patient context from the session
3. Send directly to Contraindication Agent
4. Return safety analysis in ~5-15 seconds

### Session Caching

The orchestrator caches patient context per `contextId` with a 30-minute TTL. Follow-up questions in the same session reuse the cached FHIR data instead of re-fetching.

### SHARP Context Resolution Priority
1. A2A message metadata (from Prompt Opinion)
2. `x-sharp-context` HTTP header
3. Natural language parsing from prompt text (regex)
4. `.env` defaults (DEMO_PATIENT_ID / DEMO_RESULT_ID)

---

> **Continue reading:** [PROGRESS_TOOLS.md](./PROGRESS_TOOLS.md) for tools & APIs, [PROGRESS_STATUS.md](./PROGRESS_STATUS.md) for build status

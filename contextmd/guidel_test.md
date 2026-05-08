# ContextMD — API Testing Guide

A step-by-step guide for any team member to test the **ContextMD Orchestrator** using Postman or cURL.  
No code experience needed — just follow the steps below.

---

## 📋 Prerequisites

Before testing, make sure the following are running locally:

| Service | Command | Expected |
|---|---|---|
| HAPI FHIR (Docker) | `docker start hapi-fhir` | Container started |
| All Agents | `npm run dev` | 6 agents boot on ports 8003–8008 |

> **Note:** `npm run dev` now automatically starts the Docker container for you.

---

## 🔧 Postman Setup

### Step 1 — Create a new Postman Collection

1. Open Postman → click **New** → **Collection**
2. Name it: `ContextMD Tests`

### Step 2 — Set a Collection Variable

This avoids hardcoding the URL across every request:

1. Go to your collection → **Variables** tab
2. Add:

| Variable | Initial Value | Current Value |
|---|---|---|
| `baseUrl` | `http://localhost:8003` | `http://localhost:8003` |
| `apiKey` | `contextmd-key-001` | `contextmd-key-001` |

### Step 3 — Add Headers to every request

Under the collection → **Pre-request Script** or per-request **Headers** tab, add:

| Key | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-API-Key` | `{{apiKey}}` |

### Step 4 — Request config

- **Method:** `POST`
- **URL:** `{{baseUrl}}/`
- **Body:** `raw` → `JSON`

---

## 🧪 Test Scenarios

Paste any of the payloads below into the **Body** tab of Postman.  
Replace `"messageId"` with any unique string or use a UUID generator (Postman has `{{$guid}}` built in).

---

### ✅ Scenario 1 — Full MDT Pipeline (Slowest, Most Complete)

**What it does:** Triggers all 5 agents in sequence — context assembly, clinical reasoning, drug safety, literature search, and final briefing.  
**Expected response time:** ~60–90 seconds  
**What to verify:** Response should contain a structured JSON or Markdown briefing with risk level, next steps, and drug safety flags.

```json
{
  "jsonrpc": "2.0",
  "id": "{{$guid}}",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "{{$guid}}",
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "text": "Review the latest diagnostic results for the demo patient and provide a full MDT clinical briefing with recommended next steps."
        }
      ]
    }
  }
}
```

---

### ⚡ Scenario 2 — What If? Conversational Follow-up (Fast)

**What it does:** Triggers the "What If" short-circuit. Skips FHIR assembly and goes directly to the Contraindication Agent for real-time drug safety analysis.  
**Expected response time:** ~5–15 seconds  
**What to verify:** Response should contain `safety_review`, list of `concerns`, `fda_adverse_events`, and a `recommendation`.

```json
{
  "jsonrpc": "2.0",
  "id": "{{$guid}}",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "{{$guid}}",
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "text": "What if we add a CDK4/6 inhibitor to the current regimen?"
        }
      ]
    }
  }
}
```

> 💡 **Try other What-If prompts too:**
> - `"What if we use Ribociclib instead of Palbociclib?"`
> - `"What if we switch to Exemestane?"`
> - `"How about adding Everolimus?"`

---

### 🔴 Scenario 3 — High-Risk Drug Interaction (Danger Test)

**What it does:** Asks about combining a drug that has a known severe CYP3A4 interaction with the patient's existing Fluconazole prescription.  
**Expected response time:** ~5–15 seconds  
**What to verify:** Agent must flag this as **Contraindicated**, list the mechanism (CYP3A4 inhibition), include real FDA adverse events, and suggest a safe alternative.

```json
{
  "jsonrpc": "2.0",
  "id": "{{$guid}}",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "{{$guid}}",
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "text": "What if we start Palbociclib while the patient is still on Fluconazole?"
        }
      ]
    }
  }
}
```

---

### 🟡 Scenario 4 — Renal Dose Adjustment (Edge Case)

**What it does:** Tests renal-function-aware drug safety. The demo patient has eGFR 31 (Stage 3b CKD).  
**Expected response time:** ~5–15 seconds  
**What to verify:** Agent should flag **Dose Modified** status and recommend a reduced dose with the mechanism (renal clearance impairment).

```json
{
  "jsonrpc": "2.0",
  "id": "{{$guid}}",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "{{$guid}}",
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "text": "What if we continue the current Metformin dose given the patient's kidney function?"
        }
      ]
    }
  }
}
```

---

### 🔵 Scenario 5 — Open-Ended Clinical Question

**What it does:** Tests how the full pipeline handles a general prognostic question where no specific drug or test is being asked about.  
**Expected response time:** ~60–90 seconds  
**What to verify:** Response should still trigger a full briefing summarizing trend data, risk level, and MDT recommendations.

```json
{
  "jsonrpc": "2.0",
  "id": "{{$guid}}",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "{{$guid}}",
      "role": "user",
      "parts": [
        {
          "kind": "text",
          "text": "Based on all available data, what is the overall clinical outlook for this patient and what should be prioritized in the next MDT meeting?"
        }
      ]
    }
  }
}
```

---

## 🖥️ Quick Test via cURL (No Postman Needed)

Copy-paste this into any terminal (replace the `text` value with any prompt):

```bash
curl -X POST http://localhost:8003/ \
  -H "Content-Type: application/json" \
  -H "X-API-Key: contextmd-key-001" \
  -d '{
    "jsonrpc": "2.0",
    "id": "curl-test-001",
    "method": "message/send",
    "params": {
      "message": {
        "messageId": "curl-msg-001",
        "role": "user",
        "parts": [{"kind": "text", "text": "What if we add Ribociclib?"}]
      }
    }
  }'
```

---

## ✅ What a Passing Response Looks Like

A valid response will be a JSON object structured like this:

```json
{
  "jsonrpc": "2.0",
  "id": "<your request id>",
  "result": {
    "kind": "message",
    "role": "agent",
    "parts": [
      {
        "kind": "text",
        "text": "{ ... clinical briefing JSON or markdown ... }"
      }
    ]
  }
}
```

**Key things to verify in the response:**
- `result.parts[0].text` should be non-empty and contain clinical content
- For What-If prompts: look for `safety_review`, `status`, `mechanism`, `fda_adverse_events`
- For full MDT prompts: look for `result_summary`, `recommended_next_steps`, `critical_flags`
- HTTP status should always be `200`

---

## ❌ Common Errors

| Error | Cause | Fix |
|---|---|---|
| `Connection refused` | Agents not running | Run `npm run dev` |
| `HTTP 401 Unauthorized` | Missing or wrong API key | Check `X-API-Key` header value |
| `HTTP 408 / timeout` | Docker FHIR is not running | Run `docker start hapi-fhir` |
| Empty `text` response | Agent returned no output | Check terminal logs for errors |

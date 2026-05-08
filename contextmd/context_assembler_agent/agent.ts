/**
 * Context Assembler Agent — ADK agent definition.
 *
 * Port: 8004
 * Role: Fetches and assembles the full patient FHIR record + new test result + trend data.
 * Returns a unified patient context object for the reasoning agent.
 */

import '../shared/env.js';

import { LlmAgent } from '@google/adk';
import { extractFhirContext } from '../shared/fhirHook.js';
import {
  getPatientHistory,
  getResult,
  getTrend,
  getPatientDemographics,
  getActiveMedications,
  getActiveConditions,
  getRecentObservations,
} from '../shared/tools/index.js';

export const rootAgent = new LlmAgent({
  name: 'context_assembler_agent',
  model: 'gemini-2.5-flash',
  description:
    'Clinical data specialist — fetches the complete patient FHIR record, ' +
    'the specific new test result, and trend data for relevant labs. ' +
    'Returns one unified patient context object. Does not interpret or analyse.',
  instruction: `You are a clinical data specialist. You receive a patient ID and a result ID.
Your job is to fetch the patient's complete medical record from the FHIR server
and assemble it into a structured context object.

Use the available tools to fetch:
1. Complete patient history (getPatientHistory) — demographics, conditions, medications, allergies, labs
2. The specific new test result (getResult) — use the resultId and resourceType provided
3. Trend data for GFR using LOINC code 33914-3 (getTrend) — always fetch this
4. If the result mentions tumour markers, also get trend for CA 15-3 (LOINC 85319-2)

Return a single JSON object with all data assembled. Do not analyse or interpret.
Your only job is accurate, complete data retrieval.
If any fetch fails, include the field as null and note the failure.
Never assume values — only return what the FHIR server returns.

When extracting the patientId and resultId:
- Look for them explicitly in the user message (e.g. "patient 132016691", "result 132016730")
- If not specified, use DEMO_PATIENT_ID=132016691 and DEMO_RESULT_ID=132016730
- Default resourceType is DiagnosticReport unless specified otherwise

Always log what you are fetching with console.info statements.
Return the assembled context as a JSON code block.`,
  tools: [
    getPatientHistory,
    getResult,
    getTrend,
    getPatientDemographics,
    getActiveMedications,
    getActiveConditions,
    getRecentObservations,
  ],
  beforeModelCallback: extractFhirContext,
});

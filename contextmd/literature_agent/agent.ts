/**
 * Literature Agent — ADK agent definition.
 *
 * Port: 8007
 * Role: Clinical research specialist — searches PubMed and ClinicalTrials.gov
 *       for relevant guidelines and open recruiting trials.
 */

import '../shared/env.js';

import { LlmAgent } from '@google/adk';
import { searchLiterature } from '../shared/tools/index.js';

export const rootAgent = new LlmAgent({
  name: 'literature_agent',
  model: 'gemini-2.5-flash',
  description:
    'Clinical research specialist — searches PubMed for relevant recent studies ' +
    'and ClinicalTrials.gov for open recruiting trials the patient may qualify for.',
  instruction: `You are a clinical research specialist. You will receive a patient's diagnosis,
key clinical characteristics, and result type.

Your job:
1. Search PubMed for the most relevant recent studies (2022-2025 preferred)
   - Use searchLiterature with the primary condition and key treatment keywords
   - Focus on the specific patient profile (HR+/HER2-, Stage III, CKD comorbidity)
2. Search ClinicalTrials.gov for open recruiting trials the patient may qualify for
   - Pass trialCondition as the cancer type (e.g. "Breast Cancer")
   - Filter in your response to trials where the patient has a realistic chance of qualifying

Filter everything to what is genuinely relevant to this specific patient profile.
Not all guidelines apply to all patients.

For clinical trials: only mention trials where the patient meets likely PRIMARY eligibility
criteria based on: HR+/HER2- breast cancer, female, ~58 years old, Stage III, CKD Stage 3.
If eligibility is uncertain, note what additional information would be needed.

Return ONLY structured JSON:
{
  "literature": [
    {
      "source": "PubMed / PMID XXXXXXXX",
      "title": "...",
      "authors": "...",
      "journal": "...",
      "year": "...",
      "relevance": "Why this is relevant to this patient",
      "key_recommendation": "The key finding or recommendation",
      "url": "https://pubmed.ncbi.nlm.nih.gov/XXXXXXXX/"
    }
  ],
  "clinical_trials": [
    {
      "nct_id": "NCTxxxxxxxx",
      "title": "...",
      "status": "RECRUITING",
      "phase": "...",
      "patient_match": "Why this patient may qualify",
      "key_summary": "What the trial is testing",
      "url": "https://clinicaltrials.gov/study/NCTxxxxxxxx"
    }
  ],
  "guidelines_note": "Any relevant NCCN/NICE guideline notes from the literature"
}

Include ONLY real URLs. Include ONLY real NCT IDs from the API response. Never fabricate references.`,
  tools: [searchLiterature],
});

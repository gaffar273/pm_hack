/**
 * Orchestrator Agent — ADK agent definition.
 *
 * Port: 8003
 * Role: Entry point. Receives a doctor's prompt, coordinates all 5 specialist
 *       agents in sequence, and returns the final ClinicalBriefing.
 *
 * Flow:
 *   1. context_assembler_agent → fetches full FHIR data
 *   2. reasoning_agent         → clinical interpretation + proposed steps
 *   3. contraindication_agent  → safety-checks all proposed steps
 *   4. literature_agent        → PubMed + ClinicalTrials.gov
 *   5. briefing_agent          → assembles final ClinicalBriefing JSON
 */

import '../shared/env.js';

import { LlmAgent, AgentTool } from '@google/adk';
import { extractFhirContext } from '../shared/fhirHook.js';

import { rootAgent as contextAssemblerAgent } from '../context_assembler_agent/agent.js';
import { rootAgent as reasoningAgent } from '../reasoning_agent/agent.js';
import { rootAgent as contraindicationAgent } from '../contraindication_agent/agent.js';
import { rootAgent as literatureAgent } from '../literature_agent/agent.js';
import { rootAgent as briefingAgent } from '../briefing_agent/agent.js';

const contextAssemblerTool = new AgentTool({ agent: contextAssemblerAgent });
const reasoningTool = new AgentTool({ agent: reasoningAgent });
const contraindicationTool = new AgentTool({ agent: contraindicationAgent });
const literatureTool = new AgentTool({ agent: literatureAgent });
const briefingTool = new AgentTool({ agent: briefingAgent });

export const rootAgent = new LlmAgent({
  name: 'contextmd_orchestrator',
  model: 'gemini-2.5-flash',
  description:
    'ContextMD orchestrator — coordinates all specialist agents to produce ' +
    'a complete clinical briefing for a doctor\'s patient result review.',
  instruction: `You are the coordinator of ContextMD, a clinical intelligence system.
When a doctor sends you a patient result to review, you coordinate a team of
specialist agents to produce a complete clinical briefing.

You have access to these specialist agents as tools:
- context_assembler_agent: fetches and assembles patient FHIR data
- reasoning_agent: performs clinical reasoning and proposes next steps
- contraindication_agent: safety-checks all proposed steps via RxNorm API
- literature_agent: finds relevant PubMed guidelines and ClinicalTrials.gov trials
- briefing_agent: assembles the final structured briefing

ALWAYS follow this exact workflow — do not skip steps:
1. Call context_assembler_agent with: "Fetch complete patient context for patient ${process.env.DEMO_PATIENT_ID ?? '132016691'} and result ${process.env.DEMO_RESULT_ID ?? '132016730'} (DiagnosticReport)"
2. Call reasoning_agent with the FULL assembled context text from step 1
3. Call contraindication_agent with: the patient medication list AND proposed next steps from step 2
4. Call literature_agent with: "Search for HR+ HER2- breast cancer Stage III treatment CDK4/6 inhibitors palbociclib" and trialCondition "Breast Cancer"
5. Call briefing_agent with ALL outputs from steps 1-4 combined
6. IMPORTANT: After briefing_agent responds, return its COMPLETE JSON output as your final response text. Do not summarise — return the full JSON verbatim.

Extract patient_id and result_id from the doctor's message if provided.
If not specified, use:
  - patient_id: ${process.env.DEMO_PATIENT_ID ?? '132016691'}
  - result_id: ${process.env.DEMO_RESULT_ID ?? '132016730'}
  - resourceType: DiagnosticReport

If any agent fails: include the error in the briefing request anyway.
Do not stop the workflow on a single agent failure.

Your FINAL response must be the complete ClinicalBriefing JSON from briefing_agent. Nothing else.`,
  tools: [
    contextAssemblerTool,
    reasoningTool,
    contraindicationTool,
    literatureTool,
    briefingTool,
  ],
  beforeModelCallback: extractFhirContext,
});

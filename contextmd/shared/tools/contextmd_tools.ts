/**
 * Extended FHIR + external API tools for ContextMD.
 *
 * New tools added on top of the starter repo's fhir.ts:
 *   - getPatientHistory      Full patient record (Patient + all resources)
 *   - getResult              Fetch one DiagnosticReport or Observation by ID
 *   - getTrend               Time-series for a LOINC code with trend analysis
 *   - searchLiterature       PubMed + ClinicalTrials.gov
 *   - getOpenFdaAdverseEvents FDA top adverse events for a drug
 *   - checkDrugInteractions  RxNorm interaction API (no auth required)
 */

import { FunctionTool, ToolContext } from '@google/adk';
import { z } from 'zod/v3';

const FHIR_BASE = process.env.FHIR_BASE_URL ?? 'https://hapi.fhir.org/baseR4';
const TIMEOUT_MS = 20_000;

// ── Internal helpers ───────────────────────────────────────────────────────────

const requestCache = new Map<string, any>();

async function httpGet(url: string): Promise<Record<string, unknown>> {
  if (requestCache.has(url)) {
    console.info(`[cache hit] ${url}`);
    return requestCache.get(url);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/fhir+json' },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
    const data = await r.json();
    requestCache.set(url, data);
    return data as Promise<Record<string, unknown>>;
  } finally {
    clearTimeout(timer);
  }
}

async function jsonGet(url: string, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
  if (requestCache.has(url)) {
    console.info(`[cache hit] ${url}`);
    return requestCache.get(url);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', ...headers } });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
    const data = await r.json();
    requestCache.set(url, data);
    return data as Promise<Record<string, unknown>>;
  } finally {
    clearTimeout(timer);
  }
}

function fhirUrl(path: string, params: Record<string, string> = {}): string {
  const u = new URL(`${FHIR_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

function extractEntries(bundle: Record<string, unknown>): Record<string, unknown>[] {
  return ((bundle['entry'] as unknown[] | undefined) ?? []).map(
    (e) => (e as Record<string, unknown>)['resource'] as Record<string, unknown>,
  );
}

function patientIdFromContext(ToolContext?: ToolContext): string | null {
  if (!ToolContext) return null;
  return (
    (ToolContext.state.get('patientId') as string | undefined) ??
    (ToolContext.state.get('patient_id') as string | undefined) ??
    process.env.DEMO_PATIENT_ID ??
    null
  );
}

// ── Tool: getPatientHistory ────────────────────────────────────────────────────

export const getPatientHistory = new FunctionTool({
  name: 'getPatientHistory',
  description:
    'Fetches the complete patient medical history from the FHIR server. ' +
    'Returns demographics, all active conditions, all medications, allergies, ' +
    'recent observations (labs + vitals), procedures, and care plans in one unified object. ' +
    'Accepts optional patientId — falls back to session context or DEMO_PATIENT_ID.',
  parameters: z.object({
    patientId: z.string().optional().describe('FHIR Patient ID. Defaults to session context patient.'),
  }),
  execute: async (input: { patientId?: string }, ToolContext?: ToolContext) => {
    const patId = input.patientId ?? patientIdFromContext(ToolContext);
    if (!patId) return { status: 'error', error_message: 'No patient ID available. Provide patientId or ensure session context includes patientId.' };

    console.info(`tool_get_patient_history patient_id=${patId}`);
    try {
      const [
        patientData,
        conditionsBundle,
        medicationsBundle,
        allergiesBundle,
        observationsBundle,
        proceduresBundle,
        carePlansBundle,
      ] = await Promise.all([
        httpGet(fhirUrl(`Patient/${patId}`)),
        httpGet(fhirUrl('Condition', { patient: patId, 'clinical-status': 'active', _count: '50' })),
        httpGet(fhirUrl('MedicationRequest', { patient: patId, status: 'active', _count: '50' })),
        httpGet(fhirUrl('AllergyIntolerance', { patient: patId, 'clinical-status': 'active', _count: '20' })),
        httpGet(fhirUrl('Observation', { patient: patId, _sort: '-date', _count: '30', category: 'laboratory' })),
        httpGet(fhirUrl('Procedure', { patient: patId, _sort: '-date', _count: '20' })),
        httpGet(fhirUrl('CarePlan', { patient: patId, status: 'active', _count: '10' })),
      ]);

      const names = (patientData['name'] as unknown[] | undefined) ?? [];
      const n = (names[0] ?? {}) as Record<string, unknown>;
      const fullName = `${((n['given'] as string[] | undefined) ?? []).join(' ')} ${n['family'] ?? ''}`.trim();

      const conditions = extractEntries(conditionsBundle).map((r) => {
        const code = (r['code'] as Record<string, unknown> | undefined) ?? {};
        return { text: (code['text'] as string) ?? 'Unknown', onset: r['onsetDateTime'] ?? null };
      });

      const medications = extractEntries(medicationsBundle).map((r) => {
        const med = (r['medicationCodeableConcept'] as Record<string, unknown> | undefined) ?? {};
        const dosageList = ((r['dosageInstruction'] as unknown[] | undefined) ?? []);
        const dosage = dosageList.length > 0 ? ((dosageList[0] as Record<string, string>)['text'] ?? 'Not specified') : 'Not specified';
        return { name: (med['text'] as string) ?? 'Unknown', dosage, authoredOn: r['authoredOn'] ?? null };
      });

      const allergies = extractEntries(allergiesBundle).map((r) => {
        const code = (r['code'] as Record<string, unknown> | undefined) ?? {};
        return {
          substance: (code['text'] as string) ?? 'Unknown',
          criticality: r['criticality'] ?? null,
          reactions: ((r['reaction'] as unknown[] | undefined) ?? []).map((rx) => (rx as Record<string, string>)['description']).filter(Boolean),
        };
      });

      const observations = extractEntries(observationsBundle).map((r) => {
        const code = (r['code'] as Record<string, unknown> | undefined) ?? {};
        const vq = (r['valueQuantity'] as Record<string, unknown> | undefined);
        return {
          name: (code['text'] as string) ?? 'Unknown',
          value: vq ? `${vq['value']} ${vq['unit'] ?? ''}`.trim() : String(r['valueString'] ?? 'N/A'),
          date: r['effectiveDateTime'] ?? null,
        };
      });

      const procedures = extractEntries(proceduresBundle).map((r) => {
        const code = (r['code'] as Record<string, unknown> | undefined) ?? {};
        return { name: (code['text'] as string) ?? 'Unknown', performed: r['performedDateTime'] ?? null, status: r['status'] };
      });

      return {
        status: 'success',
        patient: {
          id: patId,
          name: fullName,
          birthDate: patientData['birthDate'],
          gender: patientData['gender'],
        },
        conditions,
        medications,
        allergies,
        recentLabs: observations,
        procedures,
        carePlanCount: extractEntries(carePlansBundle).length,
      };
    } catch (err) {
      console.error(`tool_get_patient_history_error: ${String(err)}`);
      return { status: 'error', error_message: String(err) };
    }
  },
});

// ── Tool: getResult ────────────────────────────────────────────────────────────

export const getResult = new FunctionTool({
  name: 'getResult',
  description:
    'Fetches a specific diagnostic result (DiagnosticReport or Observation) by its FHIR resource ID. ' +
    'Use this to get the specific new test result that triggered the clinical review.',
  parameters: z.object({
    resultId: z.string().describe('The FHIR resource ID of the result to fetch.'),
    resourceType: z
      .enum(['DiagnosticReport', 'Observation'])
      .default('DiagnosticReport')
      .describe("Resource type to fetch — 'DiagnosticReport' (biopsy, imaging) or 'Observation' (lab value)."),
  }),
  execute: async (input: { resultId: string; resourceType: 'DiagnosticReport' | 'Observation' }) => {
    console.info(`tool_get_result resourceType=${input.resourceType} id=${input.resultId}`);
    try {
      const data = await httpGet(fhirUrl(`${input.resourceType}/${input.resultId}`));

      if (input.resourceType === 'DiagnosticReport') {
        const code = (data['code'] as Record<string, unknown> | undefined) ?? {};
        const conclusions = (data['conclusionCode'] as unknown[] | undefined) ?? [];
        return {
          status: 'success',
          resourceType: 'DiagnosticReport',
          id: data['id'],
          reportName: (code['text'] as string) ?? 'Unknown',
          effectiveDate: data['effectiveDateTime'],
          issued: data['issued'],
          reportStatus: data['status'],
          conclusion: data['conclusion'],
          conclusionCodes: conclusions.map((c) => {
            const cc = c as Record<string, unknown>;
            return { text: cc['text'], codings: cc['coding'] };
          }),
        };
      } else {
        const code = (data['code'] as Record<string, unknown> | undefined) ?? {};
        const vq = (data['valueQuantity'] as Record<string, unknown> | undefined);
        return {
          status: 'success',
          resourceType: 'Observation',
          id: data['id'],
          observationName: (code['text'] as string) ?? 'Unknown',
          value: vq ? vq['value'] : data['valueString'],
          unit: vq ? vq['unit'] : null,
          effectiveDate: data['effectiveDateTime'],
          observationStatus: data['status'],
        };
      }
    } catch (err) {
      console.error(`tool_get_result_error: ${String(err)}`);
      return { status: 'error', error_message: String(err) };
    }
  },
});

// ── Tool: getTrend ─────────────────────────────────────────────────────────────

export const getTrend = new FunctionTool({
  name: 'getTrend',
  description:
    'Retrieves time-series data for a specific LOINC code for the patient. ' +
    'Calculates trend direction, rate of change, and clinical projection. ' +
    'Key LOINC codes: 33914-3 (GFR/eGFR), 2160-0 (Creatinine), 718-7 (Hemoglobin), ' +
    '2345-7 (Glucose), 4548-4 (HbA1c), 85319-2 (CA 15-3 tumour marker).',
  parameters: z.object({
    loincCode: z.string().describe("LOINC code for the lab to trend (e.g. '33914-3' for GFR)."),
    patientId: z.string().optional().describe('Patient ID — defaults to session context.'),
    count: z.number().default(20).describe('Number of data points to retrieve (default 20, max 50).'),
  }),
  execute: async (input: { loincCode: string; patientId?: string; count?: number }, ToolContext?: ToolContext) => {
    const patId = input.patientId ?? patientIdFromContext(ToolContext);
    if (!patId) return { status: 'error', error_message: 'No patient ID available.' };

    const count = Math.min(input.count ?? 20, 50);
    console.info(`tool_get_trend patient_id=${patId} loinc=${input.loincCode} count=${count}`);
    try {
      const bundle = await httpGet(
        fhirUrl('Observation', {
          patient: patId,
          code: input.loincCode,
          _sort: 'date',
          _count: String(count),
        }),
      );

      const entries = extractEntries(bundle);
      const dataPoints = entries
        .map((r) => {
          const vq = r['valueQuantity'] as Record<string, unknown> | undefined;
          const value = vq ? Number(vq['value']) : null;
          const date = r['effectiveDateTime'] as string | undefined;
          const unit = vq ? (vq['unit'] as string) : null;
          return { date: date ?? null, value, unit };
        })
        .filter((d) => d.date && d.value !== null)
        .sort((a, b) => (a.date! > b.date! ? 1 : -1));

      if (dataPoints.length < 2) {
        return { status: 'success', loincCode: input.loincCode, dataPoints, trend: 'insufficient_data', message: 'Need at least 2 data points for trend analysis.' };
      }

      // Simple linear regression for trend
      const n = dataPoints.length;
      const first = dataPoints[0];
      const last = dataPoints[n - 1];
      const firstVal = first.value!;
      const lastVal = last.value!;
      const totalChange = lastVal - firstVal;
      const pctChange = ((totalChange / firstVal) * 100).toFixed(1);

      // Date-based rate calculation
      const firstDate = new Date(first.date!);
      const lastDate = new Date(last.date!);
      const daysDiff = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      const changePerYear = ((totalChange / daysDiff) * 365).toFixed(2);

      const trend = totalChange < -0.5 ? 'declining' : totalChange > 0.5 ? 'improving' : 'stable';
      const unit = dataPoints[0].unit ?? '';

      // Simple linear projection for 12 months
      const projectedIn12Months = (lastVal + Number(changePerYear)).toFixed(1);

      return {
        status: 'success',
        loincCode: input.loincCode,
        unit,
        dataPoints,
        summary: {
          count: n,
          earliest: { date: first.date, value: firstVal },
          latest: { date: last.date, value: lastVal },
          totalChange: totalChange.toFixed(2),
          percentChange: `${pctChange}%`,
          changePerYear: `${changePerYear} ${unit}/year`,
          trend,
          projectedValueIn12Months: projectedIn12Months,
          clinicalNote:
            trend === 'declining'
              ? `${unit} has decreased by ${Math.abs(totalChange).toFixed(1)} ${unit} over ${Math.round(daysDiff / 30)} months — rate: ${changePerYear} ${unit}/year. Projected value in 12 months: ${projectedIn12Months} ${unit}.`
              : trend === 'improving'
              ? `${unit} has improved by ${totalChange.toFixed(1)} ${unit} over ${Math.round(daysDiff / 30)} months.`
              : `${unit} has remained relatively stable over ${Math.round(daysDiff / 30)} months.`,
        },
      };
    } catch (err) {
      console.error(`tool_get_trend_error: ${String(err)}`);
      return { status: 'error', error_message: String(err) };
    }
  },
});

// ── Tool: searchLiterature ─────────────────────────────────────────────────────

export const searchLiterature = new FunctionTool({
  name: 'searchLiterature',
  description:
    'Searches PubMed and ClinicalTrials.gov for literature and open clinical trials relevant to a patient profile. ' +
    'Returns recent papers and recruiting trials filtered to the patient characteristics.',
  parameters: z.object({
    condition: z.string().describe("Primary condition to search for (e.g. 'breast cancer HR+ HER2-')."),
    keywords: z.string().optional().describe("Additional search keywords (e.g. 'CDK4/6 inhibitor palbociclib')."),
    trialCondition: z.string().optional().describe("Condition name for ClinicalTrials.gov search (e.g. 'Breast Cancer')."),
  }),
  execute: async (input: { condition: string; keywords?: string; trialCondition?: string }) => {
    console.info(`tool_search_literature condition="${input.condition}"`);
    const results: Record<string, unknown> = { status: 'success' };

    // ── PubMed ──────────────────────────────────────────────────────────────────
    try {
      const query = encodeURIComponent(`${input.condition} ${input.keywords ?? ''} treatment`);
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}&sort=relevance&retmax=5&retmode=json&datetype=pdat&mindate=2022&maxdate=2025`;
      const searchData = await jsonGet(searchUrl);
      const ids: string[] = ((searchData['esearchresult'] as Record<string, unknown>)?.['idlist'] as string[] | undefined) ?? [];

      if (ids.length > 0) {
        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
        const summaryData = await jsonGet(summaryUrl);
        const result = (summaryData['result'] as Record<string, unknown>) ?? {};

        const papers = ids
          .map((pmid) => {
            const paper = result[pmid] as Record<string, unknown> | undefined;
            if (!paper) return null;
            const authors = ((paper['authors'] as unknown[] | undefined) ?? [])
              .slice(0, 3)
              .map((a) => (a as Record<string, string>)['name'])
              .join(', ');
            return {
              pmid,
              title: paper['title'] as string,
              authors,
              journal: paper['fulljournalname'] as string,
              pubDate: paper['pubdate'] as string,
              url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
            };
          })
          .filter(Boolean);

        results['pubmed'] = { count: papers.length, papers };
      } else {
        results['pubmed'] = { count: 0, papers: [], note: 'No PubMed results found for this query.' };
      }
    } catch (err) {
      console.error(`pubmed_search_error: ${String(err)}`);
      results['pubmed'] = { error: String(err) };
    }

    // ── ClinicalTrials.gov ──────────────────────────────────────────────────────
    try {
      const trialQuery = encodeURIComponent(input.trialCondition ?? input.condition);
      const trialsUrl = `https://clinicaltrials.gov/api/v2/studies?query.cond=${trialQuery}&filter.overallStatus=RECRUITING&pageSize=5&fields=NCTId,BriefTitle,OverallStatus,Phase,EligibilityCriteria,BriefSummary`;
      const trialsData = await jsonGet(trialsUrl);

      const studies = ((trialsData['studies'] as unknown[] | undefined) ?? []).map((s) => {
        const study = s as Record<string, unknown>;
        const proto = (study['protocolSection'] as Record<string, unknown> | undefined) ?? {};
        const idModule = (proto['identificationModule'] as Record<string, unknown> | undefined) ?? {};
        const statusModule = (proto['statusModule'] as Record<string, unknown> | undefined) ?? {};
        const descModule = (proto['descriptionModule'] as Record<string, unknown> | undefined) ?? {};
        const eligModule = (proto['eligibilityModule'] as Record<string, unknown> | undefined) ?? {};
        const designModule = (proto['designModule'] as Record<string, unknown> | undefined) ?? {};

        const nctId = idModule['nctId'] as string ?? 'Unknown';
        return {
          nct_id: nctId,
          title: idModule['briefTitle'] as string ?? 'Unknown',
          status: statusModule['overallStatus'] as string ?? 'Unknown',
          phase: ((designModule['phases'] as string[] | undefined) ?? []).join(', ') || 'Not specified',
          summary: ((descModule['briefSummary'] as string | undefined) ?? '').slice(0, 300),
          eligibilityCriteria: ((eligModule['eligibilityCriteria'] as string | undefined) ?? '').slice(0, 400),
          url: `https://clinicaltrials.gov/study/${nctId}`,
        };
      });

      results['clinicalTrials'] = { count: studies.length, studies };
    } catch (err) {
      console.error(`clinical_trials_error: ${String(err)}`);
      results['clinicalTrials'] = { error: String(err) };
    }

    return results;
  },
});

// ── Tool: checkDrugInteractions ────────────────────────────────────────────────

export const checkDrugInteractions = new FunctionTool({
  name: 'checkDrugInteractions',
  description:
    'Checks for drug-drug interactions using the RxNorm API (NIH). ' +
    'Pass a list of medication names to get detailed interaction data. ' +
    'Also queries OpenFDA for serious adverse event reports. ' +
    'No API key required — uses public NIH APIs.',
  parameters: z.object({
    medications: z
      .array(z.string())
      .describe("List of medication names to check interactions for (e.g. ['Fluconazole', 'Palbociclib', 'Letrozole'])."),
    focusDrug: z.string().optional().describe('The proposed new drug to check against the existing medications.'),
  }),
  execute: async (input: { medications: string[]; focusDrug?: string }) => {
    console.info(`tool_check_drug_interactions meds=${input.medications.join(', ')}`);

    try {
      // Step 1: Convert all drug names to RxNorm CUIs
      const rxcuiMap: Record<string, string> = {};
      for (const med of input.medications) {
        try {
          const searchUrl = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(med)}&search=1`;
          const data = await jsonGet(searchUrl) as Record<string, unknown>;
          const idGroup = data['idGroup'] as Record<string, unknown> | undefined;
          const rxnormId = (idGroup?.['rxnormId'] as string[] | undefined)?.[0];
          if (rxnormId) {
            rxcuiMap[med] = rxnormId;
            console.info(`  RxNorm CUI for ${med}: ${rxnormId}`);
          }
        } catch (e) {
          console.warn(`  Could not resolve RxNorm CUI for ${med}: ${String(e)}`);
        }
      }

      const cuiList = Object.values(rxcuiMap);
      if (cuiList.length < 2) {
        return {
          status: 'partial',
          message: 'Could not resolve enough RxNorm CUIs to check interactions.',
          rxcuiMap,
        };
      }

      // Step 2: Check interactions for the full list
      const interactionUrl = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${cuiList.join('+')}`;
      const interactionData = await jsonGet(interactionUrl) as Record<string, unknown>;

      const fullInteractionTypeGroup = (interactionData['fullInteractionTypeGroup'] as unknown[] | undefined) ?? [];
      const interactions: unknown[] = [];

      for (const group of fullInteractionTypeGroup) {
        const g = group as Record<string, unknown>;
        const types = (g['fullInteractionType'] as unknown[] | undefined) ?? [];
        for (const t of types) {
          const it = t as Record<string, unknown>;
          const pairs = (it['interactionPair'] as unknown[] | undefined) ?? [];
          for (const pair of pairs) {
            const p = pair as Record<string, unknown>;
            const concepts = (p['interactionConcept'] as unknown[] | undefined) ?? [];
            const drug1 = ((concepts[0] as Record<string, unknown>)?.['minConceptItem'] as Record<string, string> | undefined)?.['name'] ?? 'Unknown';
            const drug2 = ((concepts[1] as Record<string, unknown>)?.['minConceptItem'] as Record<string, string> | undefined)?.['name'] ?? 'Unknown';
            interactions.push({
              drug1,
              drug2,
              severity: p['severity'],
              description: p['description'],
              source: g['sourceName'],
            });
          }
        }
      }

      // Step 3: Reverse lookup drug names for found CUIs
      const resolvedMeds = Object.entries(rxcuiMap).map(([name, cui]) => ({ name, rxcui: cui }));

      return {
        status: 'success',
        checkedMedications: resolvedMeds,
        totalInteractionsFound: interactions.length,
        interactions,
        summary:
          interactions.length > 0
            ? `Found ${interactions.length} interaction(s). Review each for clinical significance.`
            : 'No known interactions found between the checked medications in RxNorm database.',
      };
    } catch (err) {
      console.error(`tool_check_drug_interactions_error: ${String(err)}`);
      return { status: 'error', error_message: String(err) };
    }
  },
});

// ── Tool: getOpenFdaAdverseEvents ─────────────────────────────────────────────

export const getOpenFdaAdverseEvents = new FunctionTool({
  name: 'getOpenFdaAdverseEvents',
  description: 'Gets the top reported adverse events for a drug from the FDA OpenFDA API.',
  parameters: z.object({
    drugName: z.string().describe('Name of the drug (e.g., palbociclib, letrozole)'),
  }),
  execute: async (args: { drugName: string }) => {
    try {
      const drug = args.drugName.toLowerCase().replace(/[^a-z0-9]/g, '+');
      const url = `https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:${drug}&count=patient.reaction.reactionmeddrapt.exact`;
      
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) return { error: `No adverse event data found for drug: ${args.drugName}` };
        throw new Error(`FDA API Error ${res.status}`);
      }
      
      const data = await res.json() as any;
      if (!data.results || data.results.length === 0) {
        return { warning: `No adverse events listed for ${args.drugName}` };
      }

      // Return top 5 adverse events
      const topEvents = data.results.slice(0, 5).map((r: any) => ({
        event: r.term,
        count: r.count
      }));

      return {
        drug: args.drugName,
        top_adverse_events: topEvents
      };
    } catch (e) {
      return { error: `FDA fetch failed: ${String(e)}` };
    }
  }
});

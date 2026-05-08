/**
 * ContextMD A2A Quality Test
 * Tests the full pipeline and grades each agent output against the ClinicalBriefing schema.
 *
 * Run: npx tsx test_quality.ts
 */

const ORCHESTRATOR = 'http://localhost:8003';
const API_KEY = 'contextmd-key-001';

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
}

function check(name: string, condition: boolean, detail: string): TestResult {
  return { name, pass: condition, detail };
}

async function runPipeline(): Promise<any> {
  console.log('\n[test] Firing orchestrator...');
  const start = Date.now();

  const body = {
    jsonrpc: '2.0', id: 'quality-test-1', method: 'message/send',
    params: {
      message: {
        messageId: 'test-' + Date.now(), role: 'user',
        parts: [{ kind: 'text', text: 'Review biopsy result 132016730 for patient 132016691. Full clinical briefing.' }],
      },
    },
  };

  const resp = await fetch(`${ORCHESTRATOR}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  });

  const data = await resp.json() as any;
  const elapsed = Date.now() - start;
  console.log(`[test] Pipeline completed in ${(elapsed / 1000).toFixed(1)}s`);
  return { data, elapsed };
}

function extractJson(text: string): any {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1].trim());
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

function gradeOutput(briefing: any, elapsed: number): TestResult[] {
  const results: TestResult[] = [];

  // ── Schema checks ──────────────────────────────────────────────────────────
  results.push(check(
    'Schema: result_summary present',
    typeof briefing?.result_summary === 'string' && briefing.result_summary.length > 20,
    briefing?.result_summary?.slice(0, 80) ?? 'MISSING',
  ));

  results.push(check(
    'Schema: patient_context present',
    typeof briefing?.patient_context === 'string' && briefing.patient_context.length > 20,
    briefing?.patient_context?.slice(0, 80) ?? 'MISSING',
  ));

  results.push(check(
    'Schema: trend_analysis present',
    typeof briefing?.trend_analysis === 'string' && briefing.trend_analysis.length > 20,
    briefing?.trend_analysis?.slice(0, 80) ?? 'MISSING',
  ));

  const riskLevel = briefing?.risk_assessment?.level;
  results.push(check(
    'Schema: risk_assessment valid level',
    ['Critical', 'High', 'Moderate', 'Low'].includes(riskLevel),
    `level=${riskLevel ?? 'MISSING'}`,
  ));

  results.push(check(
    'Schema: differential array present',
    Array.isArray(briefing?.differential) && briefing.differential.length > 0,
    `${briefing?.differential?.length ?? 0} differential items`,
  ));

  results.push(check(
    'Schema: next_steps array present',
    Array.isArray(briefing?.next_steps) && briefing.next_steps.length > 0,
    `${briefing?.next_steps?.length ?? 0} next steps`,
  ));

  results.push(check(
    'Schema: do_not_do array present',
    Array.isArray(briefing?.do_not_do) && briefing.do_not_do.length > 0,
    `${briefing?.do_not_do?.length ?? 0} do_not_do items`,
  ));

  results.push(check(
    'Schema: literature array present',
    Array.isArray(briefing?.literature),
    `${briefing?.literature?.length ?? 'MISSING'} literature items`,
  ));

  results.push(check(
    'Schema: clinical_trials array present',
    Array.isArray(briefing?.clinical_trials),
    `${briefing?.clinical_trials?.length ?? 'MISSING'} trial items`,
  ));

  // ── Demo Moment 1: The Catch ───────────────────────────────────────────────
  const doNotDo = (briefing?.do_not_do ?? []) as any[];
  const catchesPalbociclib = doNotDo.some((d: any) =>
    (d.action + ' ' + d.reason).toLowerCase().includes('palbociclib') &&
    (d.action + ' ' + d.reason).toLowerCase().includes('fluconazole'),
  );
  results.push(check(
    'DEMO MOMENT 1: Catches Palbociclib + Fluconazole interaction',
    catchesPalbociclib,
    catchesPalbociclib
      ? 'PASS — do_not_do flags Palbociclib+Fluconazole CYP3A4 interaction'
      : 'FAIL — did not flag the critical drug interaction',
  ));

  // ── Demo Moment 2: The Pattern ─────────────────────────────────────────────
  const trendText = (briefing?.trend_analysis ?? '').toLowerCase();
  const showsGfrDecline = trendText.includes('gfr') || trendText.includes('egfr') || trendText.includes('renal') || trendText.includes('kidney');
  const showsRate = trendText.includes('/year') || trendText.includes('per year') || trendText.includes('ml/min') || trendText.includes('rate');
  results.push(check(
    'DEMO MOMENT 2: GFR declining trend with rate analysis',
    showsGfrDecline && showsRate,
    showsGfrDecline && showsRate
      ? 'PASS — trend analysis includes GFR decline with rate/projection'
      : `FAIL — missing GFR(${showsGfrDecline}) or rate(${showsRate})`,
  ));

  // ── Demo Moment 3: The Trial ───────────────────────────────────────────────
  const trials = (briefing?.clinical_trials ?? []) as any[];
  const hasRealTrial = trials.some((t: any) =>
    typeof t.nct_id === 'string' && t.nct_id.startsWith('NCT') && t.status === 'RECRUITING',
  );
  results.push(check(
    'DEMO MOMENT 3: Real recruiting ClinicalTrials.gov trial',
    hasRealTrial,
    hasRealTrial
      ? `PASS — trial ${trials.find((t: any) => t.nct_id?.startsWith('NCT'))?.nct_id}`
      : 'FAIL — no recruiting trial with real NCT ID found',
  ));

  // ── Quality checks ─────────────────────────────────────────────────────────
  const nextSteps = (briefing?.next_steps ?? []) as any[];
  const contraindictedInNextSteps = nextSteps.some((s: any) =>
    (s.action ?? '').toLowerCase().includes('palbociclib') && s.status === 'Contraindicated',
  );
  results.push(check(
    'Quality: Contraindicated steps removed from next_steps OR marked correctly',
    !nextSteps.some((s: any) => (s.action ?? '').toLowerCase().includes('palbociclib') && s.status === 'Safe'),
    contraindictedInNextSteps ? 'Palbociclib marked Contraindicated in next_steps' : 'Palbociclib correctly absent or flagged',
  ));

  results.push(check(
    'Quality: Response time under 3 minutes',
    elapsed < 180_000,
    `${(elapsed / 1000).toFixed(1)}s`,
  ));

  const literatureCount = briefing?.literature?.length ?? 0;
  const trialsCount = trials.length;
  results.push(check(
    'Quality: Literature or trials returned (not both empty)',
    literatureCount > 0 || trialsCount > 0,
    `literature=${literatureCount}, trials=${trialsCount}`,
  ));

  return results;
}

async function main() {
  console.log('===========================================');
  console.log('  ContextMD A2A Quality Test');
  console.log('===========================================');

  // Check orchestrator is up
  try {
    const card = await fetch(`${ORCHESTRATOR}/.well-known/agent-card.json`);
    if (!card.ok) throw new Error(`HTTP ${card.status}`);
    console.log('[test] Orchestrator is up');
  } catch (e) {
    console.error('[test] ABORT: Orchestrator not running. Run "npm run dev" first.');
    process.exit(1);
  }

  let rawOutput = '';
  let briefing: any = null;
  let elapsed = 0;

  try {
    const { data, elapsed: t } = await runPipeline();
    elapsed = t;
    rawOutput = data?.result?.parts?.[0]?.text ?? '';
    briefing = extractJson(rawOutput);
  } catch (e) {
    console.error('[test] Pipeline call failed:', String(e));
    process.exit(1);
  }

  if (!briefing) {
    console.error('\n[test] ABORT: Could not parse JSON from pipeline output.');
    console.error('Raw output:', rawOutput.slice(0, 300));
    process.exit(1);
  }

  const results = gradeOutput(briefing, elapsed);

  console.log('\n--- Results ---\n');
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const icon = r.pass ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${r.name}`);
    console.log(`       ${r.detail}`);
    if (r.pass) passed++; else failed++;
  }

  console.log('\n--- Score ---');
  console.log(`${passed}/${results.length} checks passed`);
  console.log(`Response time: ${(elapsed / 1000).toFixed(1)}s`);

  if (failed === 0) {
    console.log('\nALL CHECKS PASSED — A2A pipeline is production-ready for the demo!');
  } else if (failed <= 2) {
    console.log('\nMinor issues — core pipeline works, fix the failing checks above.');
  } else {
    console.log('\nSignificant failures — review agent outputs before demo.');
  }

  console.log('\n--- Raw Briefing Preview ---');
  console.log(JSON.stringify(briefing, null, 2).slice(0, 1500));
}

main().catch(console.error);

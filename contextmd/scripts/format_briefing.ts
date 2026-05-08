/**
 * Beautiful Export
 * Converts the raw JSON ClinicalBriefing into a beautiful, presentation-ready Markdown report.
 * Run: npx tsx scripts/format_briefing.ts
 */

import fs from 'fs';
import path from 'path';

const ORCHESTRATOR = 'http://localhost:8003';
const API_KEY = 'contextmd-key-001';

async function generateExport() {
  console.log('Generating beautiful ContextMD export...');
  const start = Date.now();

  // Fire the orchestrator to get the latest briefing
  const body = {
    jsonrpc: '2.0', id: 'export-gen', method: 'message/send',
    params: {
      message: {
        messageId: 'export-' + Date.now(), role: 'user',
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
  const rawOutput = data?.result?.parts?.[0]?.text ?? '';
  
  let briefing: any = null;
  try {
    const match = rawOutput.match(/```json\s*([\s\S]*?)```/) ?? rawOutput.match(/(\{[\s\S]*\})/);
    if (match) briefing = JSON.parse(match[1].trim());
    else briefing = JSON.parse(rawOutput.trim());
  } catch (e) {
    console.error('Failed to parse JSON. Raw output:', rawOutput.slice(0, 500));
    return;
  }

  // Build the Markdown Report
  let md = `# ContextMD Clinical Briefing\n\n`;
  md += `> **Generated in:** ${((Date.now() - start) / 1000).toFixed(1)}s\n\n`;

  // Risk Level
  const level = briefing.risk_assessment?.level || 'Unknown';
  let levelColor = 'green';
  if (level === 'Critical') levelColor = 'red';
  else if (level === 'High') levelColor = 'orange';
  else if (level === 'Medium' || level === 'Moderate') levelColor = 'yellow';
  
  md += `## 🚨 Risk Assessment: <span style="color:${levelColor}">${level}</span>\n`;
  md += `*${briefing.risk_assessment?.reasoning || 'No reasoning provided.'}*\n\n`;

  md += `---\n\n`;

  // Summaries
  md += `## 📝 Result Summary\n${briefing.result_summary}\n\n`;
  md += `## 👤 Patient Context\n${briefing.patient_context}\n\n`;
  md += `## 📈 Trend Analysis\n${briefing.trend_analysis}\n\n`;

  md += `---\n\n`;

  // Do Not Do (Critical Catch)
  if (briefing.do_not_do && briefing.do_not_do.length > 0) {
    md += `## 🛑 CRITICAL ALERTS (DO NOT DO)\n\n`;
    for (const alert of briefing.do_not_do) {
      md += `> **[!CAUTION]**\n> **${alert.action}**\n> *Reason:* ${alert.reason}\n\n`;
    }
    md += `---\n\n`;
  }

  // Next Steps
  if (briefing.next_steps && briefing.next_steps.length > 0) {
    md += `## ✅ Recommended Next Steps\n\n`;
    for (const step of briefing.next_steps) {
      const statusIcon = step.status === 'Contraindicated' ? '❌' : (step.status === 'Warning' ? '⚠️' : '✅');
      md += `- **${statusIcon} ${step.action}**\n  - *${step.reasoning}*\n`;
    }
    md += `\n---\n\n`;
  }

  // Trials
  if (briefing.clinical_trials && briefing.clinical_trials.length > 0) {
    md += `## 🔬 Clinical Trials\n\n`;
    for (const trial of briefing.clinical_trials) {
      md += `- **[${trial.nct_id}](https://clinicaltrials.gov/study/${trial.nct_id}) - ${trial.title}**\n`;
      md += `  - Status: ${trial.status}\n`;
      md += `  - Rationale: ${trial.rationale}\n`;
    }
  }

  // Save the file
  const outPath = path.join(process.cwd(), 'briefing_report.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`\n✅ Beautiful Export saved to: ${outPath}`);
}

generateExport().catch(console.error);

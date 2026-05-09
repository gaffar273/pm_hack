/**
 * ContextMD Test Script
 * Demonstrates: dynamic patient IDs, multi-turn session continuity
 *
 * Run: node test.js
 */

const BASE_URL = 'http://localhost:8003';
const API_KEY  = 'contextmd-key-001';

async function send(text, contextId = null, metadata = {}) {
  const body = {
    jsonrpc: '2.0',
    id: `req-${Date.now()}`,
    method: 'message/send',
    params: {
      message: {
        messageId: `msg-${Date.now()}`,
        role: 'user',
        parts: [{ kind: 'text', text }],
        // Pass contextId to resume a session (multi-turn)
        ...(contextId ? { contextId } : {}),
        // Pass SHARP metadata to identify patient dynamically
        ...(Object.keys(metadata).length ? { metadata } : {}),
      },
    },
  };

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📤 SENDING: "${text.slice(0, 80)}"`);
  if (contextId) console.log(`   🔗 Session: ${contextId} (RESUMED)`);
  if (metadata.patient_id) console.log(`   👤 Patient: ${metadata.patient_id}`);
  console.log(`${'─'.repeat(60)}`);

  const start = Date.now();
  const resp = await fetch(`${BASE_URL}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (data.error) {
    console.error(`❌ Error (${elapsed}s): ${data.error.message}`);
    return { text: null, contextId: null };
  }

  const returnedContextId = data.result?.contextId;
  const text2 = data.result?.parts?.[0]?.text ?? '';
  console.log(`✅ Response (${elapsed}s, ${text2.length} chars)`);
  console.log(`   contextId: ${returnedContextId}`);
  console.log(`   Preview: ${text2.slice(0, 300)}...`);

  return { text: text2, contextId: returnedContextId };
}

async function runTests() {
  console.log('🏥 ContextMD Test Suite\n');

  // ── Test 1: Default demo patient (env fallback) ──────────────────────────
  console.log('\n[TEST 1] Full MDT pipeline — demo patient (env fallback)');
  const t1 = await send('Review the latest diagnostic results and provide a full MDT briefing.');
  const sessionId = t1.contextId; // Save for follow-up

  if (!sessionId) {
    console.error('Test 1 failed — no contextId returned. Stopping.');
    return;
  }

  // ── Test 2: Follow-up in same session (no FHIR re-fetch) ────────────────
  console.log('\n[TEST 2] What-If follow-up — SAME session (should use cached context)');
  await send('What if we add Palbociclib to the current regimen?', sessionId);

  // ── Test 3: Another follow-up ────────────────────────────────────────────
  console.log('\n[TEST 3] Another follow-up in same session');
  await send('How about switching to Ribociclib instead?', sessionId);

  // ── Test 4: Dynamic patient via metadata ─────────────────────────────────
  console.log('\n[TEST 4] Different patient via metadata (dynamic)');
  await send('What does this result mean for this patient?', null, {
    patient_id: '132016691',
    result_id: '132016730',
    fhir_base_url: 'https://hapi.fhir.org/baseR4',
  });

  // ── Test 5: Dynamic patient ID parsed from text ──────────────────────────
  console.log('\n[TEST 5] Patient ID extracted from natural language prompt');
  await send('Review the diagnostic results for patient 132016691 and result 132016730');
}

runTests().catch(console.error);

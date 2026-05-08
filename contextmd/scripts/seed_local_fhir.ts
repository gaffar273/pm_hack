/**
 * Seed Eleanor Thompson's complete patient data into the local HAPI FHIR server.
 * Run: npx tsx scripts/seed_local_fhir.ts
 */

const FHIR_BASE = 'http://localhost:8080/fhir';

async function post(resourceType: string, body: object): Promise<string> {
  const resp = await fetch(`${FHIR_BASE}/${resourceType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/fhir+json', Accept: 'application/fhir+json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`POST ${resourceType} failed ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json() as { id: string };
  console.log(`  Created ${resourceType}/${data.id}`);
  return data.id;
}

async function main() {
  console.log('Seeding Eleanor Thompson into local HAPI FHIR...\n');

  // ── Patient ─────────────────────────────────────────────────────────────────
  const patientId = await post('Patient', {
    resourceType: 'Patient',
    name: [{ use: 'official', family: 'Thompson', given: ['Eleanor', 'Marie'] }],
    gender: 'female',
    birthDate: '1967-03-15',
    active: true,
    telecom: [{ system: 'phone', value: '555-0101', use: 'home' }],
    address: [{ line: ['14 Birchwood Lane'], city: 'Springfield', state: 'IL', postalCode: '62701', country: 'US' }],
  });
  console.log(`Patient ID: ${patientId}\n`);

  // ── Conditions ──────────────────────────────────────────────────────────────
  await post('Condition', {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'C50.912', display: 'Malignant neoplasm of unspecified site of left female breast' }], text: 'HR+/HER2- Invasive Ductal Carcinoma, Left Breast, Stage IIIA' },
    subject: { reference: `Patient/${patientId}` },
    onsetDateTime: '2021-06-15',
  });

  await post('Condition', {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'N18.3', display: 'Chronic kidney disease, stage 3 (moderate)' }], text: 'Chronic Kidney Disease Stage 3b' },
    subject: { reference: `Patient/${patientId}` },
    onsetDateTime: '2022-03-10',
  });

  await post('Condition', {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'E11.9', display: 'Type 2 diabetes mellitus without complications' }] },
    subject: { reference: `Patient/${patientId}` },
    onsetDateTime: '2015-04-20',
  });

  await post('Condition', {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'I10', display: 'Essential (primary) hypertension' }] },
    subject: { reference: `Patient/${patientId}` },
    onsetDateTime: '2013-08-05',
  });

  // ── Allergies ────────────────────────────────────────────────────────────────
  await post('AllergyIntolerance', {
    resourceType: 'AllergyIntolerance',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
    type: 'allergy',
    category: ['medication'],
    criticality: 'high',
    code: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '7980', display: 'Penicillin' }], text: 'Penicillin' },
    patient: { reference: `Patient/${patientId}` },
    reaction: [{ manifestation: [{ coding: [{ display: 'Anaphylaxis' }] }], severity: 'severe' }],
  });

  // ── Medications ──────────────────────────────────────────────────────────────
  const meds = [
    { name: 'Letrozole 2.5mg', rxnorm: '72965', dosage: 'Letrozole 2.5mg orally once daily' },
    { name: 'Fluconazole 200mg', rxnorm: '4450', dosage: 'Fluconazole 200mg orally once daily (CYP3A4 inhibitor)' },
    { name: 'Metformin 1000mg', rxnorm: '235743', dosage: 'Metformin 1000mg orally twice daily' },
    { name: 'Lisinopril 10mg', rxnorm: '29046', dosage: 'Lisinopril 10mg orally once daily' },
    { name: 'Atorvastatin 40mg', rxnorm: '83367', dosage: 'Atorvastatin 40mg orally once daily at bedtime' },
    { name: 'Dexamethasone 4mg', rxnorm: '22690', dosage: 'Dexamethasone 4mg orally as needed' },
    { name: 'Ondansetron 8mg', rxnorm: '203148', dosage: 'Ondansetron 8mg orally as needed for nausea' },
    { name: 'Omeprazole 20mg', rxnorm: '283742', dosage: 'Omeprazole 20mg orally once daily' },
    { name: 'Aspirin 81mg', rxnorm: '1191', dosage: 'Aspirin 81mg orally once daily' },
    { name: 'Lorazepam 0.5mg', rxnorm: '6470', dosage: 'Lorazepam 0.5mg orally as needed for anxiety' },
  ];
  for (const med of meds) {
    await post('MedicationRequest', {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: med.rxnorm, display: med.name }], text: med.name },
      subject: { reference: `Patient/${patientId}` },
      dosageInstruction: [{ text: med.dosage }],
      authoredOn: '2025-01-01',
    });
  }

  // ── GFR Trend (12 data points over 40 months) ─────────────────────────────
  console.log('\nSeeding GFR trend observations...');
  const gfrData = [
    { date: '2022-01-10', value: 55 }, { date: '2022-06-15', value: 52 },
    { date: '2022-12-20', value: 49 }, { date: '2023-03-08', value: 46 },
    { date: '2023-07-14', value: 44 }, { date: '2023-11-20', value: 42 },
    { date: '2024-02-10', value: 40 }, { date: '2024-05-18', value: 38 },
    { date: '2024-08-22', value: 36 }, { date: '2024-11-30', value: 34 },
    { date: '2025-02-14', value: 33 }, { date: '2025-05-01', value: 31 },
  ];
  for (const gfr of gfrData) {
    await post('Observation', {
      resourceType: 'Observation',
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
      code: { coding: [{ system: 'http://loinc.org', code: '33914-3', display: 'Glomerular filtration rate/1.73 sq M.predicted [Volume Rate/Area] in Serum, Plasma or Blood by Creatinine-based formula (MDRD)' }], text: 'eGFR (MDRD)' },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: gfr.date,
      valueQuantity: { value: gfr.value, unit: 'mL/min/1.73m2', system: 'http://unitsofmeasure.org', code: 'mL/min/{1.73_m2}' },
    });
  }

  // ── Diagnostic Report (biopsy — the trigger result) ──────────────────────
  console.log('\nSeeding biopsy DiagnosticReport...');
  const reportId = await post('DiagnosticReport', {
    resourceType: 'DiagnosticReport',
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'PAT', display: 'Pathology' }] }],
    code: { coding: [{ system: 'http://loinc.org', code: '22637-3', display: 'Pathology report' }], text: 'Left Breast Core Needle Biopsy — Pathology Report' },
    subject: { reference: `Patient/${patientId}` },
    issued: '2025-05-07T08:00:00Z',
    effectiveDateTime: '2025-05-06',
    conclusion: 'Invasive ductal carcinoma, Grade 3 (Nottingham score 8/9). Estrogen receptor positive (95%), progesterone receptor positive (80%), HER2 negative (IHC 1+, FISH not amplified). Ki-67 proliferation index 42%. Lymphovascular invasion present. Tumour size 2.8cm. Margins involved. Findings represent aggressive disease progression despite current aromatase inhibitor therapy, indicating endocrine resistance.',
  });

  console.log('\n===========================================');
  console.log('Seeding complete!');
  console.log(`Patient ID: ${patientId}`);
  console.log(`Report ID:  ${reportId}`);
  console.log('\nUpdate your .env:');
  console.log(`DEMO_PATIENT_ID=${patientId}`);
  console.log(`DEMO_RESULT_ID=${reportId}`);
  console.log('===========================================');
}

main().catch(console.error);

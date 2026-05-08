// Script to populate Eleanor Thompson's FHIR data on HAPI sandbox
// Run with: npx tsx scripts/seed_fhir.ts

import '../shared/env.js';

const PATIENT_ID = '132016691';
const BASE = 'https://hapi.fhir.org/baseR4';

const headers = {
  'Content-Type': 'application/fhir+json',
  Accept: 'application/fhir+json',
};

async function post(resourceType: string, body: object): Promise<{ id: string; resourceType: string }> {
  const r = await fetch(`${BASE}/${resourceType}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`POST ${resourceType} failed ${r.status}: ${err.slice(0, 300)}`);
  }
  const data = await r.json() as { id: string; resourceType: string };
  console.info(`✅ Created ${resourceType}/${data.id}`);
  return data;
}

async function main() {
  console.log(`\n🏥 Seeding FHIR data for Patient/${PATIENT_ID} (Eleanor Thompson)\n`);

  // ── CONDITIONS ────────────────────────────────────────────────────────────────
  const breastCancer = await post('Condition', {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }] }],
    severity: { coding: [{ system: 'http://snomed.info/sct', code: '24484000', display: 'Severe' }] },
    code: {
      coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'C50.912', display: 'Malignant neoplasm of unspecified site of left female breast' }],
      text: 'Breast Cancer (Left) — Stage IIIA, HR+/HER2-',
    },
    subject: { reference: `Patient/${PATIENT_ID}` },
    onsetDateTime: '2021-06-15',
    recordedDate: '2021-06-20',
  });

  await post('Condition', {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }] }],
    code: {
      coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'N18.3', display: 'Chronic kidney disease, stage 3' }],
      text: 'Chronic Kidney Disease Stage 3 (GFR 38 mL/min/1.73m²)',
    },
    subject: { reference: `Patient/${PATIENT_ID}` },
    onsetDateTime: '2019-11-05',
    recordedDate: '2020-02-01',
  });

  await post('Condition', {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
    code: {
      coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'E11.9', display: 'Type 2 diabetes mellitus without complications' }],
      text: 'Type 2 Diabetes Mellitus',
    },
    subject: { reference: `Patient/${PATIENT_ID}` },
    onsetDateTime: '2015-03-10',
  });

  await post('Condition', {
    resourceType: 'Condition',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
    code: {
      coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: 'I10', display: 'Essential (primary) hypertension' }],
      text: 'Hypertension',
    },
    subject: { reference: `Patient/${PATIENT_ID}` },
    onsetDateTime: '2012-08-20',
  });

  // ── ALLERGIES ─────────────────────────────────────────────────────────────────
  await post('AllergyIntolerance', {
    resourceType: 'AllergyIntolerance',
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'confirmed' }] },
    type: 'allergy',
    category: ['medication'],
    criticality: 'high',
    code: {
      coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '7980', display: 'Penicillin' }],
      text: 'Penicillin — anaphylaxis',
    },
    patient: { reference: `Patient/${PATIENT_ID}` },
    recordedDate: '2010-05-01',
    reaction: [{ description: 'Anaphylactic shock', severity: 'severe' }],
  });

  // ── MEDICATIONS ───────────────────────────────────────────────────────────────
  const meds = [
    { name: 'Letrozole 2.5mg', code: '203563', dosage: '2.5 mg orally once daily', reason: 'Aromatase inhibitor for HR+ breast cancer' },
    { name: 'Fluconazole 200mg', code: '4450', dosage: '200 mg orally once daily', reason: 'Antifungal — CYP3A4 strong inhibitor' },
    { name: 'Metformin 1000mg', code: '6809', dosage: '1000 mg orally twice daily with meals', reason: 'Type 2 diabetes' },
    { name: 'Lisinopril 10mg', code: '29046', dosage: '10 mg orally once daily', reason: 'Hypertension and renal protection' },
    { name: 'Atorvastatin 40mg', code: '83367', dosage: '40 mg orally once at bedtime', reason: 'Hyperlipidemia' },
    { name: 'Dexamethasone 4mg', code: '3264', dosage: '4 mg orally three times daily', reason: 'Chemotherapy anti-emetic and anti-inflammatory' },
    { name: 'Ondansetron 8mg', code: '26225', dosage: '8 mg orally every 8 hours as needed', reason: 'Chemotherapy-induced nausea' },
    { name: 'Omeprazole 20mg', code: '7646', dosage: '20 mg orally once daily before breakfast', reason: 'Gastroprotection on steroids' },
    { name: 'Calcium carbonate 500mg', code: '2002', dosage: '500 mg orally three times daily with meals', reason: 'Bone health on aromatase inhibitor' },
    { name: 'Cholecalciferol (Vitamin D3) 2000IU', code: '41307', dosage: '2000 IU orally once daily', reason: 'Vitamin D supplementation, bone health' },
    { name: 'Aspirin 81mg', code: '1191', dosage: '81 mg orally once daily', reason: 'Cardiovascular prophylaxis' },
    { name: 'Lorazepam 0.5mg', code: '6470', dosage: '0.5 mg orally at bedtime as needed', reason: 'Anxiety and insomnia related to cancer diagnosis' },
  ];

  for (const med of meds) {
    await post('MedicationRequest', {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: med.code, display: med.name }],
        text: med.name,
      },
      subject: { reference: `Patient/${PATIENT_ID}` },
      authoredOn: '2024-01-15',
      dosageInstruction: [{ text: med.dosage }],
      reasonCode: [{ text: med.reason }],
    });
  }

  // ── GFR OBSERVATIONS (declining trend over 3 years) ───────────────────────────
  const gfrValues = [
    { date: '2022-01-10', value: 55 },
    { date: '2022-06-15', value: 52 },
    { date: '2022-12-20', value: 49 },
    { date: '2023-03-08', value: 46 },
    { date: '2023-07-14', value: 44 },
    { date: '2023-11-20', value: 42 },
    { date: '2024-02-10', value: 40 },
    { date: '2024-05-18', value: 38 },
    { date: '2024-08-22', value: 36 },
    { date: '2024-11-30', value: 34 },
    { date: '2025-02-14', value: 33 },
    { date: '2025-05-01', value: 31 },
  ];

  for (const gfr of gfrValues) {
    await post('Observation', {
      resourceType: 'Observation',
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory' }] }],
      code: {
        coding: [
          { system: 'http://loinc.org', code: '33914-3', display: 'Glomerular filtration rate/1.73 sq M.predicted [Volume Rate/Area] in Serum or Plasma by Creatinine-based formula (MDRD)' },
        ],
        text: 'GFR (estimated by MDRD)',
      },
      subject: { reference: `Patient/${PATIENT_ID}` },
      effectiveDateTime: gfr.date,
      valueQuantity: { value: gfr.value, unit: 'mL/min/1.73m2', system: 'http://unitsofmeasure.org', code: 'mL/min/{1.73_m2}' },
      interpretation: [{
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: gfr.value < 45 ? 'L' : 'N' }],
        text: gfr.value < 45 ? 'Low' : 'Normal',
      }],
    });
  }

  // ── BIOPSY DIAGNOSTIC REPORT (the trigger result) ─────────────────────────────
  const biopsyReport = await post('DiagnosticReport', {
    resourceType: 'DiagnosticReport',
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'PAT', display: 'Pathology' }] }],
    code: {
      coding: [{ system: 'http://loinc.org', code: '66110-8', display: 'Breast Pathology biopsy report' }],
      text: 'Left Breast Core Needle Biopsy — Pathology Report',
    },
    subject: { reference: `Patient/${PATIENT_ID}` },
    effectiveDateTime: '2025-05-05',
    issued: '2025-05-07T08:00:00Z',
    conclusion: 'Invasive ductal carcinoma, Grade 3. Estrogen receptor positive (95%), progesterone receptor positive (80%), HER2 negative (IHC 1+). Ki-67 proliferation index 42%. Lymphovascular invasion present. Tumour size 2.8cm. Margins involved. Findings represent disease progression despite current aromatase inhibitor therapy.',
    conclusionCode: [{
      coding: [{ system: 'http://snomed.info/sct', code: '413448000', display: 'Malignant neoplasm of breast (disorder)' }],
      text: 'Breast Cancer Progression — Grade 3 IDC, HR+/HER2-',
    }],
  });

  console.log(`\n🎯 DEMO_RESULT_ID=${biopsyReport.id}`);
  console.log('\n✅ All FHIR data seeded successfully!');
  console.log('\nUpdate your .env:');
  console.log(`  DEMO_PATIENT_ID=132016691`);
  console.log(`  DEMO_RESULT_ID=${biopsyReport.id}`);
}

main().catch(console.error);

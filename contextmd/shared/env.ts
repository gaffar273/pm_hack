/**
 * Environment setup — imported by every agent.ts and appFactory.ts.
 *
 * Must be the very first import in any entry point so that environment
 * variables are ready before any ADK or Google GenAI SDK code runs.
 *
 * Two things happen here:
 *   1. dotenv loads the .env file into process.env.
 *   2. GOOGLE_API_KEY (Python ADK convention) is forwarded to
 *      GOOGLE_GENAI_API_KEY (TypeScript ADK / @google/genai convention)
 *      so both SDKs can share the same .env file without changes.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import os from 'os';

if (!process.env['GOOGLE_GENAI_API_KEY'] && !process.env['GEMINI_API_KEY']) {
    const fallback = process.env['GOOGLE_API_KEY'];
    if (fallback) {
        process.env['GOOGLE_GENAI_API_KEY'] = fallback;
    }
}

// Decode base64 service account if present
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
    try {
        const decoded = Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('utf8');
        const tmpPath = path.join(os.tmpdir(), 'contextmd_service_account.json');
        fs.writeFileSync(tmpPath, decoded, 'utf8');
        process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
        console.info(`[env] Decoded base64 service account to ${tmpPath}`);
    } catch (e) {
        console.error('[env] Failed to decode GOOGLE_APPLICATION_CREDENTIALS_BASE64', e);
    }
}

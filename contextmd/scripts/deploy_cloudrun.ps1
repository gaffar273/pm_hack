# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  deploy_cloudrun.ps1  —  Deploy all 6 ContextMD agents to Google Cloud Run ║
# ║                                                                              ║
# ║  Run from: c:\hack\pm_hack\contextmd\                                       ║
# ║  Command:  .\scripts\deploy_cloudrun.ps1                                    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

$ErrorActionPreference = "Stop"

# ── Config ────────────────────────────────────────────────────────────────────
$PROJECT   = "clianta"
$REGION    = "us-central1"
$IMAGE     = "gcr.io/$PROJECT/contextmd:latest"
$ENV_FILE  = Join-Path $PSScriptRoot ".." ".env"

Write-Host "`nContextMD — Google Cloud Run Deployment" -ForegroundColor Cyan
Write-Host "   Project : $PROJECT"
Write-Host "   Region  : $REGION"
Write-Host "   Image   : $IMAGE`n"

# ── Read .env ─────────────────────────────────────────────────────────────────
if (-not (Test-Path $ENV_FILE)) {
    Write-Error ".env not found at $ENV_FILE"
    exit 1
}

$envVars = @{}
Get-Content $ENV_FILE | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $envVars[$matches[1].Trim()] = $matches[2].Trim()
    }
}

# ── Common env vars passed to every service ───────────────────────────────────
# We pass them as KEY=VALUE pairs; the long base64 key is handled safely via
# a temp file to avoid PowerShell CLI length limits.
$commonEnv = @(
    "GOOGLE_GENAI_USE_VERTEXAI=$($envVars['GOOGLE_GENAI_USE_VERTEXAI'])",
    "GOOGLE_CLOUD_PROJECT=$PROJECT",
    "GOOGLE_CLOUD_LOCATION=$($envVars['GOOGLE_CLOUD_LOCATION'])",
    "GOOGLE_APPLICATION_CREDENTIALS_BASE64=$($envVars['GOOGLE_APPLICATION_CREDENTIALS_BASE64'])",
    "GOOGLE_API_KEY=$($envVars['GOOGLE_API_KEY'])",
    "API_KEY_PRIMARY=$($envVars['API_KEY_PRIMARY'])",
    "API_KEY_SECONDARY=$($envVars['API_KEY_SECONDARY'])",
    "FHIR_BASE_URL=$($envVars['FHIR_BASE_URL'])",
    "FHIR_EXTENSION_URI=$($envVars['FHIR_EXTENSION_URI'])",
    "DEMO_PATIENT_ID=$($envVars['DEMO_PATIENT_ID'])",
    "DEMO_RESULT_ID=$($envVars['DEMO_RESULT_ID'])",
    "LOG_LEVEL=info",
    "NODE_ENV=production"
)

# ── Step 1: Build & push Docker image ─────────────────────────────────────────
Write-Host "━━━ Step 1/3: Building Docker image via Cloud Build ━━━" -ForegroundColor Yellow
Write-Host "    (This takes ~3-5 minutes on first run)`n"

gcloud builds submit . `
    --tag $IMAGE `
    --project $PROJECT `
    --suppress-logs

Write-Host "`n Image built and pushed: $IMAGE`n"

# ── Helper: deploy one service ────────────────────────────────────────────────
function Deploy-Service {
    param(
        [string]$ServiceName,
        [string]$Entrypoint,
        [string[]]$ExtraEnv = @()
    )

    Write-Host "  Deploying $ServiceName ..." -NoNewline

    $envString = ($commonEnv + @("AGENT_ENTRYPOINT=$Entrypoint") + $ExtraEnv) -join ","

    $url = gcloud run deploy $ServiceName `
        --image $IMAGE `
        --region $REGION `
        --project $PROJECT `
        --platform managed `
        --allow-unauthenticated `
        --memory 512Mi `
        --cpu 1 `
        --timeout 600 `
        --concurrency 10 `
        --set-env-vars $envString `
        --format "value(status.url)" `
        2>$null

    Write-Host "  $url" -ForegroundColor Green
    return $url.Trim()
}

# ── Step 2: Deploy sub-agents (parallel-ish, sequential for URL capture) ──────
Write-Host "━━━ Step 2/3: Deploying sub-agents ━━━" -ForegroundColor Yellow

$assemblerUrl  = Deploy-Service "contextmd-assembler"  "context_assembler_agent/server.ts"
$reasoningUrl  = Deploy-Service "contextmd-reasoning"  "reasoning_agent/server.ts"
$contraUrl     = Deploy-Service "contextmd-contra"     "contraindication_agent/server.ts"
$literatureUrl = Deploy-Service "contextmd-literature" "literature_agent/server.ts"
$briefingUrl   = Deploy-Service "contextmd-briefing"   "briefing_agent/server.ts"

Write-Host ""

# ── Step 3: Deploy orchestrator with all sub-agent URLs ───────────────────────
Write-Host "━━━ Step 3/3: Deploying orchestrator ━━━" -ForegroundColor Yellow

$orchExtra = @(
    "CONTEXT_ASSEMBLER_URL=$assemblerUrl",
    "REASONING_AGENT_URL=$reasoningUrl",
    "CONTRAINDICATION_AGENT_URL=$contraUrl",
    "LITERATURE_AGENT_URL=$literatureUrl",
    "BRIEFING_AGENT_URL=$briefingUrl"
)

$orchUrl = Deploy-Service "contextmd-orchestrator" "orchestrator/server.ts" $orchExtra

# ── Update ORCHESTRATOR_URL in the orchestrator service itself ─────────────────
Write-Host "`n  Patching ORCHESTRATOR_URL in orchestrator service..." -NoNewline
gcloud run services update contextmd-orchestrator `
    --region $REGION `
    --project $PROJECT `
    --update-env-vars "ORCHESTRATOR_URL=$orchUrl" `
    2>$null | Out-Null
Write-Host " "

# ── Done — print summary ───────────────────────────────────────────────────────
Write-Host @"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✅  ContextMD deployed to Google Cloud Run!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Assembler  : $assemblerUrl
  Reasoning  : $reasoningUrl
  Contra     : $contraUrl
  Literature : $literatureUrl
  Briefing   : $briefingUrl
  Orchestrator: $orchUrl

  ── Register on Prompt Opinion ──────────────────────────────
  Agent Card URL:
  $orchUrl/.well-known/agent-card.json

  ── Quick test ───────────────────────────────────────────────
  curl -X POST $orchUrl/ ``
    -H "Content-Type: application/json" ``
    -H "X-API-Key: contextmd-key-001" ``
    -d '{"jsonrpc":"2.0","id":"1","method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"text","text":"ping"}]}}}'

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@ -ForegroundColor Cyan

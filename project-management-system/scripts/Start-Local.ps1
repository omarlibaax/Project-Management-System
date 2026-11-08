$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot
$jar = Join-Path $projectRoot 'backend/target/pms-0.0.1-SNAPSHOT.jar'
if (!(Test-Path -LiteralPath $jar)) { throw 'Build the frontend and backend first. See README.md.' }
if (!$env:PMS_DB_URL) { $env:PMS_DB_URL = 'jdbc:postgresql://localhost:5432/project_management_db' }
if (!$env:PMS_DB_USERNAME) { $env:PMS_DB_USERNAME = 'pms_app' }
if (!$env:PMS_DB_PASSWORD) {
    Write-Host "Starting PMS with database account $env:PMS_DB_USERNAME. Existing accounts and data are retained."
    $databaseSecret = Read-Host 'Database password' -AsSecureString
    $env:PMS_DB_PASSWORD = [System.Net.NetworkCredential]::new('', $databaseSecret).Password
}
$env:SPRING_PROFILES_ACTIVE = 'dev'
$env:PMS_SEED_PROJECTS = 'false'
Write-Host 'Application: http://localhost:8080 (available when startup completes). Stop with Ctrl+C.'
try { & java -jar $jar; if ($LASTEXITCODE -ne 0) { throw 'Application startup failed. Review the output above.' } }
finally { Remove-Item Env:PMS_DB_PASSWORD -ErrorAction SilentlyContinue }

param([string]$PostgresBin='C:\Program Files\PostgreSQL\18\bin', [string]$JavaExecutable='C:\Program Files\Java\jdk-21.0.12.1\bin\java.exe', [switch]$Packaged)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot
$runtime=Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Force $runtime | Out-Null
$jar=Join-Path $projectRoot 'backend\target\pms-0.0.1-SNAPSHOT.jar'
foreach($required in @($JavaExecutable,$jar,(Join-Path $PostgresBin 'createdb.exe'),(Join-Path $PostgresBin 'dropdb.exe'),(Join-Path $projectRoot 'frontend\node_modules\vite\bin\vite.js'))){
 if(!(Test-Path -LiteralPath $required)){throw "Missing prerequisite: $required. Build the backend and install frontend dependencies first."}
}
foreach($port in @(8087,5179)){
 if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Verification port $port is already in use. Stop its process before running verification."}
}
# This verifies only the isolated loopback PostgreSQL cluster on port 55432.
$database='pms_browser_'+[guid]::NewGuid().ToString('N')
& (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p 55432 -U pms_test $database
if($LASTEXITCODE -ne 0){throw 'Start the isolated PostgreSQL cluster on port 55432 first.'}
$values=@{
 PMS_DB_URL="jdbc:postgresql://127.0.0.1:55432/$database"
 SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:55432/$database"
 SPRING_DATASOURCE_USERNAME='pms_test';SPRING_DATASOURCE_PASSWORD=''
 PMS_DB_USERNAME='pms_test';PMS_DB_PASSWORD=''
 SPRING_PROFILES_ACTIVE='dev';SERVER_PORT='8087'
 PMS_SEED_ADMIN_EMAIL='admin@example.test'
 PMS_SEED_ADMIN_PASSWORD=[guid]::NewGuid().ToString('N')
 PMS_SEED_ENGINEER_EMAIL='engineer@example.test'
 PMS_SEED_ENGINEER_PASSWORD=[guid]::NewGuid().ToString('N')
 PMS_E2E_URL=$(if($Packaged){'http://127.0.0.1:8087'}else{'http://127.0.0.1:5179'})
 PMS_API_TARGET='http://127.0.0.1:8087'
 LOGGING_LEVEL_ROOT='INFO'
 PMS_SEED_PROJECTS='true'
}
$original=@{}
foreach($name in $values.Keys){$original[$name]=[Environment]::GetEnvironmentVariable($name);[Environment]::SetEnvironmentVariable($name,$values[$name])}
$backendProcess=$null;$frontendProcess=$null
try{
 $backendProcess=Start-Process $JavaExecutable -ArgumentList @('-jar',('"'+$jar+'"')) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'backend-smoke.log') -RedirectStandardError (Join-Path $runtime 'backend-smoke-error.log')
 $frontendProcess=Start-Process node -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5179','--strictPort') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtime 'frontend-smoke.log') -RedirectStandardError (Join-Path $runtime 'frontend-smoke-error.log')
 $ready=$false
 for($attempt=0;$attempt -lt 90;$attempt++){
  if($backendProcess.HasExited -or $frontendProcess.HasExited){throw 'A verification process exited unexpectedly.'}
  try{ $health=Invoke-RestMethod 'http://127.0.0.1:5179/actuator/health';if($health.status -eq 'UP'){$ready=$true;break}}catch{}
  if($backendProcess.HasExited){throw 'Backend exited. Inspect .runtime/backend-smoke-error.log.'}
  Start-Sleep -Seconds 1
 }
 if(!$ready){throw 'Development server readiness timed out.'}
 Write-Output 'Backend and Vite proxy health: UP'
 if($Packaged){
  $html=Invoke-WebRequest 'http://127.0.0.1:8087/projects/123' -UseBasicParsing
  if($html.StatusCode -ne 200 -or $html.Content -notmatch '<div id="root">'){throw 'Packaged SPA navigation did not return the application HTML. Build frontend before packaging backend.'}
  Write-Output 'Packaged frontend and direct SPA navigation: UP'
 }
 Push-Location (Join-Path $projectRoot 'frontend')
 try{& npm.cmd exec -- playwright test;if($LASTEXITCODE -ne 0){throw 'Browser verification failed.'}}finally{Pop-Location}
}finally{
 if($frontendProcess -and !$frontendProcess.HasExited){Stop-Process -Id $frontendProcess.Id; $frontendProcess.WaitForExit(10000) | Out-Null}
 if($backendProcess -and !$backendProcess.HasExited){Stop-Process -Id $backendProcess.Id; $backendProcess.WaitForExit(10000) | Out-Null}
 foreach($name in $values.Keys){[Environment]::SetEnvironmentVariable($name,$original[$name])}
 & (Join-Path $PostgresBin 'dropdb.exe') -h 127.0.0.1 -p 55432 -U pms_test --if-exists $database
 if($LASTEXITCODE -ne 0){Write-Warning "Could not remove disposable database $database."}
}

# Project Management System
Phases 1-2: Java 21 + Spring Boot modular monolith, PostgreSQL/Flyway and React/TypeScript/Vite.
Existing parent-directory files are preserved.

## Windows setup
Java 21 and Node are installed on the inspected workstation. PostgreSQL 18 service is
running; psql is located at C:\Program Files\PostgreSQL\18\bin\psql.exe.
The Maven wrapper downloads Maven automatically; no system Maven is required.

1. Create the dedicated role and database. In PowerShell:
```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -U postgres -f .\database\setup.psql
```
The script prompts for the dedicated database password. Run once on a fresh database.
Do not point integration tests at a database containing important records.

2. In the backend terminal, configure your local environment:
```powershell
$env:SPRING_PROFILES_ACTIVE = 'dev'
$env:PMS_DB_USERNAME = 'pms_app'
$dbSecret = Read-Host 'Database password' -AsSecureString
$env:PMS_DB_PASSWORD = [System.Net.NetworkCredential]::new('', $dbSecret).Password
$env:PMS_SEED_ADMIN_EMAIL = 'admin@example.test'
$adminSecret = Read-Host 'Development admin password (12–64 characters)' -AsSecureString
$env:PMS_SEED_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminSecret).Password
$env:PMS_SEED_ENGINEER_EMAIL = 'engineer@example.test'
$engineerSecret = Read-Host 'Development engineer password (12–64 characters)' -AsSecureString
$env:PMS_SEED_ENGINEER_PASSWORD = [System.Net.NetworkCredential]::new('', $engineerSecret).Password
Set-Location backend
.\mvnw.cmd spring-boot:run
```
Seeds run only with the dev profile and explicitly supplied credentials; no default
password exists. Accounts are inserted only if their email does not already exist.

3. In a second terminal:
```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
```
Open http://127.0.0.1:5173. Use the seed email and password you configured.
Use the same hostname throughout so browser session cookies remain consistent.

## Checks
```powershell
# Backend terminal, configured with a separate disposable PostgreSQL database:
.\mvnw.cmd test
# Frontend terminal:
npm.cmd test
npm.cmd run build
```

See [architecture](docs/ARCHITECTURE.md), [API contracts](docs/API.md),
[implementation status](docs/IMPLEMENTATION_STATUS.md) and [verification](docs/TESTING.md).
Environment variables are documented in [.env.example](.env.example); copying this file
does not load it into PowerShell. Do not commit a filled-out environment file.

## How this phase works
The login form gets a CSRF token, sends credentials to Spring Security, and then loads
the current-user DTO. Your browser sends its HttpOnly session cookie automatically.
React Query stores only profile data in memory. Each API request is checked by the
backend; changing a database account to inactive invalidates its next authenticated request.
Flyway creates the identity schema before Hibernate validates it. Additional modules
will extend this foundation in the sequence recorded in implementation status.
Created source files: [file inventory](docs/FILES.md). Latest verification: 24 backend, 12 frontend and 4 browser tests passed; both production builds passed. See docs/TESTING.md for reproducible isolated database and browser checks.

## Phase 2
Users, engineer directory, projects, planning schedules, and live portfolio summaries are implemented. Read the [Phase 2 guide](docs/PHASE_2.md) for file explanations, KPI definitions, optional 55-project seed, and manual testing. Feature scope and remaining modules are in docs/IMPLEMENTATION_STATUS.md.

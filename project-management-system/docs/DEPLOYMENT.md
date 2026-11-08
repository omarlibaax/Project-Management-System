# Release and deployment

The application can run as one Spring Boot JAR with the compiled React app included. No Node process is needed at runtime. Use Java 21 and PostgreSQL with the existing environment variables in `.env.example`.

## Build a release

From `project-management-system/`, with the disposable test database configured as described in TESTING.md:

```powershell
Push-Location frontend
npm.cmd ci
npm.cmd test
npm.cmd run build
Pop-Location
Push-Location backend
.\mvnw.cmd -B -ntp verify
Pop-Location
.\scripts\Verify-Foundation.ps1
.\scripts\Verify-Foundation.ps1 -Packaged
```

Build the frontend first. Maven copies `frontend/dist` into the JAR. The API, downloads, and frontend share an origin, and direct navigation to frontend routes returns the React app. Confirm `GET /` and a project URL return HTML, while unauthenticated `GET /api/projects` returns 401.

## Configure the environment

1. Back up the database, including evidence stored in `project_evidence`. Restore a backup into a staging environment and rehearse migration there.
2. Set `PMS_DB_URL`, `PMS_DB_USERNAME`, `PMS_DB_PASSWORD`, `PMS_TIMEZONE`, and `PMS_CURRENCY` for the intended database. Flyway applies V1–V3 and Hibernate validates the existing entity schema. The database account needs migration permissions at startup.
3. On a fresh database, provision the first administrator using the documented development seed in a private staging environment. Sign in, change its password, create a second manager for independent approvals, then stop the app and remove the development profile and all seed variables. Never run the development profile on the public deployment. Existing installations retain their accounts and passwords.
4. Keep `PMS_SECURE_COOKIE=true`. Terminate HTTPS on a reverse proxy, forward requests to the backend on a private interface, and set `SERVER_FORWARD_HEADERS_STRATEGY=framework` only when that proxy sanitizes forwarding headers. Configure the proxy upload limit to allow a 5 MB file plus multipart overhead.
5. Run the JAR under a dedicated service account with automatic restart and a private database connection. Do not expose PostgreSQL to the public network.

```powershell
# Environment variables must already be configured for the service.
java -jar backend/target/pms-0.0.1-SNAPSHOT.jar
```

Probe `/actuator/health`. Sessions reside in memory; restarts sign users out. Run one backend instance until shared sessions and scheduler coordination are added. Overdue checks run hourly and deduplicate notifications per project deadline and recipient. Set `PMS_DELAY_CHECK_MS` only via the Spring property `pms.delay-check-ms` (for example `--pms.delay-check-ms=60000`) when a different cadence is needed.

## Operational checks

- Verify two-manager review, assignment visibility, download authorization, a 5 MB upload, and a completed project in staging.
- Schedule encrypted database backups and perform restore drills. Evidence increases database size; enforce storage monitoring and a retention policy appropriate to your organization.
- Monitor process health, database growth, latency, and application errors. Preserve audit records.
- Roll back application releases only when compatible with the migrated schema. Restore a tested backup for incompatible database changes; do not edit applied Flyway migrations.

Native Excel exports keep cells as text to preserve exact decimal values and prevent formula interpretation. PDF downloads use a basic monospaced report; characters outside printable ASCII appear as `?`. Browser Print preserves the rendered page's fonts and is the alternative for multilingual reports. Files are downloaded as attachments, limited to PDF/PNG/JPEG signatures; no malware scanner is integrated. Add scanning before adoption in an environment that requires it.

Deployment to an external host, load testing against production traffic targets, managed secrets, database backup automation, and organization-specific security review require the target environment. They have not been performed by the local verification suite.

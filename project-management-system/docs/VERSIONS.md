# Selected versions
Java 21 (local 21.0.12.1); Spring Boot 4.1.2 (latest stable from Initializr metadata
when checked); Maven 3.10.0 via the generated wrapper; PostgreSQL 18 installed locally.
JUnit 5.14.4 is explicitly selected to honor the requested JUnit 5 test stack.
Spring, Hibernate, Flyway, PostgreSQL JDBC, Mockito and related versions are managed by
the Spring Boot dependency BOM, avoiding incompatible independent version selection.

Frontend direct dependencies are pinned exactly in frontend/package.json and
frontend/package-lock.json. Use npm ci to reproduce the selected graph.
Installed Node 26.13.0 and npm 11.20.0 were used for verification.

Sources: https://start.spring.io/metadata/client
https://docs.spring.io/spring-boot/
https://vite.dev/guide/
https://repo.maven.apache.org/maven2/org/junit/junit-bom/maven-metadata.xml
## Exact frontend dependencies
| Package | Version |
| --- | --- |
| @hookform/resolvers | 7.0.3 |
| @radix-ui/react-slot | 1.5.0 |
| @tanstack/react-query | 5.107.1 |
| axios | 1.21.0 |
| class-variance-authority | 0.7.1 |
| clsx | 2.1.1 |
| lucide-react | 1.70.0 |
| react | 19.3.1 |
| react-dom | 19.3.1 |
| react-hook-form | 7.91.0 |
| react-router | 8.5.1 |
| recharts | 3.10.1 |
| tailwind-merge | 3.7.0 |
| zod | 4.6.7 |
| @tailwindcss/vite | 4.3.5 |
| @testing-library/jest-dom | 7.0.1 |
| @testing-library/react | 16.3.3 |
| @testing-library/user-event | 14.6.8 |
| @types/node | 26.6.6 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |
| @vitejs/plugin-react | 6.2.1 |
| jsdom | 31.0.0 |
| tailwindcss | 4.3.5 |
| typescript | 7.0.2 |
| vite | 8.3.6 |
| vitest | 5.1.0 |

Browser QA: @playwright/test 1.65.0 with installed Microsoft Edge.

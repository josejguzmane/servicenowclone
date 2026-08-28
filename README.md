# ServiceDesk

ServiceNow-style ticketing and support management platform: a self-service portal for
end users and external customers, and an agent workspace for support staff.

Built for on-prem deployment — every dependency (Redis, MinIO, SMTP, and later
PostgreSQL) runs locally via Docker Compose, with no managed cloud service required.

> **Storage:** the API currently runs on a JSON document store
> (`apps/api/data/servicedesk.json`), so no database is needed to run it. Services
> only ever talk to the repository interfaces in `apps/api/src/storage`, and the
> Prisma schema in `apps/api/prisma` stays in the repo as the target shape — moving
> to PostgreSQL means adding a second set of repository implementations and
> rebinding them in `StorageModule`, not touching auth, policy or domain code.

## Layout

| Path               | What it is                                                    |
| ------------------ | ------------------------------------------------------------- |
| `apps/api`         | NestJS API, JSON store, future Prisma schema/migrations        |
| `apps/portal`      | React self-service portal (end users, external customers)      |
| `apps/workspace`   | React agent workspace (agents, leads, admins, auditors)        |
| `packages/shared`  | Permission catalogue, role mapping, ticket domain rules        |
| `packages/ui`      | API client, auth context, shared components                    |

## Prerequisites

- Node.js 20+
- pnpm 9.12.3
- Docker with Compose v2

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm dev                            # API :3000, portal :5173, workspace :5174
```

The API needs nothing else running: on first boot it copies the tracked demo dataset
`apps/api/data/seed.json` to its working file `apps/api/data/servicedesk.json` (git
ignored) and writes every change back there. `pnpm seed:reset` deletes the working
file so the next boot starts from the seed again; `pnpm seed:build` regenerates the
seed itself.

`pnpm infra:up` starts Redis, MinIO and MailHog for the phases that need them. Postgres
sits behind the `database` profile and stays down until the database driver lands:

```bash
docker compose --profile database up -d
```

Local endpoints: API `http://localhost:3000/api/v1`, OpenAPI docs `/api/docs`
(non-production only), MailHog `http://localhost:8025`, MinIO console
`http://localhost:9001`.

### Seeded accounts

Password for all of them is `ChangeMe123!secure` (override with `SEED_PASSWORD`).

| Email                   | Role                       |
| ----------------------- | -------------------------- |
| `admin@example.com`     | admin                      |
| `lead@example.com`      | team lead                  |
| `agent@example.com`     | agent                      |
| `employee@example.com`  | internal end user          |
| `customer@acme.example` | external end user (Acme)   |

## Verification

```bash
pnpm lint
pnpm -r typecheck
pnpm test
pnpm build
```

## Moving to a database

`apps/api/prisma` holds the schema, the initial migration and the append-only audit
trigger for the eventual PostgreSQL backend; `pnpm --filter @servicedesk/api db:validate`
keeps the schema honest. `apps/api/src/storage/entities.ts` mirrors it, so a Prisma
implementation of the four repository interfaces plus a `StorageModule` rebinding is
the whole migration. Apply the audit guard once per database:

```bash
docker compose exec -T postgres psql -U servicedesk -d servicedesk \
  -f - < apps/api/prisma/sql/audit_append_only.sql
```

Until then the JSON audit repository is append-only by construction: it only ever
pushes rows and has no update or delete path.

## Authorization model

Roles map to a fixed permission catalogue in `packages/shared`; nothing in the API
branches on a role string. Route guards check coarse permissions, and
`PolicyService` re-checks each record and produces the scope filter that every
ticket query must be built from, so a missing filter cannot silently widen access.

External customer users are pinned to their own customer account regardless of the
permissions they hold — an account admin sees their account, everyone else sees only
their own tickets. Reads outside your scope return 404 rather than 403 so ticket
existence is not disclosed.

Access tokens are short-lived JWTs, refresh tokens are opaque, single-use and stored
only as SHA-256 hashes. Roles and group memberships are reloaded from storage on
every request, so revoking access takes effect immediately instead of at token expiry.

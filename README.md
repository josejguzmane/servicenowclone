# ServiceDesk

ServiceNow-style ticketing and support management platform: a self-service portal for
end users and external customers, and an agent workspace for support staff.

Built for on-prem deployment — every dependency (PostgreSQL, Redis, MinIO, SMTP) runs
locally via Docker Compose, with no managed cloud service required.

## Layout

| Path               | What it is                                                    |
| ------------------ | ------------------------------------------------------------- |
| `apps/api`         | NestJS API, Prisma schema/migrations/seed                      |
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
pnpm infra:up                       # Postgres, Redis, MinIO, MailHog
pnpm --filter @servicedesk/api db:migrate
pnpm db:seed
pnpm dev                            # API :3000, portal :5173, workspace :5174
```

Apply the append-only guard on the audit table once per database:

```bash
docker compose exec -T postgres psql -U servicedesk -d servicedesk \
  -f - < apps/api/prisma/sql/audit_append_only.sql
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
only as SHA-256 hashes. Roles and group memberships are reloaded from the database on
every request, so revoking access takes effect immediately instead of at token expiry.

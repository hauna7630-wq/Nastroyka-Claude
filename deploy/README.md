# Deploy — agent-os + teamly (single host, CI/CD)

Both apps run on one server behind **Caddy** (automatic HTTPS), sharing one
**Postgres (pgvector)** instance; agent-os also uses **Redis**. Images are built
and pushed to **GHCR** by GitHub Actions, which then SSHes to the host and brings
the stack up. **Each app applies its own Prisma migrations on startup.**

```
                     ┌─────────── Caddy (:80/:443, auto-TLS) ───────────┐
   teamly.<domain> ──┤ reverse_proxy → teamly:3000                      │
   agent.<domain>  ──┤ reverse_proxy → agentos:3000                     │
                     └──────────────────────────────────────────────────┘
        teamly ─┐                      agentos ─┐
                ├── postgres (pgvector): db `teamly`, db `agent_os`
                └────────────────────── redis (agentos only)
```

## 1. Server (one-time)

A small VPS (2 vCPU / 4 GB is comfortable), Ubuntu 22.04/24.04. As root:

```bash
curl -fsSLO https://raw.githubusercontent.com/<owner>/<repo>/<branch>/deploy/provision.sh
bash provision.sh          # installs Docker + compose, creates `deploy` user
# add your CI deploy public key:
echo "ssh-ed25519 AAAA... ci-deploy" >> /home/deploy/.ssh/authorized_keys
```

## 2. DNS

Point both subdomains at the server IP (A, and AAAA if IPv6):

```
teamly.<domain>   A   <server-ip>
agent.<domain>    A   <server-ip>
```

TLS is issued automatically by Caddy on first request (Let's Encrypt) — just make
sure ports 80/443 are open.

## 3. GitHub secrets (Settings → Secrets and variables → Actions)

| Secret | What |
| --- | --- |
| `SSH_HOST` | server IP / hostname |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | private key whose public key is in the host's authorized_keys |
| `GHCR_TOKEN` | a PAT with `read:packages` (the host uses it to pull private images) |
| `POSTGRES_PASSWORD` | long random |
| `AUTH_SECRET` | teamly session secret (32+ chars) |
| `TEAMLY_DOMAIN` | e.g. `teamly.example.com` |
| `AGENT_DOMAIN` | e.g. `agent.example.com` |
| `ACME_EMAIL` | email for Let's Encrypt |
| `ANTHROPIC_API_KEY` | *(optional)* agent-os real planner/model |
| `OPENAI_API_KEY` | *(optional)* real embeddings |
| `TAVILY_API_KEY` | *(optional)* `web_search` tool |
| `ALLOWLIST_DOMAINS` | *(optional)* comma list for `http_request` |

> Without the optional AI keys agent-os still runs on its offline adapters.

## 4. Deploy

- Manual: **Actions → Deploy → Run workflow**.
- Automatic: push to the **`release`** branch.

The pipeline: builds both images → pushes to `ghcr.io/<owner>/{agent-os,teamly}` →
copies `deploy/*` to the host → writes `~/app/.env` from secrets →
`docker compose -f docker-compose.prod.yml pull && up -d`.

## 5. First-run seed (teamly demo data, optional)

```bash
ssh deploy@<host>
cd ~/app
docker compose -f docker-compose.prod.yml exec teamly node_modules/.bin/prisma --version  # sanity
# teamly seed/reindex live in the image's package scripts; run if you want demo data:
# (the app already migrates on startup; seeding is optional)
```

agent-os has no orchestrator agent until you create one — open `https://agent.<domain>`,
go to **Команда**, and "hire" a `Координатор` (orchestrator) + a few typed agents.

## 6. Operations

```bash
docker compose -f docker-compose.prod.yml ps          # status
docker compose -f docker-compose.prod.yml logs -f agentos
docker compose -f docker-compose.prod.yml restart teamly

# Postgres backup
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dumpall -U app | gzip > backup-$(date +%F).sql.gz
```

**Rollback**: images are tagged `:latest`; pin to an immutable tag (e.g. the git
SHA) in `docker-compose.prod.yml` and re-run, or `docker compose up -d` after
`docker pull ghcr.io/<owner>/teamly:<sha>`.

## Notes / honest caveats

- The Dockerfiles + this workflow were authored and YAML-validated locally, but the
  **image builds are exercised in CI**, not in the dev sandbox (its Docker registry
  is blocked). The first CI run is the real verification.
- Migrations run on container startup (`prisma migrate deploy`), which is idempotent;
  with a single replica per app this avoids races.
- pgvector is pre-enabled by `postgres-init/01-init.sql`; the apps' own
  `CREATE EXTENSION IF NOT EXISTS vector` migrations are then no-ops.

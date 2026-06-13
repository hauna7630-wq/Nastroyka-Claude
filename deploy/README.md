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

You need a **KVM VPS with Docker + SSH**. Shared hosting won't run this stack, and
**OpenVZ won't either** — agent-os's `code_exec` sandbox needs Linux namespaces
(`unshare`, `prlimit`), which OpenVZ containers disable. Always pick a **KVM** plan.

### Getting a Russian KVM VPS

Pick any RU KVM provider (Timeweb Cloud, Selectel, vdska/RuVDS, FirstVDS, …):

1. Create a server with **KVM** virtualization, OS **Ubuntu 24.04 LTS**.
2. Specs: **2 vCPU / 4 GB RAM / 40 GB+ NVMe** is comfortable (2 GB is the bare
   minimum — pgvector + two Node apps + Caddy). 4 vCPU / 4 GB / 50 GB is plenty.
3. Auth: upload your SSH public key (preferred) or set a root password. You'll get a
   **public IPv4** — that's `<server-ip>` used below and in DNS.
4. Make sure ports **22, 80, 443** are open in the provider's firewall.

> Image builds happen in GitHub Actions, not on the box, so 4 GB RAM is enough for
> runtime. `provision.sh` also adds a 2 GB swap file as OOM insurance.

> **Note on real Anthropic API:** from a Russian IP, `api.anthropic.com` is
> geo-blocked. agent-os runs fine on its **offline adapters** without any keys; only
> set `ANTHROPIC_API_KEY` if you front it with a proxy / local model. teamly does not
> depend on it.

### Provision it

As root on the VPS:

```bash
curl -fsSLO https://raw.githubusercontent.com/<owner>/<repo>/<branch>/deploy/provision.sh
bash provision.sh          # installs Docker + compose, creates `deploy` user
# add your CI deploy public key:
echo "ssh-ed25519 AAAA... ci-deploy" >> /home/deploy/.ssh/authorized_keys
```

Generate the CI deploy keypair on your machine (public part → server above, private
part → GitHub secret `SSH_KEY`):

```bash
ssh-keygen -t ed25519 -C ci-deploy -f ci_deploy -N ""
# ci_deploy.pub → authorized_keys ;  ci_deploy → SSH_KEY secret
```

Generate strong secrets:

```bash
openssl rand -hex 24   # POSTGRES_PASSWORD
openssl rand -hex 24   # AUTH_SECRET
```

## 2. DNS (domain `work8n.ru`)

Manage DNS wherever you like — the records are the same. If you delegate the domain to
the VPS provider, set the registrar's nameservers to the ones it gave you, e.g.:

```
ns1.vdska.ru   ns2.vdska.ru
```

Then, in **that** provider's DNS panel for `work8n.ru`, add A records pointing at the
VPS IP:

```
agent.work8n.ru    A   <server-ip>
teamly.work8n.ru   A   <server-ip>
# optional landing on the root:
# work8n.ru        A   <server-ip>
```

> Whichever DNS panel is authoritative for `work8n.ru`, only these two A records are
> required. NS delegation can take up to a few hours to propagate.

TLS is issued automatically by Caddy on first request (Let's Encrypt) — just make
sure ports 80/443 are open on the server.

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
| `ANTHROPIC_BASE_URL` | *(optional)* proxy base URL to reach Anthropic from a blocked network (RU) |
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

## 5. First-run seed (teamly: create the first login)

teamly has no public signup — the first org + owner user is created by a seed. Run the
self-contained production seed inside the running container:

```bash
ssh deploy@<host>   # or root
cd ~/app            # /home/deploy/app
docker compose -f docker-compose.prod.yml exec teamly node prisma/seed.prod.cjs
# → Login: owner@acme.test / secret123   (change the password in-app afterwards)
```

It's idempotent (re-running is a no-op once the user exists). Optional demo content +
search reindex live in the image's package scripts.

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

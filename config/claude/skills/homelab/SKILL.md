---
name: homelab
description: Brandon's homelab platform — a curated set of self-hosted services (Gitea, VictoriaMetrics/Grafana, Ollama LLMs, ntfy push, NAS storage, Nomad compute) usable by any project on this machine. Use whenever the user wants to host a git repo, push metrics, graph data, send a push notification, run an LLM prompt locally, store files, or deploy a service — i.e. anything that sounds like "where should I put this", "host this", "send me a notification", "run this against a local LLM", "push metrics for this app", "I need a database/queue/service", "give this a hostname". Also use when the user asks what's available on their infrastructure, what hardware they have, or what services they can consume. This skill is the *consumer* view — to actually operate the cluster, use the project-scoped `home-infra` skill that loads inside the `~/code/home-infra` repo.
---

# Homelab — Consumer Guide

Brandon runs a private homelab: four NixOS VMs on Proxmox at home, plus a NAS. This skill teaches any project how to **consume** those services. Think of it as an internal PaaS — request capacity, push data, query endpoints. **Do not try to operate the cluster from a consumer project.** Changes to the infrastructure itself go through `lit` tickets against `~/code/home-infra`.

## Prerequisites

1. **Tailscale.** Every service lives on the `elk-wall.ts.net` tailnet. Off-tailnet, **nothing** resolves or connects. Check with `tailscale status` before debugging anything as a connectivity problem. If Tailscale isn't up, ask the user to bring it up — do not try to fix it yourself.
2. **DNS.** Services are at `<name>.sanctuary.gdn` (custom domain, internal-only). Public internet sees nothing.
3. **No SLA.** This is a home network. Power cycles happen. Treat it as best-effort. Don't build anything that needs 99.9% uptime without talking to the user first.

## Service Catalog

### Gitea — private Git hosting
- **URL:** `https://gitea.sanctuary.gdn`
- **SSH clone:** `git@gitea.sanctuary.gdn:<user>/<repo>.git` (port 2222, configure in `~/.ssh/config` if using non-standard ssh port)
- **HTTPS clone:** `https://gitea.sanctuary.gdn/<user>/<repo>.git`
- **Auth:** personal access token. The user creates one at `https://gitea.sanctuary.gdn/user/settings/applications`. Store in `~/.config/git-credentials` or pass via `GITEA_TOKEN` env var. **Never put tokens in the repo.**
- **Create a repo via API:**
  ```bash
  curl -sk -X POST https://gitea.sanctuary.gdn/api/v1/user/repos \
    -H "Authorization: token $GITEA_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"my-project","private":true,"auto_init":true}'
  ```
- **Push existing project:**
  ```bash
  git remote add origin https://gitea.sanctuary.gdn/<user>/<repo>.git
  git push -u origin main
  ```
- **What you can do:** create repos, push code, run Gitea Actions (CI workflows in `.gitea/workflows/`), open PRs.
- **What needs a ticket:** creating service/bot accounts, org-wide settings, runner capacity changes.

### VictoriaMetrics — metrics ingestion
- **Write endpoints** (no auth, internal network only):
  - **InfluxDB line protocol** (easiest for ad-hoc writes):
    ```bash
    curl -X POST 'http://192.168.7.208:8428/write' \
      --data-binary 'my_metric,env=prod,service=foo value=42 '$(date +%s)'000000000'
    ```
  - **Prometheus text format:**
    ```bash
    curl -X POST 'http://192.168.7.208:8428/api/v1/import/prometheus' \
      --data-binary 'my_metric{env="prod",service="foo"} 42'
    ```
  - **Prometheus remote_write** (for apps that export `prometheus.yml`-style config):
    Point `remote_write.url` at `http://192.168.7.208:8428/api/v1/write`.
- **Query (PromQL):**
  ```bash
  curl 'http://192.168.7.208:8428/api/v1/query?query=my_metric'
  curl 'http://192.168.7.208:8428/api/v1/query_range?query=rate(my_metric[5m])&start=...&end=...&step=60'
  ```
- **Label conventions:** always include `service=<your-project>`. Use `env=prod|dev|local`. Avoid high-cardinality labels (user IDs, timestamps, random UUIDs) — they explode storage.
- **Retention:** operator-managed. Don't assume data older than ~30 days is still there unless you've confirmed with the user.

### Grafana — dashboards and visualization
- **URL:** `https://grafana.sanctuary.gdn`
- **Read access:** the user can view any dashboard in the UI.
- **Creating dashboards:** dashboards are **managed as code** in `~/code/home-infra/dashboards/*.json` and deployed via Terraform. Do **not** create dashboards in the Grafana UI and expect them to persist — the next terraform apply will overwrite or ignore them.
- **To add a dashboard:** draft the JSON, then file a `lit` ticket (see "Requesting Changes" below) with topic `grafana` containing the dashboard JSON and the metric names it depends on. The operator (or you, via PR) adds it to `dashboards/` and applies terraform.
- **Quick way to prototype:** create the dashboard in the UI, export JSON (gear icon → JSON model), attach it to the ticket.
- **Datasource UID:** always `"prometheus"` — VictoriaMetrics is wired in behind that name. Reference it that way in exported JSON.

### Ollama — local LLM inference (GPU)
- **Endpoint:** `http://192.168.7.218:11434` (on the `gpu` VM, NVIDIA RTX 2070 with 8GB VRAM)
- **API shape:** Ollama native + an OpenAI-compatible endpoint at `/v1/chat/completions`.
- **List models:**
  ```bash
  curl http://192.168.7.218:11434/api/tags
  ```
- **Generate:**
  ```bash
  curl http://192.168.7.218:11434/api/generate -d '{
    "model": "llama3",
    "prompt": "Why is the sky blue?",
    "stream": false
  }'
  ```
- **OpenAI-compatible (drop-in for SDKs):**
  ```python
  from openai import OpenAI
  client = OpenAI(base_url="http://192.168.7.218:11434/v1", api_key="ollama")
  ```
- **Constraints:** 8GB VRAM caps the model size (~7B params comfortably, 13B with quantization). If the model isn't already pulled, `api/tags` won't list it — file a ticket to request a new one (pulling large models is minutes of download).
- **Not for:** production inference serving, multi-user concurrent load, or models that need >8GB VRAM.

### Vault — secret storage

- **URL:** `https://vault.sanctuary.gdn` (KV v2 backend at `secret/`, versioned and recoverable). For API keys, tokens, DB passwords — not blobs.
- **Namespace:** each project gets `secret/consumer/<slug>/*`. Stay inside it; operator-owned paths (`secret/gitea`, etc.) will reject you.
- **Auth:** a scoped token per project, stashed in macOS Keychain as `vault-token-<slug>`. Retrieve at runtime — never commit, never echo into a metric/notification body:

  ```bash
  export VAULT_ADDR=https://vault.sanctuary.gdn
  export VAULT_TOKEN=$(security find-generic-password -s "vault-token-<slug>" -a "$USER" -w)
  ```

#### Reading and writing secrets

The same `vault kv` commands handle both put-in and get-out — that's the whole API surface. `put` is creating *or* updating (KV v2 versions automatically); `get -field=` extracts a single value cleanly for shell pipelines.

```bash
# write (create or update; auto-versioned)
vault kv put secret/consumer/<slug>/db username=app password='s3cret'
vault kv patch secret/consumer/<slug>/db rotated_at=2026-04-27   # update one field, keep the rest

# read
vault kv get secret/consumer/<slug>/db
vault kv get -field=password secret/consumer/<slug>/db
vault kv list secret/consumer/<slug>

# HTTP equivalent (KV-v2 inserts `data/` in the URL)
curl -sk -X POST -H "X-Vault-Token: $VAULT_TOKEN" \
  -d '{"data":{"password":"s3cret"}}' \
  https://vault.sanctuary.gdn/v1/secret/data/consumer/<slug>/db
curl -sk -H "X-Vault-Token: $VAULT_TOKEN" \
  https://vault.sanctuary.gdn/v1/secret/data/consumer/<slug>/db | jq -r '.data.data.password'
```

Anything secret a project produces — a generated API key, a webhook signing secret, a freshly-rotated DB password — goes in the same way: one `vault kv put`. That is "how a credential gets into Vault."

#### First-time provisioning (self-serve)

If your project slug doesn't have a token yet, mint one yourself using the root token from Keychain. Do this once per slug.

Run the whole thing in a subshell so the root token never enters your interactive environment, and pull only the one field you need from the seeds blob:

```bash
SLUG=<slug>
(
  export VAULT_ADDR=https://vault.sanctuary.gdn
  VAULT_TOKEN=$(security find-generic-password -s "homelab-infra-vault-seeds" -a "$USER" -w \
                 | jq -r .vault_root_token)
  export VAULT_TOKEN

  vault policy write "consumer-$SLUG" - <<EOF
path "secret/data/consumer/$SLUG/*"     { capabilities = ["create","read","update","delete","list"] }
path "secret/metadata/consumer/$SLUG/*" { capabilities = ["list","read","delete"] }
EOF

  vault token create -policy="consumer-$SLUG" -period=720h -display-name="$SLUG" \
                     -format=json \
    | jq -r .auth.client_token \
    | xargs -I{} security add-generic-password -U -s "vault-token-$SLUG" -a "$USER" -w {}
)
```

The subshell exits → `VAULT_TOKEN` and the seed blob are gone from process memory. The new token never appears in your shell history (piped straight to `security`). All subsequent reads/writes use `vault-token-<slug>` only.
- **Hygiene:** read once at startup and cache; don't poll. One token per project. After a power cycle Vault may be sealed (`503 Vault is sealed`) — auto-unseals within ~2 min, don't retry-loop.

### ntfy — push notifications
- **URL:** `https://ntfy.sanctuary.gdn`
- **Send a notification:**
  ```bash
  curl -d "Build finished: all green" https://ntfy.sanctuary.gdn/<topic>
  ```
  ```bash
  curl -H "Title: Deploy failed" \
       -H "Priority: high" \
       -H "Tags: warning,rotating_light" \
       -d "See logs at ..." \
       https://ntfy.sanctuary.gdn/<topic>
  ```
- **Topic naming:** pick a topic string unique to your project (e.g. `myproject-alerts`). Anyone who knows the topic name can publish and subscribe — treat the topic like a shared secret if the content is sensitive.
- **Subscribe on phone:** ntfy mobile app, point at `https://ntfy.sanctuary.gdn`, add topic.
- **Good for:** CI notifications, long-job-complete pings, alerts from personal scripts.
- **Not for:** anything with PII or secrets in the message body.

### NAS storage (Unraid) — bulk file storage
- **Host:** `192.168.7.201` (hostname `Uno`), ~11TB usable across 4×4TB WD Red drives.
- **Direct access is not a consumer path.** Don't `mount`, `smbclient`, or `scp` to the NAS from a random project.
- **To use NAS storage from a project:** file a ticket requesting a share. Describe: path prefix you want, expected size, whether you need SMB/NFS/rsync, read-only vs read-write, and whether the share should be backed up (it lives on the NAS, but call out what retention/redundancy you expect).
- **For backups specifically:** backups of homelab services already land in `/mnt/user/backup/homelab/` on the NAS via automated systemd timers. If you need your project's data backed up here, that's a ticket.

### Nomad — running a long-lived service
- Consumer projects **do not** write Nomad job specs directly. To host a service:
  1. Build a Docker image (any registry works; the homelab also has a registry at `https://registry.sanctuary.gdn` — ask the user for push creds).
  2. File a `lit` ticket with: image reference, required ports, secrets it needs (name them; the operator maps to Vault paths), host volumes (size estimate), and whether it needs a `*.sanctuary.gdn` hostname.
  3. The operator (or you, via PR to `~/code/home-infra`) writes the Nomad job spec, the Vault policy, the DNS record, and the ingress tag.
- **Compute envelope you can assume:**
  - `runner` VM — generic x86 workloads, bulk of CPU/RAM capacity, no GPU.
  - `gpu` VM — NVIDIA RTX 2070 (8GB VRAM). Scarce resource: only schedule jobs that actually need the GPU.
  - `infra` / `caddy` VMs — small, reserved for cluster control plane and ingress. Don't target these.

### Docker Registry
- **URL:** `https://registry.sanctuary.gdn`
- **Pull:** no auth required from inside the network for standard images.
- **Push:** file a ticket to get credentials provisioned for your project.
- Useful for caching base images and hosting private images that Nomad jobs consume.

## Connectivity Quick Check

Before debugging any service integration, verify in this order:

```bash
tailscale status | grep elk-wall           # tailnet up?
curl -sk -o /dev/null -w '%{http_code}\n' https://gitea.sanctuary.gdn     # TLS ingress reachable?
curl -s http://192.168.7.208:8428/-/healthy                               # VictoriaMetrics direct?
```

If step 1 fails: ask the user to bring up Tailscale.
If step 2 fails but step 1 passes: Caddy or DNS issue — this is operator territory, file a ticket.
If step 3 fails but step 2 passes: the VM is up but the service is down — file a ticket.

## Hard Rules (Consumer Boundary)

These are **non-negotiable**. Violating them turns a consumer project into a drift source for the whole cluster.

1. **Do not edit `~/code/home-infra`** from a consumer project. Not jobs, not terraform, not NixOS modules. If you think you need to, file a ticket instead.
2. **Do not SSH into the VMs** (`ops`, `infra`, `runner`, `gpu`, `caddy`, `unraid`) from a consumer project to "quickly try something." There's no such thing as a quick local change here — it won't survive the next deploy, and it will confuse whoever debugs next.
3. **Do not commit credentials.** Consumer projects only get narrow, scoped credentials — their own Gitea PAT, registry creds, a Vault token limited to `secret/consumer/<project>/*`. The cluster's root Vault token, Gitea admin tokens, and operator AppRoles never leave the operator's hands.
4. **Do not read or write Vault paths outside your project's namespace.** `secret/consumer/<your-project>/*` is yours; everything else is operator-owned and your token won't open it.
5. **Do not hit service APIs with abusive patterns** — no write loops against VictoriaMetrics without batching, no 1000-req/s bursts against Ollama, no crawling Gitea with `git clone --mirror` on every repo.
6. **Do not create Grafana dashboards in the UI and consider them persistent.** They aren't. Export JSON, file a ticket.
7. **Do not write to NAS shares** your project wasn't granted.

## Requesting Changes — `lit` Tickets

The homelab repo (`~/code/home-infra`) uses `lit` as its issue tracker. When a consumer project needs infrastructure work (a new service, a dashboard, a share, a registry credential, a DNS record, more GPU memory, a runner job, etc.), file a ticket.

### File a ticket

```bash
cd ~/code/home-infra
lit new \
  --title "Short imperative title" \
  --type feature \
  --topic <topic> \
  --description "$(cat <<'EOF'
## What I need
<1–3 sentences on the capability>

## Why
<what consumer project this is for, what it unblocks>

## Proposed shape
<e.g. service name, port, required secrets, expected traffic>

## Acceptance
<how we'll know this is done — endpoint returns 200, dashboard renders, etc.>
EOF
)"
```

Topics currently in use: `grafana`, `misc`. Run `lit ls` first to see live topics and pick the closest match; use `misc` if nothing fits.

Types: `feature` (new capability), `bug` (something's broken), `chore` (housekeeping), `task` (scoped unit of work).

### Anti-patterns for tickets

- **"Make it work."** Always include the acceptance criterion. A ticket without a verifiable goal violates universal law `verifiable-goals` and will sit.
- **"Copy what production does."** The homelab *is* production. Describe the shape you need.
- **Mega-tickets.** If it needs more than three acceptance bullets, it's probably multiple tickets.

### Before filing, check for duplicates

```bash
cd ~/code/home-infra
lit ls --query "status:open" | grep -i <keyword>
```

## When to Reach for the Operator Skill

If the user is standing in `~/code/home-infra` and asking operational questions ("deploy this job", "check the logs", "query Vault"), the project-scoped `home-infra` skill loads there and handles it. Don't try to reach into operator-level work from a consumer project — `cd` into the repo and let the right skill activate, or just file a ticket.

## Summary for Agents

- **You're a tenant, not an admin.** Consume services via HTTP endpoints. Stay off the VMs.
- **Tailscale is the gate.** Everything else assumes it's up.
- **Changes happen via tickets**, not hot-edits. File `lit new` in `~/code/home-infra`.
- **Metrics/notifications/LLM = free-tier friendly.** Hit the endpoints directly.
- **Compute/storage/hostnames = request-only.** File a ticket.

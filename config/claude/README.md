# claude config

## zai

z.ai claude code integration docs: https://docs.z.ai/devpack/tool/claude

### auth token setup

`settings.zai.json` (tracked) holds the non-secret z.ai settings. The auth token lives in `~/.claude/settings.local.json` (gitignored by Claude Code, never tracked). Add the following key to that file (create it if absent, or merge into the existing `env` block if present):

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "<your-z.ai-token>"
  }
}
```

The encrypted token is stored in `config/claude/.env.zai` — **this file is tracked in git** and is present after clone. The private key in `config/claude/.env.keys` is gitignored and must be transferred out-of-band to a new machine. To recover the bare token value:
```bash
dotenvx get ANTHROPIC_AUTH_TOKEN -f config/claude/.env.zai
```
Paste the output directly into `settings.local.json` as the `ANTHROPIC_AUTH_TOKEN` value.

After rotating the token, update the backup so the recovery path stays valid:
```bash
dotenvx set ANTHROPIC_AUTH_TOKEN <new-token> -f config/claude/.env.zai
git add config/claude/.env.zai && git commit -m 'chore(claude): update encrypted token backup'
git push origin HEAD  # must reach remote (and merge) before the recovery path reflects the rotation
```

### model mapping

https://docs.z.ai/devpack/tool/claude#how-to-switch-the-model-in-use

I'm using 'glm-4.7' for everything, as I have haiku used in some of my agents and I don't want to use anything weaker than glm-4.7.

default values (as of time of writing) are:

```json
{
  "env": {
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.7",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.7"
  }
}
```
# claude config

## zai

z.ai claude code integration docs: https://docs.z.ai/devpack/tool/claude

### auth token setup

`settings.zai.json` (tracked) holds the non-secret z.ai settings. The auth token lives in `~/.claude/settings.local.json` (gitignored by Claude Code, never tracked):

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "<your-z.ai-token>"
  }
}
```

The encrypted token is stored in `config/claude/.env.zai` (decryptable with the private key in `config/claude/.env.keys`, which is gitignored). To recover it on a new machine: `dotenvx decrypt config/claude/.env.zai` — then copy the value into `settings.local.json`.

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
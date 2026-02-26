# WebGPU Skill

This repository contains a WebGPU skill. Skills are reusable capabilities for AI agents, packaged so they can be installed and reused across different tools and workflows. This one is framework-agnostic and focuses on reusable WebGPU/WGSL patterns, orchestration, and performance guidance across a wide range of GPU workloads.

## Supported agents

This skill is designed to work with the major agents that support skills, including Claude Code, Codex, Cursor, Cline, and GitHub Copilot, plus other compatible agents listed by the skills ecosystem.

## Contents

- [SKILL.md](SKILL.md): Skill metadata and overview
- [REFERENCE.md](REFERENCE.md): Quick reference for core WebGPU patterns
- [references/](references/): Concept guides and patterns
- [examples/](examples/): Small runnable snippets
- [templates/](templates/): Starter templates

## Highlights

- Compute + render pipeline patterns
- Orchestration and phase-based simulation guidance
- Practical performance notes and debugging tips
- Uniform packing and resource layout advice

## Installation

Install with the CLI:

```
npx skills add cazala/webgpu-skill
```

Refer to `SKILL.md` for the full entry point.

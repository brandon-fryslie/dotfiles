---
name: webgpu
description: WebGPU/WGSL guidance for initialization, render/compute pipelines, shader authoring, debugging, and performance; use when building or troubleshooting WebGPU apps, GPU compute workloads, or WGSL shaders.
---

# WebGPU Skill

Use this skill to design, implement, and debug WebGPU applications and GPU compute pipelines. Keep it framework-agnostic and focus on reusable WebGPU/WGSL patterns.

## What this skill covers

- Cover WebGPU initialization, device setup, and surface configuration.
- Cover compute pipelines, workgroup sizing, and storage buffer layout.
- Cover render pipelines, render passes, and post-processing patterns.
- Cover GPU/CPU synchronization and safe readback strategies.
- Cover performance and debugging practices.
- Cover architecture patterns: modular passes, phase-based simulation, and capability handling.
- Cover use cases: rendering, compute, ML training/inference, grid simulations, and systems modeling.

## Core principles

- Choose a **capability strategy**: fallback runtime, reduced mode, or fail fast.
- Avoid full GPU readbacks in hot paths; use **localized queries** or small readback buffers.
- Structure simulation with **phases** (state, apply, integrate, constrain, correct) to keep WGSL cohesive.
- Use **spatial grids** or other spatial indexing for neighbor queries and high particle counts.
- Build **modular passes** so render and compute stages stay composable and testable.

## Workflow

When asked to build a WebGPU feature:

1. Confirm the target platform and WebGPU support expectations.
2. Propose a resource layout (buffers, textures, bind groups) with a simple data model.
3. Sketch the pipeline graph (compute vs render passes) and dependencies.
4. Provide minimal working code and scale up with performance constraints.
5. Choose a capability strategy when WebGPU is unavailable.

## Deliverable checklist

- Provide clean WebGPU init and error handling.
- Include a buffer layout with alignment notes (16-byte struct alignment for WGSL).
- Include a pass graph with clear read/write ownership (ping-pong textures if needed).
- Call out readback and when it is safe.
- Provide an optional fallback or reduced mode for critical functionality.

## References and assets

- Use [REFERENCE.md](REFERENCE.md) for a compact WebGPU cheat sheet.
- Use [references/](references/) for deeper patterns and concepts.
- Use [examples/](examples/) for runnable snippets.
- Use [templates/](templates/) for project scaffolds or starter code.

## Quick reference

See [REFERENCE.md](REFERENCE.md) for a compact WebGPU cheat sheet and [references/](references/) for deeper patterns, including [references/use-cases.md](references/use-cases.md) and [references/simulation-patterns.md](references/simulation-patterns.md).

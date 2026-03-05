---
name: reverse-engineer-electron
description: Reverse-engineer Electron apps by creating a runnable modified-app workspace, deterministically unminifying code without behavior change, decomposing modules, and iteratively renaming modules with runtime debugging and human verification gates.
---

## Purpose

Reverse-engineer a target Electron app while preserving behavior at every stage.

The workflow is resumable. Do not assume a fresh workspace. Detect current state, continue from there.

## Non-Negotiable Rules

- Behavior preservation is mandatory in every step.
- Any transformation must be deterministic and semantics-preserving.
- Every hard gate is human-verified.
- No app-specific assumptions in the process itself. Adapt to each app's actual structure.
- All semantic renaming is strictly gated behind active debugger connections through the electric-cherry MCP server.
- If CDP and V8 are not both connected, do not perform any renames.
- All semantic renaming is strictly gated behind deterministic unminification of the target file first.
- Renaming on minified files is completely forbidden.

## Canonical Process

### 1. Project Setup: Create a Runnable Modified-App Workspace

Goal: run the app using modified resources from the workspace.

What to establish:

- A workspace layout that mirrors how the target app actually loads resources.
- A reliable run path that uses modified code/resources, not untouched upstream assets.
- A reproducible launch method suitable for iterative reverse engineering.

Allowed setup patterns (choose the one that works for the app):

- Run from extracted resources directly.
- Run from a dev build/compile flow when the app supports it.
- Repack changed resources back into an asar and run from a copy of the app bundle.

Preferred reliability fallback:

- Repack into asar and run from a copied app bundle when direct-extracted runtime is fragile.

Outcome required:

- You can launch the app with modified resources applied.

### Gate 1 (Hard, Human Verified)

A human verifies the app runs correctly from the modified-app workspace.

### 2. Deterministic Unminification (No Behavior Change)

Goal: make code readable while preserving exact behavior.

Requirements:

- Apply deterministic formatting/unminification only.
- Do not alter control flow, data flow, logic, side effects, or ordering.
- Do not introduce refactors during this stage.

Outcome required:

- Code is consistently unminified/readable with behavior unchanged.

### Gate 2 (Hard, Human Verified)

A human verifies the app still runs correctly after unminification.

### 3. Module Decomposition (No Behavior Change)

Goal: split/organize into modules while preserving behavior.

Requirements:

- Decompose according to actual dependency and execution structure.
- Preserve all runtime behavior and boundaries.
- Produce a dependency hierarchy that can drive rename order.

Outcome required:

- Modules are separated and dependency relationships are clear.

### Gate 3 (Hard, Human Verified)

A human verifies the app still runs correctly after module decomposition.

### 4. Iterative Semantic Reverse Engineering

Goal: rename modules and symbols semantically, one module at a time, with runtime evidence.

Absolute precondition:

- Connect via electric-cherry MCP to both:
- CDP debugger (renderer)
- V8 debugger (main process)
- If either connection is missing, stale, or broken, renaming is forbidden until both are reconnected.
- Ensure the target file was deterministically unminified first (for example via Prettier).
- If the file is still minified, renaming is forbidden.

Per-iteration workflow:

- Launch the app.
- Attach CDP debugger (renderer) and V8 debugger (main process).
- Choose next module by dependency order:
- First preference: module with no dependents.
- If none exist (for example circular graph), choose module with the least dependents.
- Perform semantic renaming for that module using runtime/static evidence.
- If needed, perform safe cross-module rename updates required by dependency links.

Hard rule per module:

- After every single module rename, stop for human verification before continuing.

### Gate 4 (Hard, Human Verified, Repeats Every Module)

A human verifies the app still works correctly after each module rename.

Then proceed to the next module.

### 5. Completion

Continue until every module has semantic names and the app remains functionally correct.

Done criteria:

- All modules renamed semantically.
- No unresolved modules remain in the dependency hierarchy.
- Final human verification confirms the app works correctly.

## Resume Expectations

This process is explicitly resumable from any stage.

On resume:

- Detect which stage is already complete.
- Continue from the next incomplete stage.
- Never reset progress just because workspace is not at step 0.

## What This Skill Must Never Do

- Assume a fresh empty workspace.
- Require arbitrary artifact-based "gates" as proof of progress.
- Tie the process to one app's structure.
- Skip human verification at hard gates.
- Perform semantic renaming without active CDP and V8 connections through electric-cherry MCP.
- Perform semantic renaming on minified files.

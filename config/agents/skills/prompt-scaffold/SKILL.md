---
name: prompt-scaffold
description: Use when the user wants to write, structure, scaffold, refine, template, or format a prompt for an LLM (Claude, ChatGPT, Gemini, etc.). Triggers on "help me write a prompt", "turn this into a prompt", "structure this prompt", "prompt template", "scaffold a prompt", "make a prompt for X", "clean up this prompt", or when the user pastes a rough task description and asks for it to be shaped. Produces a filled Task/Context/Goal/Tone/Rules template from the user's rough input, inferring fields aggressively and asking only about fields that genuinely cannot be inferred.
---

# Prompt Scaffold

Turn a rough request into a well-structured prompt using the Task / Context / Goal / Tone / Rules template.

## The Template (exact shape, always)

```
Task: [what you want it to do]

Context:
[the situation, the inputs, anything it needs to know]

Goal of this output:
- [specific outcome 1]
- [specific outcome 2]
- [what success looks like]

Tone:
[how it should sound]

Rules:
- [hard constraints]
- [things to avoid]
```

Emit this verbatim — same section names, same order, same punctuation. Users copy-paste the result; any drift from the template breaks that workflow.

## Process

1. **Read the user's input first.** Extract every field you can directly from what they gave you. Do not re-ask for anything already stated.
2. **Infer aggressively.** Reasonable defaults beat interrogation. If the user pasted code, the context is the code. If they said "for a blog post," the tone is probably conversational. Fill it in.
3. **Ask missing fields in one batch.** If something genuinely cannot be inferred, list the open questions as a single bulleted block — never one question at a time.
4. **Emit the filled template inside a fenced code block** so it copy-pastes cleanly.
5. **No commentary after the template** unless the user asks. No "here's your prompt," no summary, no offer to refine.

## Field semantics

- **Task** — a single imperative sentence. The verb-phrase describing what the LLM should do. Not the reason. Not the method. Not the success criterion.
- **Context** — facts the model needs that aren't already in Task. Inputs, audience, systems, domain, constraints of the world the prompt operates in. This is where pasted material, file excerpts, and background go.
- **Goal of this output** — observable properties of a correct response. Every bullet must be checkable against the output. "Covers X, Y, Z," "includes a code example," "under 300 words" — yes. "Is good," "is helpful" — no.
- **Tone** — voice, register, formality. One line. A few adjectives is ideal ("plainspoken, technical, no hedging").
- **Rules** — hard musts and must-nots. Each bullet stands alone as an enforceable constraint. Rules are for things that would make the output wrong, not for soft preferences.

## Anti-patterns — do NOT produce output like this

Bad — Task restates Goal:
```
Task: Write a good summary of the meeting.
Goal of this output:
- A good summary of the meeting
```
Task is the verb; Goal is the success criterion. They describe different things.

Bad — soft preferences smuggled into Rules:
```
Rules:
- Try to be concise
- It would be nice if it had examples
```
If it's not an enforceable must/must-not, it belongs in Tone or Goal, or it gets cut.

Bad — empty sections padded with filler:
```
Rules:
- Follow standard best practices
- Be helpful
```
If there are no real rules, write `Rules: none` and move on.

Bad — meta-instructions the user didn't ask for:
```
Rules:
- Respond in markdown
- Use bullet points where appropriate
```
Don't invent formatting rules. The user will add them if they want them.

## Acceptance check (run mentally before emitting)

- [ ] Task is one sentence starting with a verb.
- [ ] Context contains facts, not restatements of Task.
- [ ] Every Goal bullet names an observable property.
- [ ] Every Rule bullet is phrased as a must or must-not.
- [ ] Tone is one line.
- [ ] No field contradicts another.
- [ ] Output is wrapped in a fenced code block and nothing follows it.

If any check fails, fix before emitting.

## When args are provided

If the skill is invoked with args (e.g. `/prompt-scaffold write a release note for v2.3`), treat the args as the initial rough task and proceed with step 1. No separate "what do you want a prompt for?" round-trip.

## When the user's input is already near-complete

If they pasted something that already has most fields, just reformat it into the exact template shape and fill the gaps. Don't ask clarifying questions for output that's 90% there — ship the 90%, let them iterate.

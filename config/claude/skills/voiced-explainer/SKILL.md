---
name: voiced-explainer
description: Build a voiced explainer — a single HTML page that explains one subject, where every section and every quotable phrase plays as audio rendered locally by Kyutai Pocket TTS and shipped with the page. Use when the user asks to explain something with an infographic, wants a narrated or voiced explainer, says "explain X with an infographic", "make a voiced explainer about X", "infographic voiced by pocket TTS", "a page that talks", or wants a shareable explainer someone can listen to rather than only read.
---

# Voiced explainer

One page that explains one subject, and speaks. Two layers of audio: a narration per section,
and every quotable phrase clickable on its own. The reader can play the whole thing, or poke a
single line to hear it.

`references/example-say-the-name.html` is a finished one (Apple's Voice Control), with its
`references/example-clips.json` beside it. Read it for the wiring. Read the warning in step 6
before you borrow anything else from it.

## The thing that separates this from a narrated poster

A voiced explainer has **one thesis** — a single plain sentence the whole subject reduces to —
and its centerpiece *demonstrates* that thesis instead of illustrating it.

In the example, the thesis was: *Voice Control doesn't guess what you mean; it gives everything
on screen a name and waits for you to say it.* The centerpiece was a phone mock whose overlay
you switch between names, numbers and grid — and the switches were themselves spoken commands,
so the page performed the idea it was explaining.

If you cannot write the thesis as one plain sentence, you do not yet understand the subject
well enough to explain it. Go research until you can. A page built without one becomes a tidy
grid of facts that teaches nobody anything, and it will look finished, which is the trap.

## Steps

1. **Pin the subject and write the thesis.** One sentence, plain words. Everything else on the
   page either supports it or goes.

2. **Verify the facts against primary sources.** An infographic states things flatly — there is
   no room to hedge — so flat and wrong is the worst outcome available. Check vendor docs, not
   memory. Leave out anything you could not confirm, and say so when you deliver.

3. **Choose the centerpiece.** The one interactive element that makes the thesis happen in front
   of the reader. Draw it from the subject's own materials — its real instruments, units,
   overlays, document conventions — not from a chart library.

4. **Write the narration for the ear.** Six-ish sections, 15–35 seconds each. Short sentences,
   commas and periods only. Then list every phrase worth hearing on its own. Both go into
   `clips.json` as `[["clip-id", "spoken text"], ...]` — and the spoken text is not the
   displayed text: the page shows `Tap 14`, `clips.json` holds `Tap fourteen.`
   See `references/mechanics.md` for that table and the voice list.

5. **Render the audio now, before you build the page.** Build in a scratch directory — the
   session scratchpad, or a temp dir — never inside the user's repo: this produces a page and a
   megabyte of audio, and none of it belongs in their working tree unless they ask for it there.

   ```
   <skill-dir>/scripts/voice.sh clips.json <build-dir>/a
   ```

   `<skill-dir>` is this skill's base directory, given to you when the skill loads; the audio
   must land in `a/` because that is the path the page references.
   Start it in the background and build while it runs — it loads the model once and generates
   about five times faster than real time, so a two-minute narration is done before the page is.
   It prints a duration table and fails loudly on any clip that came out silent.

6. **Design and build the page.** Load `artifact-design` first and follow it. Derive the palette
   and the typefaces from *this* subject's own world. The audio wiring, the theme-token
   structure and the say-this chip are in the example and are yours to reuse — see
   "The page's audio contract" in `references/mechanics.md`.

7. **Verify.** Run the grep in `references/mechanics.md`: every `data-clip` in the page has an
   audio file, every audio file is referenced. Take one look at the rendered page, fix what it
   shows, and stop.

8. **Deliver.** Publish as an artifact when the user wants a link — audio goes in the `files`
   map, MP3 only. Otherwise hand over the folder. Tell them what you left out and why.

## The one that will cost you the page

At step 6 you will have the example open, working, good-looking, and you will think:

> *"The structure is already right — I'll adapt this one rather than start from nothing. Reusing
> what works is the whole point of having an example."*

Refuse it, and notice what is true in it, because that is why it wins. Reuse **is** right for
the skeleton: the audio contract, the token structure, the chip component, the check. Reuse is
fatal for the **identity** — the warm greys and mic-indicator orange belong to macOS, Bricolage
Grotesque and Newsreader belong to that page's register, the phone mock belongs to a subject
about phone screens. Carried onto a page about supply chains or enzyme kinetics, they are
someone else's clothes, and every explainer you make from then on is the same page with
different words in it.

So: skeleton yes, skin never. Ask what this subject's own instruments look like and build the
palette and the faces from those. If the answer is "I don't know what this subject looks like,"
that is step 2 telling you it isn't finished.

## Two failures that land after the work is done

**MP3, never M4A.** The publisher refuses `audio/mp4` and kills the entire publish at the end:

```
supporting file "a/x.m4a": contentType "audio/mp4" is not servable (nothing was published)
```

`voice.sh` writes MP3 already. The trap is re-encoding by hand at the last minute, because AAC
is the better codec and the error arrives an hour after the decision that caused it.

**The audio ships with the page.** Not synthesized in the browser, not fetched from a CDN — the
artifact CSP blocks every external media request and reports nothing — and not inlined as
`data:` URIs, which cost a third more bytes against the page's own size cap.

## Done means

- The grep in step 7 comes back clean, both directions.
- `voice.sh` exited zero, so no clip is silent.
- The page states a duration or a claim about itself that matches what actually rendered.
- Every fact on the page traces to a source you checked, and anything you could not confirm is
  either off the page or flagged to the user.

Short of all four, it is not finished — a voiced explainer whose audio half-loads looks exactly
like one that works until someone presses play.

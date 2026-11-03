---
name: capability-backlog
description: Break a request, feature list, or founding document into a backlog the capability-first way — a story map whose backbone is the activities of whatever will use the software and whose depth is leverage, with each feature as the set of stories it needs and tickets cut from those stories. Governs how work is framed, mapped, sliced, ordered (walking skeleton, highest-leverage story first, concrete implementations before abstraction) and how a ticket is written and confirmed. Use when the user says "break this down", "turn this into tickets", "plan the backlog for this", "map this feature", "story map this", "cut this into tickets", "how should we slice this", or hands over a request or design and wants the work laid out — and whenever you are about to write more than one ticket from a single request. Pairs with fill-backlog (inventing work) and groom-backlog (ordering what exists); this one is for deriving the work from a request.
---

# Capability-First Backlog Breakdown

Load this before you cut tickets from a request. The output of applying it is, in
order: the frame (four lines), the map (backbone, depth, the stories each feature needs), the slices with the
walking skeleton first, and then tickets in the project's tracker (`lit` where the
repo uses it), each one a story, carrying the conversation recorded below.
The request's feature list is the input, never the backlog.

## Premise

This is Jeff Patton's story-mapping method seen from a different angle. It is not in opposition to the standard guidance; it is a different belief about how value reaches the user. We care what the user needs. We do not believe that focusing on the user's needs is the best way to deliver on them, the same way greatness is not reached by seeking greatness. Capability delivered simply is what serves the user, so capability is what we build toward.

Patton rations scarce builder-hours against uncertain user value. Builder-hours are no longer scarce, so the rules that ration them fall away and the rules that keep the whole visible and coherent stay.

- **Kept from Patton:** tickets are prompts for a conversation, not specs. See the whole before detailing any part. Map the big picture, explore, slice, and build a walking skeleton before deepening.
- **Reframed:** outcomes-over-output becomes capability-over-features. MVP becomes the hump: slices are welcome, but the hump is where we start, not where we stop. YAGNI becomes inverse YAGNI, held in check by one law.
- **The one law:** every ticket should move the system toward simpler, where simpler means fewer concepts, fewer special cases, and more pieces of the same shape. Simpler does not mean fewer features. Scope is reorganized, not removed, and dates are not the agent's concern; shipping the right software is.
- **Inverse YAGNI:** if a capability is adjacent to what we are building, we build it, asked for or not. Building is not the slow part. Shipping half-built things and supporting the mistakes for a decade is the slow part.

## Tickets are understanding

A ticket is not a specification. Shared documents are not shared understanding; only working through the thing together, usually while drawing, produces it.

- Before building from a ticket, the agent restates it: what capability it adds, what it depends on, what will depend on it, and what the hardest part is. If the restatement does not match the author's picture, the conversation is not done.
- A flat backlog hides structure. Fifty tickets in a column cannot show what composes with what or whether the top twenty add up to a capability. Tickets live on the map; the list is a view of the map, never the source.

## The capability map

Patton's map keeps its shape. The backbone still runs left to right as the activity something performs, in narrative order. What changes is who performs it and what hangs beneath it.

**Activities (the backbone):** the activities, in the order they happen, of whatever will use the software: a person, a system, an agent, or a user we imagine and may never meet. Something will be able to use this; that something's story is the backbone. Read left to right it should narrate: "first it does this, then this, then this." If it cannot be narrated, the backbone is wrong. Example for a messaging system: *open inbox → read message → compose → attach → send*.

**Depth:** under each activity, the ways it could be built, ordered by leverage. At the top are the things that, once built, let us replace, upgrade or absorb other things cheaply, including themselves. At the bottom are the things that, once built, make other things expensive and awkward to replace. Under *attach*: a first-class attachment relation any record can carry sits at the top; a single attachment field bolted to one record type sits at the bottom. We build from the top and avoid the bottom. Cost-to-replace-this-and-what-surrounds-it is one of the most important things we measure by.

**Features** are sets of stories: which depth of which activities they compose. "Multiple attachments with inline previews" is *attach* at the relation depth plus *read message* at the render-any-type depth. If a feature cannot be written as a set of stories, an activity is missing.

| Patton | Here |
| --- | --- |
| Backbone = user activities in narrative order | Backbone = activities of whatever will use it, in narrative order |
| Depth = priority (essential at top, nice-to-have below) | Depth = leverage (cheapens replacing other things at top, hardens them below) |
| Stories hang under tasks | A feature is the set of stories it needs; a ticket is one story |
| Test: can you narrate the top row? | Same test, plus: does every activity have a deepest story that other activities can depend on? |

## Building the map: breadth first

Sketch the whole map at low fidelity before detailing any activity. Patton's Mona Lisa rule survives intact: a finished left eye on a blank canvas tells you nothing about the shape of the thing.

1. **Frame it.** One line each: who or what will use this, what it should be able to do afterward, what it must compose with that already exists, and where the leverage is. This stays at the top and is what every ticket is checked against.
2. **Lay the backbone.** Every activity the user of the software performs, one or two words each, in the order they happen. Tell the story aloud. Fast, rough, complete across before deep anywhere.
3. **Explore.** Under each activity, write every way it could be built, from the quick field bolted on to the general relation everything could share. Include the levels nobody asked for; this is where inverse YAGNI lives, and the map should be wider and taller than the request.
4. **Order by leverage.** For each activity, sort the options: at the top, the thing that once built makes other things cheap to replace, upgrade or absorb; at the bottom, the thing that once built makes them expensive. Mark the depth you intend to build. It is usually near the top.
5. **Name each feature's stories.** Write each feature in the request as the set of stories it needs, across activities. A feature that needs a story the map lacks adds the story.
6. **Slice and order the work** (next sections), then cut tickets from those stories.

## Fundamentals, not scenarios

Patton's output/outcome/impact ladder becomes feature/capability/composability.

- **Feature** is what a request names. It is the least important layer and is never the unit of work.
- **Capability** is a primitive that works at a given level of generality. It is the unit of work: every ticket builds or deepens one story of the map.
- **Composability** is how many features a capability can serve. It is the measure of success: a capability used by one feature is a special case with a name; a capability used by many is a fundamental.

The rule that follows: over-build the primitives, compose the features. Effort goes into the activities, past the depth any current request needs. Features are then assembled from stories that already exist, which is cheap and stays cheap. Software is a small set of fundamentals rearranged; building the fundamentals to excess is what makes the rearranging free.

This is also why a request's feature list is never the backlog. The backlog is the set of stories the features need, and most of those stories serve features not yet asked for.

## The hump

Patton's MVP (the smallest release that achieves an outcome) becomes the hump: the smallest state of a capability from which the next capability can be built without working around it.

Every capability moves through three states as it is engineered. Simple and weak: it does one thing, narrowly. Complex and capable: it does everything required, with branches, flags and exceptions. Simple and capable: it does everything required through a few aligned pieces. The middle state is the summit of the hump. It is where the demo works, and so it is where things tend to get shipped, and anything shipped becomes load-bearing.

- Slices are good. Each increment should be thin, testable, and ideally usable by someone real; agents in particular need increments that can be checked. Cut as many slices at the hump as the work needs.
- The summit is a waypoint, not a stop. "It works" is the halfway mark. A capability released from the summit carries its special cases into every feature that uses it, and by the time anyone circles back, replacing it costs more than never having built it. Keep going until the story is something the next activity can depend on.
- Overengineering is rare. What gets called overengineered is almost always complex and capable: a capability that stopped at the summit. The remedy is more engineering, not less scope.
- The one genuine overengineering failure is generality nothing ever uses, invented rather than extracted. The ordering rules in the next section guard against it.
- Sometimes we must lose some capability to achieve simplification. Most often, once we have achieved the simplification, radical new capabilities become feasible that make up for this many times over. Identifying and polishing away the capabilities that are holding back simplification is a critical task that must be sought out eagerly and continuously.

## Slicing and ordering the work

Patton slices horizontally and builds opening game, mid game, end game. Both survive. What changes is what gets built first and how thick the first pass is.

**Slice horizontally.** Draw lines across the map. Each slice is a thin version of the whole backbone, usable end to end, testable by someone real. The first slice is the walking skeleton: every activity at a working depth, so the backbone can be narrated before any activity goes deep. Slices make agent work checkable; cut as many as help.

**Within a slice, highest leverage first.** The story to build first is the one that, once in place, makes the most other stories cheap to build, replace, or absorb: the relation others traverse, the interface others call, the model others store into. Build it at full depth before anything that will depend on it exists. If it falls short, the system still has its fundamentals in the right shape; if the low-leverage parts land first, they harden the wrong shape under everything that follows.

**Concrete implementations before abstraction.** Within an activity, the deepest story is not built by designing the general case and deriving the specific ones. Build the specific cases as separate working things, then extract the abstraction from what they share. An abstraction is extracted from concrete implementations that exist, not invented. This is what separates inverse YAGNI from speculative frameworks, and it is why the map is built wider than the request: more concrete implementations make the real shape visible.

**Opening, mid, end game.**

1. *Opening game:* the walking skeleton, with the highest-leverage stories built to full depth and everything else at its working minimum. Risk and shape are settled here.
2. *Mid game:* the remaining stories the requested features need, raised past the hump, activity by activity, highest leverage first; concrete implementations built, the abstraction extracted.
3. *End game:* features nobody asked for, assembled from stories that already exist, and the polish that makes the whole thing feel like one piece. This is cheap only because the opening and mid game were not.

## Writing a ticket

Card, conversation, confirmation. The size and shape of a ticket is a judgment call; what follows is what a good one tends to carry.

**Card.** A line naming the story: which activity, and which depth of it. `Attach: attachments as a first-class relation on any record type.` The user can appear when it clarifies, but the thing a ticket serves is usually the next story that will depend on it.

**Conversation.** Worked through before building, and recorded in the ticket:

- Which stories this depends on, and whether they are over the hump.
- Which features use this story today, and which the map shows could.
- Where the leverage is: what shape other stories will conform to.
- Which concrete implementations come first, and what abstraction is expected to be extracted from them.
- How the slice it belongs to will be tested, ideally by someone using it.

**Confirmation.** Signs the ticket has reached a good place:

- The concrete implementations work and are expressed through the extracted abstraction, with none left as its own special case.
- A feature not in the original request could use the story without change.
- The story added no new concept a dependent activity must learn; if it did, that concept is named and becomes the next card.
- The next story can be built against this one with nothing to work around.

The subtraction pass that makes the last two true is its own discipline, written up separately.

## The whole thing in six sentences

1. Tickets exist to cause conversations; the map is the shared understanding, and the backlog is only a view of it.
2. The backbone is the story of whatever will use the software, in the order it happens; under each activity hang the ways to build it, ordered by how cheaply building them lets other things be replaced.
3. Sketch the whole map wider and deeper than the request before detailing any activity; build what is adjacent, and move scope around the map rather than off it.
4. Slice horizontally into thin, testable increments and walk the skeleton first; within a slice, build the highest-leverage story to full depth before anything that will depend on it.
5. Within an activity, build concrete implementations, then extract the abstraction from them; an abstraction is extracted, not invented.
6. The summit of the hump is where things work and where they tend to get shipped; keep going until the story is something the next one can depend on.

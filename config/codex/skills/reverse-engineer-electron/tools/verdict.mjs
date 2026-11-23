//
// verdict.mjs — the verdict a report gives on a source it reads in parts (an app's node_modules, its
// package-lock.json): absent, listed when every part was read, or incomplete with the reason, so no consumer can take
// a source that couldn't be read for one with nothing in it.

// [LAW:one-source-of-truth] The verdict on a source that is there: listed when every part was read, else incomplete
// with the reason the unread parts give.
export const verdictOn = (unread, reasonOf) => (unread.length === 0 ? { kind: "listed" } : { kind: "incomplete", reason: reasonOf(unread) });

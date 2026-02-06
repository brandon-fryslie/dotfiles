---
name: "do-competitive-audit"
description: "Compare project against competitors and alternatives. Analyze feature parity, differentiation, gaps, and market positioning. Requires external research."
---

# Competitive Audit

Systematic comparison of this project against competitors and alternatives in the market.

## When to Use

- `/do:plan audit competitive` - Direct invocation
- Before major feature planning (what should we build?)
- When positioning the product
- To identify gaps and opportunities
- To validate differentiation claims

## What This Audit Does

1. **Identify competitors** - Direct competitors, alternatives, adjacent solutions
2. **Analyze their approach** - Features, architecture, UX, pricing
3. **Compare systematically** - Feature-by-feature, capability-by-capability
4. **Find gaps** - What do they have that we don't?
5. **Find opportunities** - What could we do better? What's missing in market?
6. **Assess differentiation** - Is our differentiation real and valuable?

## Process

### Step 1: Understand Our Project

Before comparing, document what WE do:
- Core features
- Target users
- Key differentiators (claimed)
- Technical approach

### Step 2: Identify Competitors

**Sources**:
- User-provided list
- Web search: "[product type] alternatives"
- GitHub: similar projects
- Product Hunt, G2, Capterra for commercial products

**Categorize**:
| Category | Description |
|----------|-------------|
| Direct | Same problem, same audience |
| Indirect | Same problem, different approach |
| Adjacent | Related problem, overlapping audience |
| Emerging | New entrants, early stage |

### Step 3: Research Each Competitor

Use `do:researcher` with WebSearch for each:

| Aspect | What to Find |
|--------|--------------|
| Features | What does it do? Feature list |
| Approach | How does it work? Architecture if OSS |
| Users | Who uses it? What scale? |
| Strengths | What do users praise? |
| Weaknesses | What do users complain about? |
| Pricing | Free? Paid? Model? |
| Momentum | Growing? Stagnant? Declining? |

### Step 4: Feature Comparison Matrix

```markdown
| Feature | Us | Competitor A | Competitor B | Competitor C |
|---------|-----|--------------|--------------|--------------|
| [Feature 1] | ✅ Full | ✅ Full | ⚠️ Partial | ❌ None |
| [Feature 2] | ⚠️ Partial | ✅ Full | ✅ Full | ✅ Full |
| [Feature 3] | ❌ None | ❌ None | ✅ Full | ❌ None |
```

### Step 5: Gap Analysis

**They have, we don't**:
| Gap | Competitor(s) | Impact | Should We? |
|-----|---------------|--------|------------|
| [Feature] | A, B | High/Med/Low | Yes/No/Maybe |

**We have, they don't**:
| Differentiator | Value | Defensible? |
|----------------|-------|-------------|
| [Feature] | [Why it matters] | Yes/No |

### Step 6: Opportunity Analysis

| Opportunity | Description | Effort | Impact |
|-------------|-------------|--------|--------|
| [Gap to fill] | [What and why] | H/M/L | H/M/L |
| [Improvement] | [What and why] | H/M/L | H/M/L |

## Intensity Levels

| Level | Competitors Analyzed | Depth |
|-------|---------------------|-------|
| Quick | 2-3 direct | Feature list only |
| Medium | 4-6 mixed | Features + approach |
| Thorough | 8+ comprehensive | Full analysis + user research |

## Output Format

```markdown
# Competitive Audit - <project> - <date>

## Our Position
[Brief description of what we do and for whom]

## Competitive Landscape

### Direct Competitors
| Competitor | Summary | Threat Level |
|------------|---------|--------------|
| [Name] | [1-line] | High/Med/Low |

### Indirect/Adjacent
| Alternative | Summary | Relevance |
|-------------|---------|-----------|

## Feature Comparison Matrix
[Matrix table]

## Gap Analysis

### Critical Gaps (they all have, we don't)
- [Gap]: [Impact and recommendation]

### Opportunities (we could lead)
- [Opportunity]: [Why and how]

### Differentiators (our advantages)
- [Differentiator]: [Defensibility]

## Strategic Recommendations
1. [Highest priority action]
2. [Next priority]
3. ...

## Appendix: Competitor Profiles
### [Competitor A]
[Detailed profile]
```

## Notes

- This audit requires **external research** (WebSearch, WebFetch)
- For OSS competitors, can also examine their code
- Update periodically - competitive landscape changes
- Focus on what users care about, not feature count

## See Also

- `do:market-research` skill for broader market analysis
- `do:feature-proposal` for acting on identified opportunities

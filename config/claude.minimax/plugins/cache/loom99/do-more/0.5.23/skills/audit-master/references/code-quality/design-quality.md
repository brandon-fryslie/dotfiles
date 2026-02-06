# Design Quality Assessment Checklist

## Intentional vs Ad-hoc Design

**Signs of intentional design:**
- Consistent naming conventions throughout
- Similar problems solved similarly
- Design decisions documented (comments, ADRs, README)
- Clear abstractions with defined responsibilities

**Signs of ad-hoc design:**
- Multiple naming conventions (`getUserData`, `fetchUser`, `loadUserInfo`)
- Same problem solved differently in different places
- No explanation of why things are structured as they are
- Abstractions that leak or don't abstract

## Design Pattern Analysis

### Pattern Identification

**Common patterns to look for:**

| Pattern | Indicators | Appropriate When |
|---------|------------|------------------|
| Singleton | `getInstance()`, module-level instance | Shared state needed (config, logger) |
| Factory | `createX()`, `buildX()` | Object creation varies by context |
| Observer | `subscribe()`, `emit()`, callbacks | Decoupled event handling |
| Repository | `findById()`, `save()`, `delete()` | Data access abstraction |
| Strategy | Interface + multiple implementations | Algorithm varies at runtime |
| Decorator | Wrapper that adds behavior | Extend without modifying |

### Pattern Necessity Assessment

For each pattern found, ask:

| Question | If Yes | If No |
|----------|--------|-------|
| Does this pattern solve a real problem here? | Appropriate | Over-engineering |
| Would removing it cause duplication? | Keep | Consider removing |
| Is it used consistently? | Good | Partially implemented (debt) |
| Do team members understand it? | Sustainable | Maintenance risk |

### Pattern Absence Assessment

**Places where patterns are often needed:**

| Situation | Pattern Often Helpful |
|-----------|----------------------|
| Multiple similar object types created | Factory |
| Complex object construction | Builder |
| Algorithm that varies | Strategy |
| State machine behavior | State pattern |
| Tree/composite structures | Composite |
| Undo/redo needed | Command |

**Warning signs of missing abstraction:**
- Switch statements on type (Strategy needed)
- Copy-paste with slight variations (Template method)
- `if instanceof` chains (Polymorphism)
- Deeply nested object access (Facade)

## Design Smell Checklist

### Code Smells (Function/Method Level)

| Smell | Detection | Priority |
|-------|-----------|----------|
| Long method | > 30 lines | P2 |
| Long parameter list | > 4 params | P2 |
| Feature envy | Method uses more of another class than its own | P2 |
| Data clumps | Same 3+ params passed together repeatedly | P3 |
| Primitive obsession | Using primitives instead of small objects | P3 |
| Flag arguments | Boolean param that changes behavior | P2 |

### Class Smells

| Smell | Detection | Priority |
|-------|-----------|----------|
| God class | > 500 lines, many responsibilities | P1 |
| Data class | Only getters/setters, no behavior | P3 |
| Refused bequest | Subclass doesn't use parent's methods | P2 |
| Inappropriate intimacy | Classes know too much about each other | P2 |
| Lazy class | Does almost nothing | P3 |
| Speculative generality | Unused flexibility "for the future" | P2 |

### Architecture Smells

| Smell | Detection | Priority |
|-------|-----------|----------|
| Shotgun surgery | One change requires many file edits | P1 |
| Divergent change | One file changed for many reasons | P1 |
| Parallel inheritance | Adding class A requires adding class B | P2 |
| Circular dependency | A depends on B depends on A | P1 |

## Grep Patterns for Smells

```bash
# God classes (large files)
find . -name "*.ts" -exec wc -l {} \; | sort -n | tail -20

# Feature envy (accessing other object's internals)
grep -rn "\.\w\+\.\w\+\.\w\+\.\w\+" --include="*.ts"  # deep chaining

# Data clumps (repeated parameter groups)
grep -rn "userId.*userName.*userEmail" --include="*.ts"

# Flag arguments
grep -rn "function.*boolean\)" --include="*.ts"
grep -rn "if.*===.*true\|if.*===.*false" --include="*.ts"

# Primitive obsession (string for IDs, numbers for currency)
grep -rn "userId: string\|amount: number" --include="*.ts"
```

## Rating Scale

| Rating | Meaning |
|--------|---------|
| Excellent | Intentional design, patterns appropriate, few smells |
| Good | Mostly intentional, minor issues |
| Adequate | Some design, some ad-hoc, manageable |
| Poor | Mostly ad-hoc, significant refactoring needed |
| Critical | No discernible design, high maintenance burden |

## Example Findings

**Good design finding:**
```
Design Quality: Good
Evidence:
- Consistent naming: all services use verbNoun (getUserProfile, createOrder)
- Repository pattern used consistently for data access
- Clear separation between business logic (services/) and data (repositories/)
Minor issues:
- P3: UserService.ts:145 has 45-line method, could be extracted
```

**Problem design finding:**
```
Design Quality: Poor
Evidence:
- Inconsistent naming: getUser, fetchUserData, loadUserInfo all exist
- No consistent patterns: some direct DB access, some through repositories
- God class: OrderManager.ts is 1,200 lines with 45 public methods
Smells found:
- P1: Shotgun surgery - adding a field requires changing 8 files
- P1: Circular dependency between Order and Payment modules
- P2: Feature envy in ReportGenerator accessing Order internals
Recommendation: Refactor before adding features
```

# Efficiency Analysis Checklist

## Dead Code Detection

### Types of Dead Code

| Type | How to Detect | Priority |
|------|---------------|----------|
| Unused exports | Exported but never imported | P2 |
| Unreachable branches | Code after return, always-false conditions | P3 |
| Commented-out code | `// old code` blocks | P3 |
| Unused variables | Declared but never read | P3 |
| Dead features | Complete features no longer used | P2 |
| Test-only code | Production code only exercised by tests | P1 |

### Detection Commands

```bash
# TypeScript/JavaScript unused exports
npx ts-prune  # or: npx unimported

# Python unused imports
pylint --disable=all --enable=W0611 **/*.py

# General unused variables (eslint/pylint will catch)
eslint . --rule 'no-unused-vars: error'

# Commented-out code (manual review needed)
grep -rn "^[[:space:]]*//" --include="*.ts" | grep -v "^.*:[0-9]*:[[:space:]]*//" | head -50

# Unreachable code after return
grep -B1 -A1 "return" **/*.ts | grep -A1 "return" | grep -v "return\|--\|^\s*$"
```

### Dead Feature Detection

Signs of dead features:
- Feature flag always false
- Route/endpoint defined but no UI links to it
- Database table with no recent writes
- Entire modules not imported anywhere

## Dead Dependency Detection

```bash
# Node.js
npx depcheck

# Python
pip-check  # or manually compare requirements.txt to imports

# Manual: grep for each dependency
for dep in $(cat package.json | jq -r '.dependencies | keys[]'); do
  count=$(grep -r "$dep" src/ --include="*.ts" | wc -l)
  if [ "$count" -eq 0 ]; then
    echo "UNUSED: $dep"
  fi
done
```

## Redundancy Detection

### Code Duplication

```bash
# JavaScript/TypeScript
npx jscpd src/

# Python
pylint --disable=all --enable=R0801 **/*.py

# General (cross-language)
# Look for similar function names
grep -rh "function \|def \|const.*=.*=>" src/ | sort | uniq -c | sort -rn | head -20
```

### Redundant Abstractions

| Sign | Example | Action |
|------|---------|--------|
| Wrapper that just calls through | `getUser() { return userService.getUser() }` | Remove wrapper |
| Interface with one implementation | `IUserService` with only `UserService` | Remove interface |
| Factory that always returns same type | `createLogger()` always returns `ConsoleLogger` | Just use class |
| Abstract class with one subclass | `BaseController` extended once | Merge classes |

## Performance Anti-Patterns

### Database/API

| Anti-Pattern | Detection | Fix |
|--------------|-----------|-----|
| N+1 queries | Loop with query inside | Batch query, joins |
| Missing indexes | Slow queries on filtered fields | Add indexes |
| Over-fetching | `SELECT *` or full object when only ID needed | Select specific fields |
| No pagination | Unbounded result sets | Add limit/offset |

```bash
# N+1 pattern (query in loop)
grep -B5 -A5 "for\|forEach\|map" **/*.ts | grep -A5 -B5 "query\|find\|fetch"
```

### Frontend

| Anti-Pattern | Detection | Fix |
|--------------|-----------|-----|
| Unnecessary re-renders | Missing memo, deps arrays wrong | Add memoization |
| Large bundle | Entire library imported | Tree-shake, code split |
| Blocking main thread | Long sync operations | Web workers, chunking |
| Memory leaks | Event listeners not cleaned up | Cleanup in useEffect/destructor |

```bash
# Large imports (importing entire lodash, etc)
grep -rn "import \* as\|from 'lodash'" --include="*.ts"

# Missing cleanup
grep -rn "addEventListener\|setInterval\|setTimeout" --include="*.ts" | grep -v "removeEventListener\|clearInterval\|clearTimeout"
```

### Resource Management

| Issue | Detection | Priority |
|-------|-----------|----------|
| Unclosed connections | Open without close/using | P1 |
| Unclosed file handles | Open without close | P1 |
| Uncleared timers | setInterval without clear | P2 |
| Memory accumulation | Arrays/maps that only grow | P2 |

## Premature Abstraction

### Signs of Over-Engineering

| Sign | Example | Better Alternative |
|------|---------|-------------------|
| Config for everything | 50 config options, 3 used | Hardcode the 47 unused |
| Plugin architecture for one plugin | Complex plugin system, one plugin | Just write the code |
| Dependency injection for simple scripts | DI framework in 200-line script | Direct instantiation |
| Generic when specific would do | `DataProcessor<T>` only ever used with `User` | `UserProcessor` |

### The Rule of Three

Before creating abstraction, ask:
- Have I written this same code 3+ times? (If not, don't abstract yet)
- Will removing duplication make code clearer? (If not, duplication is fine)
- Can I name the abstraction clearly? (If not, it's probably not a real concept)

## Efficiency Rating Scale

| Rating | Criteria |
|--------|----------|
| Lean | Minimal dead code, no redundancy, appropriate abstractions |
| Good | < 5% dead code, minor redundancy, slight over-engineering |
| Adequate | 5-15% dead code, some redundancy, manageable |
| Bloated | 15-30% dead code, significant redundancy |
| Critical | > 30% dead code, major redundancy, unmaintainable |

## Example Findings

**Good efficiency finding:**
```
Efficiency: Good
Dead code: 3 unused exports found (minor)
- src/utils/format.ts:45 formatLegacyDate - not imported anywhere
Dead deps: None
Redundancy: Minor
- Two similar validation functions could be merged
Performance: No issues found
```

**Problem efficiency finding:**
```
Efficiency: Bloated
Dead code (P2):
- Entire src/legacy/ directory (1,200 lines) not imported
- 23 unused exports across utils/
Dead deps (P2):
- moment.js in package.json but date-fns used everywhere
- lodash imported but only _.get used (use optional chaining)
Redundancy (P2):
- 3 different HTTP client wrappers
- Validation logic duplicated in 5 places
Performance (P1):
- N+1 in OrderService.getOrdersWithItems:34
- No pagination on /api/users endpoint
Recommendation: Cleanup before adding features to avoid compounding debt
```

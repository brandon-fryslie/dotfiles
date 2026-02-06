# Architecture Assessment Checklist

## Step 1: Identify the Architecture

**Look for explicit declarations:**
- README mentions "MVC", "layered", "microservices", etc.
- Architecture diagrams in docs
- Directory structure that implies architecture (src/models, src/views, src/controllers)

**If not explicit, infer from structure:**

| Directory Pattern | Likely Architecture |
|-------------------|---------------------|
| `models/`, `views/`, `controllers/` | MVC |
| `domain/`, `application/`, `infrastructure/` | Clean/Hexagonal |
| `services/`, `api/`, `db/` | Layered |
| Multiple independent directories with own package files | Microservices/Monorepo |
| `components/`, `pages/`, `hooks/` | Component-based (React-style) |
| Flat structure, few directories | Script/Simple app (may need no architecture) |

## Step 2: Verify Implementation Alignment

**For each architectural layer:**

| Check | Pass | Fail |
|-------|------|------|
| Does code in this layer only do what the layer is for? | Layer does one job | Layer does multiple jobs |
| Does this layer only depend on layers it should? | Correct dependency direction | Imports from wrong layer |
| Are layer boundaries clear? | Easy to identify what goes where | Ambiguous placement |

**Common violations to grep for:**

```bash
# MVC: View importing from Model directly (should go through Controller)
grep -r "import.*from.*model" src/views/

# Layered: Infrastructure in domain
grep -r "import.*db\|import.*http" src/domain/

# Component: Business logic in UI components
# Look for fetch/axios/database calls in component files
grep -r "fetch\|axios\|prisma\|mongoose" src/components/
```

## Step 3: Assess Appropriateness

**Is the architecture right for the problem?**

| Project Size | Appropriate | Over-engineered | Under-engineered |
|--------------|-------------|-----------------|------------------|
| < 500 lines | Flat/simple | Any layered architecture | n/a |
| 500-5000 lines | Simple layers, component-based | Clean architecture, DDD | Flat structure |
| 5000+ lines | Full architecture appropriate | Multiple competing patterns | No clear structure |

**Warning signs of over-engineering:**
- More abstraction layers than features
- Interfaces with single implementations
- Dependency injection for simple scripts
- Multiple package.json/requirements.txt when one would do

**Warning signs of under-engineering:**
- God files (>500 lines with mixed concerns)
- Circular dependencies
- No clear separation of concerns
- Everything imports everything

## Fractal Analysis Checklists

### Function Level

| Check | Evidence of Good Design | Evidence of Problems |
|-------|-------------------------|----------------------|
| Length | < 30 lines typical | > 50 lines, scrolling required |
| Parameters | <= 3 typical | > 5, or object with many optional fields |
| Return value | Single clear type | Multiple types, null/undefined mixed in |
| Side effects | None, or clearly documented | Hidden state changes, global mutations |
| Naming | Verb phrases, describes action | Vague (`handle`, `process`, `do`) |

**Smell grep patterns:**
```bash
# Long functions (adjust line count)
awk '/^(function|def|const.*=>|async)/{start=NR} /^}$/{if(NR-start>50)print FILENAME":"start}' **/*.{js,ts,py}

# Too many parameters
grep -E "function.*\(.*,.*,.*,.*,.*," **/*.{js,ts}
```

### Class/Module Level

| Check | Evidence of Good Design | Evidence of Problems |
|-------|-------------------------|----------------------|
| Cohesion | Methods work on same data | Methods operate on unrelated data |
| Size | < 300 lines typical | > 500 lines |
| Dependencies | Few, injected | Many, hardcoded |
| Public surface | Small, intentional API | Everything public |
| Name | Noun, single responsibility | "Manager", "Handler", "Utils" |

**Smell indicators:**
- `Utils` or `Helpers` classes (dumping ground)
- `Manager` or `Handler` (god object)
- Class that requires reading other classes to understand
- More than 10 public methods

### Package/Directory Level

| Check | Evidence of Good Design | Evidence of Problems |
|-------|-------------------------|----------------------|
| Cohesion | Files in directory work together | Random grouping |
| Dependencies | Clear, one-directional | Circular imports |
| Naming | Describes domain/feature | Technical (`utils/`, `misc/`) |
| Size | 5-20 files typical | 50+ files, or 1-2 files |

**Circular dependency detection:**
```bash
# For TypeScript/JavaScript with madge
npx madge --circular src/

# Manual: look for A imports B, B imports A patterns
```

### System Level

| Check | Evidence of Good Design | Evidence of Problems |
|-------|-------------------------|----------------------|
| Data flow | Clear path from input to output | Data bounces around unpredictably |
| Integration | Components connect at defined points | Everything talks to everything |
| Configuration | Centralized, environment-based | Scattered, hardcoded |
| Error handling | Consistent strategy | Each component different |

## Example Findings

**Good architecture finding:**
```
Architecture: Layered (services/controllers/models)
Alignment: GOOD - clear separation maintained
Evidence: Controllers only call services, services only call models
No violations found in dependency direction
```

**Problem architecture finding:**
```
Architecture: Stated as MVC in README
Alignment: POOR - violations found
Violations:
- views/UserDashboard.tsx:45 imports directly from models/User.ts
- controllers/auth.js:12 contains raw SQL (should be in model)
- models/Order.ts:78 makes HTTP calls (infrastructure in domain)
Priority: P1 - causes maintenance burden, fix before adding features
```

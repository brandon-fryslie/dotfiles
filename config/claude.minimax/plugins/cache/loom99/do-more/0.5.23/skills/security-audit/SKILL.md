---
name: "do-security-audit"
description: "Security vulnerability assessment. Check dependencies for CVEs, analyze auth/authz patterns, identify data exposure risks, OWASP top 10 review."
---

# Security Audit

Systematic security assessment of the codebase and dependencies.

## When to Use

- `/do:plan audit security` - Direct invocation
- Before deployment to production
- After adding auth/payment/sensitive data handling
- Periodic security review
- After dependency updates

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| Dependency CVEs | Penetration testing |
| Code-level vulnerabilities | Infrastructure security |
| Auth/authz patterns | Network security |
| Data exposure risks | Physical security |
| OWASP Top 10 | Compliance audits (HIPAA, SOC2) |
| Secret management | Social engineering |

## Process

### Step 1: Dependency Audit

**Check for known vulnerabilities:**

```bash
# Node.js
npm audit
# or
npx better-npm-audit audit

# Python
pip-audit
# or
safety check

# Go
govulncheck ./...

# Rust
cargo audit

# General (Snyk, if available)
snyk test
```

**Document findings:**
| Dependency | CVE | Severity | Fix Available? |
|------------|-----|----------|----------------|
| [pkg@version] | [CVE-XXXX-XXXXX] | Critical/High/Med/Low | Yes/No |

### Step 2: Secret Detection

**Scan for hardcoded secrets:**

```bash
# Using gitleaks
gitleaks detect --source . --verbose

# Using trufflehog
trufflehog filesystem .

# Manual patterns
grep -rn "password\s*=\|api_key\s*=\|secret\s*=\|token\s*=" --include="*.{js,ts,py,go,java}" .
grep -rn "-----BEGIN.*PRIVATE KEY" .
grep -rn "sk_live_\|pk_live_\|ghp_\|glpat-" .
```

**Check for:**
- API keys in code
- Passwords in config files
- Private keys committed
- .env files in repo
- Secrets in comments

### Step 3: Authentication Review

See `../audit-master/references/security/auth-checklist.md` for detailed checklist.

**Quick checks:**
| Check | Status |
|-------|--------|
| Password hashing (bcrypt/argon2/scrypt)? | ✅/❌ |
| Session management secure? | ✅/❌ |
| JWT implementation correct? | ✅/❌ |
| OAuth flow secure? | ✅/❌ |
| MFA available? | ✅/❌/N/A |
| Account lockout after failed attempts? | ✅/❌ |
| Secure password reset flow? | ✅/❌ |

### Step 4: Authorization Review

| Check | Status |
|-------|--------|
| Access controls enforced server-side? | ✅/❌ |
| IDOR vulnerabilities checked? | ✅/❌ |
| Role-based access consistent? | ✅/❌ |
| Privilege escalation paths reviewed? | ✅/❌ |

### Step 5: Data Exposure Review

**Sensitive data handling:**
| Data Type | Encrypted at Rest? | Encrypted in Transit? | Access Logged? |
|-----------|-------------------|----------------------|----------------|
| Passwords | [status] | [status] | [status] |
| PII | [status] | [status] | [status] |
| Financial | [status] | [status] | [status] |
| API keys | [status] | [status] | [status] |

**Data leakage vectors:**
- [ ] Error messages exposing internals
- [ ] Debug logging in production
- [ ] Verbose API responses
- [ ] Stack traces to users
- [ ] Database IDs exposed unnecessarily

### Step 6: OWASP Top 10 Review

See `../audit-master/references/security/owasp-checklist.md` for detailed checklist.

| # | Vulnerability | Status | Evidence |
|---|---------------|--------|----------|
| A01 | Broken Access Control | ✅/⚠️/❌ | [notes] |
| A02 | Cryptographic Failures | ✅/⚠️/❌ | [notes] |
| A03 | Injection | ✅/⚠️/❌ | [notes] |
| A04 | Insecure Design | ✅/⚠️/❌ | [notes] |
| A05 | Security Misconfiguration | ✅/⚠️/❌ | [notes] |
| A06 | Vulnerable Components | ✅/⚠️/❌ | [notes] |
| A07 | Auth Failures | ✅/⚠️/❌ | [notes] |
| A08 | Data Integrity Failures | ✅/⚠️/❌ | [notes] |
| A09 | Logging Failures | ✅/⚠️/❌ | [notes] |
| A10 | SSRF | ✅/⚠️/❌ | [notes] |

### Step 7: Input Validation Review

```bash
# Find user input handlers
grep -rn "req\.body\|req\.params\|req\.query" --include="*.ts" --include="*.js"
grep -rn "request\.form\|request\.args\|request\.json" --include="*.py"

# Check for validation
# Look for validation libraries, sanitization, type checking near input handling
```

| Input Point | Validation Present? | Sanitization? |
|-------------|--------------------| --------------|
| [endpoint/form] | ✅/❌ | ✅/❌ |

## Intensity Levels

| Level | Scope | Time |
|-------|-------|------|
| Quick | Dependency scan + secret scan | 5-10 min |
| Medium | + Auth review + OWASP quick check | 20-30 min |
| Thorough | Full OWASP + manual code review | 1-2 hours |

## Output Format

```markdown
# Security Audit - <project> - <date>

## Executive Summary
**Risk Level**: Critical / High / Medium / Low
**Immediate Actions Required**: [n]
**Total Findings**: [n]

## Dependency Vulnerabilities
| Severity | Count | Action Required |
|----------|-------|-----------------|
| Critical | [n] | Immediate |
| High | [n] | This sprint |
| Medium | [n] | Plan to fix |
| Low | [n] | Track |

### Critical/High Findings
[Details of each]

## Secret Exposure
- [ ] Hardcoded secrets found: [Yes/No]
- [ ] .env committed: [Yes/No]
- [ ] API keys in code: [Yes/No]

[Details if any found]

## Authentication & Authorization
[Summary of findings]

## OWASP Top 10 Status
[Matrix from Step 6]

## Data Handling
[Summary of sensitive data review]

## Prioritized Remediation
### P0 - Fix Immediately
1. [Finding + remediation steps]

### P1 - Fix This Sprint
1. [Finding + remediation steps]

### P2 - Plan to Address
1. [Finding + remediation steps]

## Recommendations
[Strategic security improvements]
```

## Severity Definitions

| Severity | Criteria |
|----------|----------|
| Critical | Active exploit available, data breach possible, no auth required |
| High | Exploitable with some effort, significant data/functionality at risk |
| Medium | Requires specific conditions, limited impact |
| Low | Theoretical, defense in depth, best practice |

## Tools Referenced

| Tool | Purpose | Install |
|------|---------|---------|
| npm audit | Node.js dependency scan | Built-in |
| pip-audit | Python dependency scan | `pip install pip-audit` |
| gitleaks | Secret detection | `brew install gitleaks` |
| trufflehog | Secret detection | `pip install trufflehog` |
| govulncheck | Go vulnerability scan | `go install golang.org/x/vuln/cmd/govulncheck@latest` |
| cargo audit | Rust dependency scan | `cargo install cargo-audit` |

## Notes

- This is not a replacement for professional security audit
- Focus on common, high-impact vulnerabilities
- When in doubt, flag for expert review
- Security is ongoing, not one-time

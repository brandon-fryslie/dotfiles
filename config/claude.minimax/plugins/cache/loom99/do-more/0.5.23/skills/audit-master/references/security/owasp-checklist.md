# OWASP Top 10 (2021) Checklist

## A01: Broken Access Control

**What it is**: Users acting outside intended permissions.

### Checks
| Vulnerability | How to Check | Status |
|---------------|--------------|--------|
| Bypassing access control by modifying URL | Try accessing admin URLs as regular user | |
| Modifying API requests to access other users' data | Change IDs in requests | |
| Privilege escalation | Test if regular user can access admin functions | |
| CORS misconfiguration | Check `Access-Control-Allow-Origin` headers | |
| Force browsing to authenticated pages | Access protected pages without auth | |

### Code Review
```bash
# Find authorization checks
grep -rn "isAdmin\|hasRole\|authorize\|permission" --include="*.{ts,js,py}"

# Find places where they might be missing
grep -rn "router\.\|app\.\|@Get\|@Post" --include="*.{ts,js,py}" | head -50
```

---

## A02: Cryptographic Failures

**What it is**: Failures related to cryptography leading to data exposure.

### Checks
| Vulnerability | How to Check | Status |
|---------------|--------------|--------|
| Sensitive data transmitted in clear text | Check for HTTP (not HTTPS) | |
| Old/weak cryptographic algorithms | Grep for MD5, SHA1, DES | |
| Default crypto keys | Search for default/example keys | |
| Missing encryption for sensitive data at rest | Check database storage | |
| Weak random number generation | Check random source | |

### Code Review
```bash
# Weak algorithms
grep -rn "md5\|sha1\|des\|rc4" --include="*.{ts,js,py,go}" -i

# Hardcoded keys (potential)
grep -rn "key.*=.*['\"][a-zA-Z0-9]" --include="*.{ts,js,py}" | grep -v "api_key\|key_name"

# Check TLS configuration
grep -rn "rejectUnauthorized.*false\|verify.*false\|CERT_NONE" --include="*.{ts,js,py}"
```

---

## A03: Injection

**What it is**: Untrusted data sent to interpreter as part of command/query.

### Checks
| Vulnerability | How to Check | Status |
|---------------|--------------|--------|
| SQL Injection | Check for parameterized queries | |
| NoSQL Injection | Check MongoDB query building | |
| Command Injection | Check exec/spawn usage | |
| LDAP Injection | Check LDAP query building | |
| XPath Injection | Check XML query building | |

### Code Review
```bash
# SQL string concatenation (dangerous)
grep -rn "SELECT.*+.*\|INSERT.*+.*\|UPDATE.*+.*\|DELETE.*+.*" --include="*.{ts,js,py}"
grep -rn "f\".*SELECT\|f'.*SELECT" --include="*.py"

# Command execution
grep -rn "exec\|spawn\|system\|popen\|subprocess" --include="*.{ts,js,py}"

# MongoDB injection vectors
grep -rn "\$where\|\$regex" --include="*.{ts,js}"
```

**Safe patterns:**
```javascript
// SQL - Parameterized
db.query('SELECT * FROM users WHERE id = $1', [userId]);

// MongoDB - Avoid $where
collection.find({ userId: userId }); // Safe
collection.find({ $where: userInput }); // Dangerous
```

---

## A04: Insecure Design

**What it is**: Missing or ineffective security controls in design.

### Checks
| Vulnerability | How to Check | Status |
|---------------|--------------|--------|
| Missing rate limiting | Check login, signup, API endpoints | |
| No bot protection | Check for CAPTCHA where needed | |
| Lack of input validation | Check all user inputs | |
| Missing business logic controls | Review critical workflows | |

### Design Review Questions
- Is there a threat model?
- Are trust boundaries defined?
- Are security requirements documented?
- Is there defense in depth?

---

## A05: Security Misconfiguration

**What it is**: Missing hardening, default configs, unnecessary features.

### Checks
| Vulnerability | How to Check | Status |
|---------------|--------------|--------|
| Default credentials | Check for admin/admin, etc. | |
| Unnecessary features enabled | Check debug mode, stack traces | |
| Error messages too detailed | Check error responses | |
| Security headers missing | Check HTTP headers | |
| Directory listing enabled | Try browsing directories | |

### Code Review
```bash
# Debug mode in production
grep -rn "debug.*true\|DEBUG.*True\|NODE_ENV.*development" --include="*.{ts,js,py,json}"

# Stack traces exposed
grep -rn "stack\|traceback" --include="*.{ts,js,py}" | grep -i "error\|catch\|except"

# Security headers check (should be present)
grep -rn "helmet\|X-Frame-Options\|Content-Security-Policy\|X-Content-Type" --include="*.{ts,js,py}"
```

---

## A06: Vulnerable and Outdated Components

**What it is**: Using components with known vulnerabilities.

### Checks
```bash
# Run appropriate scanner for your stack
npm audit                    # Node.js
pip-audit                    # Python
cargo audit                  # Rust
govulncheck ./...           # Go
bundle audit                 # Ruby
```

| Check | Status |
|-------|--------|
| Dependencies scanned | ✅/❌ |
| Critical CVEs: 0 | ✅/❌ |
| High CVEs remediated | ✅/❌ |
| Automated scanning in CI | ✅/❌ |

---

## A07: Identification and Authentication Failures

**What it is**: Weaknesses in identity and auth.

See `references/auth-checklist.md` for detailed checklist.

### Quick Checks
| Vulnerability | Status |
|---------------|--------|
| Permits weak passwords | |
| Uses plain text/weak hash | |
| Missing MFA | |
| Session ID in URL | |
| Session doesn't expire | |
| Session fixation possible | |

---

## A08: Software and Data Integrity Failures

**What it is**: Failures to protect against integrity violations.

### Checks
| Vulnerability | How to Check | Status |
|---------------|--------------|--------|
| Unsigned updates | Check update mechanism | |
| Insecure deserialization | Check deserialize calls | |
| Untrusted CI/CD pipeline | Review pipeline security | |
| Dependency confusion | Check package sources | |

### Code Review
```bash
# Deserialization (potential danger)
grep -rn "JSON\.parse\|pickle\.load\|yaml\.load\|unserialize\|deserialize" --include="*.{ts,js,py,php}"

# Unsafe yaml
grep -rn "yaml\.load\|yaml\.unsafe_load" --include="*.py"
```

---

## A09: Security Logging and Monitoring Failures

**What it is**: Insufficient logging to detect attacks.

### Checks
| Event | Logged? | Alerting? |
|-------|---------|-----------|
| Login failures | ✅/❌ | ✅/❌ |
| Access control failures | ✅/❌ | ✅/❌ |
| Input validation failures | ✅/❌ | ✅/❌ |
| High-value transactions | ✅/❌ | ✅/❌ |

### Code Review
```bash
# Check for logging
grep -rn "logger\|console\.log\|logging\|log\." --include="*.{ts,js,py}" | head -30

# Check for security event logging specifically
grep -rn "login.*fail\|auth.*fail\|unauthorized\|forbidden" --include="*.{ts,js,py}"
```

---

## A10: Server-Side Request Forgery (SSRF)

**What it is**: App fetches remote resource without validating user-supplied URL.

### Checks
| Vulnerability | How to Check | Status |
|---------------|--------------|--------|
| URL fetch without validation | Find fetch/request with user input | |
| Internal network access | Try localhost, 169.254.169.254 | |
| Protocol bypass | Try file://, gopher:// | |

### Code Review
```bash
# Find URL fetching
grep -rn "fetch\|axios\|requests\.get\|urllib\|http\.get" --include="*.{ts,js,py}"

# Check if URLs come from user input
# Look for req.body, req.params, user input flowing to fetch calls
```

**Safe pattern:**
```javascript
// Validate URL before fetching
const url = new URL(userInput);
if (!allowedHosts.includes(url.hostname)) {
  throw new Error('Invalid host');
}
```

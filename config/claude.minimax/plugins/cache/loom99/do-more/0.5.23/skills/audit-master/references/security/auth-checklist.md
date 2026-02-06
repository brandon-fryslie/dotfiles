# Authentication & Authorization Checklist

## Password Security

### Storage
| Check | Secure | Insecure |
|-------|--------|----------|
| Hashing algorithm | bcrypt, argon2, scrypt | MD5, SHA1, plain SHA256 |
| Salt | Unique per password, random | Shared salt, no salt |
| Work factor | Configurable, appropriate for hardware | Hardcoded, too low |

**Grep patterns:**
```bash
# Good
grep -rn "bcrypt\|argon2\|scrypt" --include="*.{ts,js,py,go}"

# Bad (if used for passwords)
grep -rn "md5\|sha1\|sha256" --include="*.{ts,js,py,go}" | grep -i "password"
```

### Password Requirements
| Check | Status |
|-------|--------|
| Minimum length enforced (8+ chars)? | ✅/❌ |
| Complexity requirements reasonable? | ✅/❌ |
| Password breach database checked? | ✅/❌ |
| No maximum length < 64 chars? | ✅/❌ |

## Session Management

### Session Security
| Check | Secure | Insecure |
|-------|--------|----------|
| Session ID generation | Cryptographically random | Predictable, sequential |
| Session storage | Server-side or signed | Plain cookies, localStorage |
| Session expiration | Absolute + idle timeout | Never expires |
| Session invalidation | On logout, password change | Sessions persist |

### Cookie Flags (if using cookies)
| Flag | Purpose | Status |
|------|---------|--------|
| `HttpOnly` | Prevent XSS access | ✅/❌ |
| `Secure` | HTTPS only | ✅/❌ |
| `SameSite` | CSRF protection | ✅/❌ |
| `Path` | Scope limitation | ✅/❌ |

**Check cookie configuration:**
```bash
grep -rn "cookie\|session" --include="*.{ts,js,py}" | grep -i "secure\|httponly\|samesite"
```

## JWT Security (if applicable)

| Check | Secure | Insecure |
|-------|--------|----------|
| Algorithm | RS256, ES256 | none, HS256 with weak secret |
| Secret | Long, random, env variable | Short, hardcoded |
| Expiration | Short-lived (15min-1hr) | Long-lived or no expiration |
| Refresh tokens | Secure rotation | Same token reused |
| Token storage | HttpOnly cookie or secure storage | localStorage |

**JWT anti-patterns to grep:**
```bash
# Algorithm none attack vulnerable
grep -rn "algorithm.*none\|alg.*none" --include="*.{ts,js,py}"

# Hardcoded secrets
grep -rn "jwt.*secret\|secretKey" --include="*.{ts,js,py}" | grep -v "process.env\|os.environ"
```

## OAuth/OIDC (if applicable)

| Check | Status |
|-------|--------|
| State parameter used (CSRF protection)? | ✅/❌ |
| PKCE implemented (for public clients)? | ✅/❌ |
| Redirect URI validated strictly? | ✅/❌ |
| Token stored securely? | ✅/❌ |
| Scopes minimal and appropriate? | ✅/❌ |

## Account Security

### Login Security
| Check | Status |
|-------|--------|
| Rate limiting on login attempts? | ✅/❌ |
| Account lockout after failures? | ✅/❌ |
| Login attempt logging? | ✅/❌ |
| CAPTCHA after repeated failures? | ✅/❌ |
| Timing-safe comparison for credentials? | ✅/❌ |

### Password Reset
| Check | Status |
|-------|--------|
| Token is random and unpredictable? | ✅/❌ |
| Token expires (15-60 min)? | ✅/❌ |
| Token single-use? | ✅/❌ |
| Old sessions invalidated on reset? | ✅/❌ |
| Rate limited? | ✅/❌ |
| No user enumeration? | ✅/❌ |

### MFA (if applicable)
| Check | Status |
|-------|--------|
| TOTP implementation correct? | ✅/❌ |
| Backup codes provided? | ✅/❌ |
| Recovery flow secure? | ✅/❌ |

## Authorization

### Access Control
| Check | Status |
|-------|--------|
| Authorization checked server-side? | ✅/❌ |
| Default deny (whitelist approach)? | ✅/❌ |
| Role checks at every sensitive operation? | ✅/❌ |
| Horizontal authz (IDOR) prevented? | ✅/❌ |
| Vertical authz (privilege escalation) prevented? | ✅/❌ |

### IDOR (Insecure Direct Object Reference)
```bash
# Find ID-based lookups
grep -rn "params\.id\|params\[.id.\]\|request\.args\.get\(.id" --include="*.{ts,js,py}"

# Check if authorization is verified
# Look for user/owner checks near these lookups
```

**Pattern to verify:**
```javascript
// Bad - no authorization check
const item = await Item.findById(req.params.id);

// Good - ownership verified
const item = await Item.findOne({
  _id: req.params.id,
  owner: req.user.id
});
```

## Common Vulnerabilities

### Username Enumeration
Does the application reveal whether an account exists?

| Scenario | Leaks Info? |
|----------|-------------|
| Login error message | "Invalid password" vs "Invalid credentials" |
| Registration | "Email already taken" |
| Password reset | "Email sent" (even if not found) |
| Timing differences | Fast reject vs slow hash comparison |

### Credential Stuffing Protection
| Check | Status |
|-------|--------|
| Rate limiting by IP? | ✅/❌ |
| Rate limiting by account? | ✅/❌ |
| Breach password detection? | ✅/❌ |
| Device fingerprinting? | ✅/❌ |
| Anomaly detection? | ✅/❌ |

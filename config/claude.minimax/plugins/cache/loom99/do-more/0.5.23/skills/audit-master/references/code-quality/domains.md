# Domain-Specific Analysis Checklist

## Domain Identification

First, identify the domain(s) present in the codebase:

| Indicators | Domain |
|------------|--------|
| AudioContext, AudioBuffer, gain, sample rate | Audio/Sound |
| MediaSource, video element, codec, frame | Video/Media |
| encrypt, decrypt, hash, key, IV, signature | Cryptography |
| currency, decimal, price, payment, transaction | Financial |
| Thread, Lock, Mutex, async, concurrent, parallel | Concurrency |
| Socket, HTTP, request, connection, timeout | Networking |
| Canvas, WebGL, render, draw, animation | Graphics |
| Query, database, ORM, migration, transaction | Data/Persistence |

## Audio/Video Processing

### Common Issues

| Issue | Detection | Impact | Fix |
|-------|-----------|--------|-----|
| Buffer underrun | Small buffer sizes, no buffering strategy | Crackles, pops, stuttering | Implement ring buffer, increase buffer |
| Sample rate mismatch | Mixing different sample rates without conversion | Pitch/speed issues | Resample to common rate |
| Blocking audio thread | Heavy computation in audio callback | Dropouts | Move work to separate thread |
| Memory leaks | AudioBuffers not released | Growing memory | Explicitly disconnect and null |
| Timing drift | Using setTimeout for audio timing | Desync | Use AudioContext.currentTime |

### Checklist

```markdown
- [ ] Buffer size appropriate for latency requirements?
- [ ] Ring buffer or double-buffering implemented?
- [ ] Audio processing on dedicated thread/worklet?
- [ ] Sample rate handled consistently?
- [ ] Resources cleaned up on stop/destroy?
- [ ] Graceful handling of device changes?
- [ ] Volume/gain changes smoothed (no clicks)?
```

### Anti-Patterns to Grep

```bash
# setTimeout for audio timing (should use AudioContext timing)
grep -rn "setTimeout.*audio\|setInterval.*play" --include="*.ts"

# Blocking operations in audio callback
grep -rn "audioWorklet\|ScriptProcessor" -A20 | grep "fetch\|async\|await"

# Missing cleanup
grep -rn "createBuffer\|createGain" | grep -v "disconnect\|close"
```

## Financial/Currency

### Common Issues

| Issue | Detection | Impact | Fix |
|-------|-----------|--------|-----|
| Float for currency | `price: number` | Rounding errors | Use integer cents or Decimal |
| Rounding errors | Math operations on currency | Money disappears/appears | Use banker's rounding |
| Currency mixing | USD + EUR without conversion | Wrong totals | Explicit currency types |
| Precision loss | Dividing before multiplying | Lost cents | Multiply first |
| Tax calculation order | Inconsistent tax application | Legal/audit issues | Define clear order |

### Checklist

```markdown
- [ ] Currency stored as integer (cents) or Decimal type?
- [ ] Currency code stored with amounts?
- [ ] Rounding strategy documented and consistent?
- [ ] Division operations checked for precision?
- [ ] Audit trail for financial changes?
- [ ] Currency display localized correctly?
```

### Anti-Patterns to Grep

```bash
# Float for money
grep -rn "price: number\|amount: number\|total: number" --include="*.ts"

# Currency arithmetic without Decimal
grep -rn "price \* \|amount \+ \|total / " --include="*.ts"
```

## Cryptography

### Common Issues

| Issue | Detection | Impact | Fix |
|-------|-----------|--------|-----|
| Weak algorithms | MD5, SHA1 for security, DES | Vulnerable | Use SHA-256+, AES-256 |
| IV reuse | Static or reused initialization vector | Breaks encryption | Random IV per encryption |
| Key in code | Hardcoded keys/secrets | Compromised | Environment variables, KMS |
| Timing attacks | Non-constant-time comparison | Key leakage | Use constant-time compare |
| Missing salt | Hashing passwords without salt | Rainbow tables | Use bcrypt/argon2 |
| Own crypto | Custom encryption algorithms | Unknown vulnerabilities | Use standard libraries |

### Checklist

```markdown
- [ ] Using standard crypto libraries (not custom)?
- [ ] Keys stored securely (not in code)?
- [ ] IVs/nonces never reused?
- [ ] Password hashing uses bcrypt/argon2/scrypt?
- [ ] Sensitive comparisons use constant-time functions?
- [ ] Secure random number generator used?
```

### Anti-Patterns to Grep

```bash
# Weak algorithms
grep -rn "md5\|sha1\|des\|rc4" --include="*.ts" -i

# Hardcoded keys
grep -rn "key.*=.*['\"]" --include="*.ts" | grep -i "secret\|private\|api"

# IV reuse
grep -rn "iv.*=\|nonce.*=" --include="*.ts" | grep -v "random\|generate"
```

## Concurrency

### Common Issues

| Issue | Detection | Impact | Fix |
|-------|-----------|--------|-----|
| Race conditions | Shared mutable state without locks | Data corruption | Locks, immutability, channels |
| Deadlocks | Multiple locks acquired in different orders | Hangs | Lock ordering, timeout |
| Missing synchronization | Check-then-act patterns | Lost updates | Atomic operations |
| Thread pool exhaustion | Unbounded task creation | OOM, hangs | Bounded queues |
| Async/await mistakes | Fire-and-forget, missing await | Silent failures | Always handle promises |

### Checklist

```markdown
- [ ] Shared mutable state identified and protected?
- [ ] Lock acquisition order consistent?
- [ ] Deadlock prevention strategy (timeout, ordering)?
- [ ] Thread/worker pools bounded?
- [ ] All async operations awaited or explicitly fire-and-forget?
- [ ] Error handling in async code?
```

### Anti-Patterns to Grep

```bash
# Fire-and-forget async (missing await)
grep -rn "async.*{" -A10 | grep -B5 "someAsyncFunc()" | grep -v "await\|return"

# Check-then-act without atomicity
grep -rn "if.*exists\|if.*has" -A3 | grep "set\|push\|write"
```

## Networking

### Common Issues

| Issue | Detection | Impact | Fix |
|-------|-----------|--------|-----|
| No timeout | Missing timeout on requests | Hangs | Always set timeout |
| No retry | Single attempt on failure | Poor reliability | Exponential backoff |
| Connection leaks | Open without close | Resource exhaustion | Connection pooling, cleanup |
| Missing error handling | No catch on network calls | Silent failures | Handle all error cases |
| Blocking on network | Sync network calls | UI freeze | Async with proper loading states |

### Checklist

```markdown
- [ ] All network calls have timeouts?
- [ ] Retry strategy with backoff for transient failures?
- [ ] Connection pooling configured?
- [ ] Connections cleaned up on error/close?
- [ ] Error states handled and communicated to user?
- [ ] Loading states during network operations?
```

### Anti-Patterns to Grep

```bash
# Missing timeout
grep -rn "fetch\|axios\|http" --include="*.ts" | grep -v "timeout"

# Missing error handling
grep -rn "\.then(" --include="*.ts" | grep -v "\.catch\|try"
```

## Using the Researcher for Unknown Domains

When a domain is identified but not covered here:

1. Invoke `do:researcher` with query: "[domain] common mistakes anti-patterns"
2. Search for "[domain] best practices [year]"
3. Look for official documentation gotchas/FAQ
4. Check for domain-specific linters/analyzers

Document findings for future audits.

## Example Findings

**Audio domain finding:**
```
Domain: Audio Processing
Issues Found:
- P1: Buffer size (256 samples) too small for reliable playback
  - Evidence: AudioContext.createScriptProcessor(256, ...) at audio.ts:34
  - Fix: Increase to 2048+ or use AudioWorklet with ring buffer

- P2: No handling of audio device changes
  - Evidence: No devicechange event listener
  - Fix: Listen for devicechange, reinitialize audio context

- P3: setTimeout used for scheduling
  - Evidence: setTimeout(playNextChunk, ...) at player.ts:89
  - Fix: Use AudioContext.currentTime for sample-accurate timing

Recommendations:
1. Read Web Audio API best practices documentation
2. Implement proper buffering strategy before adding features
3. Test on slower devices to catch timing issues
```

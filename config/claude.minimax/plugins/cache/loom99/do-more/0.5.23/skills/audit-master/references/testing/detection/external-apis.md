# Detecting External API Integrations

How to identify all external service dependencies and HTTP/network interactions for testing audit.

## Categories of External Integrations

| Category | Examples | Testing Concern |
|----------|----------|-----------------|
| REST APIs | Payment gateways, SaaS APIs | Response handling, errors, timeouts |
| GraphQL | Shopify, GitHub API | Query validation, pagination |
| Webhooks | Stripe, GitHub events | Signature verification, idempotency |
| OAuth/SSO | Google, Auth0 | Token flow, refresh, revocation |
| Email/SMS | SendGrid, Twilio | Delivery, templates, rate limits |
| Analytics | Segment, Mixpanel | Event tracking, batching |
| Cloud services | AWS, GCP, Azure | Permissions, regions, costs |

## HTTP Client Detection

### By Language

```bash
# Python
grep -rn "requests\.\|httpx\|aiohttp\|urllib" --include="*.py" | grep -v test

# JavaScript/TypeScript
grep -rn "fetch\|axios\|got\|node-fetch\|superagent" --include="*.{ts,js}" | grep -v test

# Go
grep -rn "http\.Get\|http\.Post\|http\.NewRequest\|http\.Client" --include="*.go"

# Java
grep -rn "HttpClient\|RestTemplate\|WebClient\|OkHttp" --include="*.java"

# Ruby
grep -rn "HTTParty\|Faraday\|Net::HTTP\|RestClient" --include="*.rb"
```

### URL Patterns

```bash
# Find hardcoded external URLs
grep -rnoE "https?://[^\"'\s]+" --include="*.{py,ts,js,go,java}" | \
  grep -v "localhost\|127\.0\.0\.1\|example\.com" | \
  sort -u

# Find URL construction
grep -rn "base_url\|baseURL\|API_URL\|endpoint" --include="*.{py,ts,js}"
```

## SDK/Client Library Detection

### Payment Processors

```bash
# Stripe
grep -rn "stripe\|Stripe" --include="*.{py,ts,js,rb}"

# PayPal
grep -rn "paypal\|PayPal\|braintree" --include="*.{py,ts,js}"

# Square
grep -rn "square\|Square" --include="*.{py,ts,js}"
```

### Communication Services

```bash
# Email
grep -rn "sendgrid\|mailgun\|ses\|smtp\|nodemailer" --include="*.{py,ts,js}"

# SMS
grep -rn "twilio\|Twilio\|nexmo\|sns" --include="*.{py,ts,js}"

# Push notifications
grep -rn "firebase\|fcm\|apns\|expo-notifications" --include="*.{py,ts,js}"
```

### Authentication Providers

```bash
# OAuth
grep -rn "oauth\|passport\|google-auth\|auth0" --include="*.{py,ts,js}"

# SSO
grep -rn "saml\|okta\|azure-ad\|cognito" --include="*.{py,ts,js}"
```

### Cloud Provider SDKs

```bash
# AWS
grep -rn "boto3\|aws-sdk\|@aws-sdk" --include="*.{py,ts,js}"

# GCP
grep -rn "google-cloud\|@google-cloud" --include="*.{py,ts,js}"

# Azure
grep -rn "azure\|@azure" --include="*.{py,ts,js}"
```

## Webhook Detection

### Webhook Endpoints

```bash
# Webhook routes
grep -rn "webhook\|/hook\|/callback" --include="*.{py,ts,js,rb}"

# Signature verification
grep -rn "verify_signature\|hmac\|webhook_secret" --include="*.{py,ts,js}"
```

### Webhook Senders

```bash
# Outgoing webhooks
grep -rn "webhook_url\|notify_url\|callback_url" --include="*.{py,ts,js}"
```

## API Classification

### By Criticality

| Level | Criteria | Examples |
|-------|----------|----------|
| Critical | Payment, auth, core data | Stripe, Auth0, primary DB API |
| High | User communication | SendGrid, Twilio |
| Medium | Analytics, monitoring | Segment, DataDog |
| Low | Enhancement features | Weather API, social sharing |

### By Reliability Requirements

| Requirement | APIs | Testing Need |
|-------------|------|--------------|
| Must succeed | Payments | Extensive error handling tests |
| Should succeed | Email | Retry logic tests |
| Best effort | Analytics | Graceful degradation tests |
| Can fail | Non-critical enrichment | Fallback behavior tests |

## Testing Requirements by Integration Type

### REST APIs

| Test Type | Purpose | Approach |
|-----------|---------|----------|
| Response parsing | Handle valid responses | Mock with real response shapes |
| Error handling | Handle 4xx, 5xx | Mock error responses |
| Timeout handling | Handle slow responses | Mock with delays |
| Retry logic | Recover from transient failures | Mock failures then success |
| Rate limiting | Respect API limits | Mock 429 responses |

### Webhooks (Incoming)

| Test Type | Purpose | Approach |
|-----------|---------|----------|
| Signature verification | Reject tampered requests | Test with valid/invalid signatures |
| Idempotency | Handle duplicate deliveries | Send same event twice |
| Event handling | Process all event types | Test each event type |
| Async processing | Don't block response | Verify quick response |

### OAuth/SSO

| Test Type | Purpose | Approach |
|-----------|---------|----------|
| Auth flow | Complete login | Mock OAuth server |
| Token refresh | Handle expiration | Mock expired tokens |
| Error states | Handle denied/revoked | Mock error responses |
| Logout | Clear all sessions | Verify cleanup |

## Integration Mapping

### Dependency Graph

```
Your Service
├── Payment (Stripe)
│   ├── Create payment intent
│   ├── Webhook: payment.succeeded
│   └── Webhook: payment.failed
├── Email (SendGrid)
│   ├── Send transactional
│   └── Send marketing
├── Auth (Auth0)
│   ├── Login
│   ├── Token refresh
│   └── Logout
└── Storage (S3)
    ├── Upload
    └── Download
```

### Per-Integration Audit

```markdown
## Integration: Stripe

### Endpoints Called
| Endpoint | Method | Purpose |
|----------|--------|---------|
| /v1/payment_intents | POST | Create payment |
| /v1/refunds | POST | Process refund |

### Webhooks Received
| Event | Handler | Idempotent? |
|-------|---------|-------------|
| payment_intent.succeeded | handleSuccess() | ✅/❌ |
| payment_intent.failed | handleFailure() | ✅/❌ |

### Error Handling
| Error | Handled? | User Message? |
|-------|----------|---------------|
| Card declined | ✅/❌ | ✅/❌ |
| Network timeout | ✅/❌ | ✅/❌ |
| Invalid request | ✅/❌ | ✅/❌ |

### Test Coverage
| Scenario | Unit | Integration | E2E |
|----------|------|-------------|-----|
| Successful payment | ✅/❌ | ✅/❌ | ✅/❌ |
| Declined card | ✅/❌ | ✅/❌ | ✅/❌ |
| Webhook delivery | N/A | ✅/❌ | ✅/❌ |
```

## Mock/Stub Strategies

### Level of Fidelity

| Strategy | Fidelity | Speed | When to Use |
|----------|----------|-------|-------------|
| Inline mock | Low | Fast | Unit tests |
| Mock server (MSW, WireMock) | Medium | Medium | Integration tests |
| Sandbox/test mode | High | Slow | E2E tests |
| Production with test data | Highest | Slowest | Final verification |

### Mock Server Setup

```typescript
// MSW example
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
    rest.post('https://api.stripe.com/v1/payment_intents', (req, res, ctx) => {
        return res(ctx.json({ id: 'pi_test', status: 'succeeded' }));
    }),

    rest.post('https://api.sendgrid.com/v3/mail/send', (req, res, ctx) => {
        return res(ctx.status(202));
    })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Audit Output Format

```markdown
## External API Integration Analysis

### Integration Inventory
| Service | SDK/Client | Criticality | Test Coverage |
|---------|------------|-------------|---------------|
| Stripe | stripe-python | Critical | ⚠️ Partial |
| SendGrid | sendgrid | High | ❌ None |
| Auth0 | auth0-python | Critical | ✅ Good |

### By Integration

#### Stripe
- **Endpoints**: 3 called (payment_intents, refunds, customers)
- **Webhooks**: 2 received (payment.succeeded, payment.failed)
- **Error handling**: Card decline handled, timeout NOT handled
- **Test coverage**: Unit tests mock all, no integration tests
- **Gaps**: Webhook signature verification untested

#### SendGrid
- **Endpoints**: 2 called (mail/send, templates)
- **Error handling**: None - fire and forget
- **Test coverage**: None
- **Gaps**: No tests for email delivery failures

### Risk Summary
| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Stripe timeout crashes checkout | High | Low | Add timeout handling + tests |
| Email silently fails | Medium | Medium | Add error handling + logging |
| Webhook replay causes duplicate orders | High | Medium | Implement + test idempotency |

### Testing Gaps
- [ ] No integration tests with Stripe test mode
- [ ] SendGrid completely untested
- [ ] Auth0 token refresh not tested
- [ ] No webhook signature verification tests
- [ ] Network timeout handling untested across all integrations
```

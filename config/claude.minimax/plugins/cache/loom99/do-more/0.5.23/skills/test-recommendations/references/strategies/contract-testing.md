# Contract Testing Strategy

When to use: Microservices, service-oriented architectures, any system with service boundaries.

## The Problem

In distributed systems, the test pyramid alone doesn't work:

```
Service A                    Service B
┌─────────┐                 ┌─────────┐
│ Unit ✅  │  ──HTTP/gRPC─→ │ Unit ✅  │
│ Integ ✅ │                 │ Integ ✅ │
└─────────┘                 └─────────┘
     ↓                           ↓
  Tests pass                  Tests pass
     ↓                           ↓
           PRODUCTION BREAKS
```

**Why?** Each service's tests mock the other. The mocks are wrong.

## Contract Testing Solution

```
Service A (Consumer)         Contract           Service B (Provider)
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Consumer Tests  │───→│   Contract   │←───│ Provider Tests  │
│ "When I call    │    │ "GET /users  │    │ "I respond to   │
│  GET /users..."│    │  returns..."  │    │  GET /users..." │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

Both sides verify against the **same contract**.

## Contract Types

### Consumer-Driven Contracts (CDC)

Consumer defines what it needs, provider verifies it can supply.

**Tools**: Pact, Spring Cloud Contract

**Flow**:
1. Consumer writes test defining expected response
2. Test generates contract file
3. Provider verifies it can produce that response
4. Contract stored in broker for versioning

```python
# Consumer side (Service A)
def test_get_user():
    pact.given("user 123 exists")
        .upon_receiving("a request for user 123")
        .with_request("GET", "/users/123")
        .will_respond_with(200, body={
            "id": 123,
            "name": Like("string"),
            "email": Like("string")
        })

    # Test runs against Pact mock server
    user = UserClient().get(123)
    assert user.name is not None
```

```python
# Provider side (Service B)
def test_provider_honors_contracts():
    verifier = Verifier()
    verifier.verify_with_broker(
        provider="user-service",
        provider_base_url="http://localhost:8000"
    )
```

### Provider-Driven Contracts

Provider publishes API spec, consumers verify compatibility.

**Tools**: OpenAPI validation, GraphQL schema

**Flow**:
1. Provider publishes OpenAPI spec
2. Consumers generate clients from spec
3. CI validates spec against implementation

```yaml
# openapi.yaml
paths:
  /users/{id}:
    get:
      responses:
        200:
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
```

```python
# Validate implementation matches spec
def test_api_matches_spec():
    response = client.get("/users/123")
    validate_response(response, spec["paths"]["/users/{id}"]["get"])
```

## When to Use Each

| Approach | Use When | Benefits |
|----------|----------|----------|
| Consumer-Driven | Multiple consumers, need flexibility | Each consumer gets what they need |
| Provider-Driven | Single provider, strict API | Single source of truth |
| Both | Complex systems | Maximum safety |

## Contract Testing vs Other Tests

| Test Type | What It Verifies | Where It Runs |
|-----------|------------------|---------------|
| Unit | Logic correctness | Single service |
| Integration | DB, cache work | Single service |
| Contract | API shape/behavior | Both services, independently |
| E2E | Full flow works | All services together |

**Contract tests don't replace E2E** but reduce the number needed.

## Implementation Recommendations

### For Audit Gaps

| Gap Type | Contract Test Approach |
|----------|----------------------|
| API format changes break consumers | Add Pact consumer tests |
| Response shape changes silently | Add schema validation |
| Missing fields in responses | Add provider verification |
| Version mismatches | Add contract versioning |

### Setup Checklist

- [ ] Choose contract framework (Pact, OpenAPI, etc.)
- [ ] Set up contract broker (Pact Broker, artifact storage)
- [ ] Add consumer tests for each dependency
- [ ] Add provider verification for each API
- [ ] Integrate into CI/CD

### CI Pipeline

```yaml
# Consumer CI
- name: Run consumer tests
  run: pytest tests/contracts/
- name: Publish contracts
  run: pact publish pacts/ --broker-url $PACT_BROKER

# Provider CI
- name: Verify provider
  run: pact verify --provider-base-url $PROVIDER_URL
- name: Can I deploy?
  run: pact broker can-i-deploy --pacticipant $SERVICE
```

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Testing implementation | Contracts test response format, not behavior | Keep contracts minimal |
| Too many contracts | Maintenance burden | One contract per consumer/endpoint |
| Stale contracts | False confidence | Automate verification in CI |
| Ignoring failures | "We'll fix it later" | Fail CI on contract breaks |

## Maturity Progression

| Level | State | Actions |
|-------|-------|---------|
| 1 | No contracts | Document APIs, add OpenAPI spec |
| 2 | Schema validation | Validate responses against schema |
| 3 | Consumer contracts | Add Pact for critical integrations |
| 4 | Full CDC | All services, broker, CI integration |

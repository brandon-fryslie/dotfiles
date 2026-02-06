# Detecting Microservice/Multi-Service Architectures

How to identify when a project is part of a distributed system and what testing implications that has.

## Detection Signals

### Service Definition Files

| Signal | File/Pattern | Indicates |
|--------|--------------|-----------|
| Docker Compose | `docker-compose.yml`, `compose.yaml` | Multi-container deployment |
| Kubernetes | `k8s/`, `*.yaml` with `kind: Deployment` | K8s orchestration |
| Helm | `Chart.yaml`, `charts/` | K8s package management |
| Terraform | `*.tf` with service definitions | Infrastructure as code |
| Service mesh | `istio.yaml`, `linkerd/` | Service mesh configuration |

```bash
# Detection commands
ls -la docker-compose*.yml compose*.yaml 2>/dev/null
find . -name "*.yaml" -exec grep -l "kind: Deployment" {} \;
ls -la k8s/ kubernetes/ manifests/ 2>/dev/null
```

### Inter-Service Communication

| Signal | Pattern | Indicates |
|--------|---------|-----------|
| HTTP clients | `axios`, `fetch`, `requests`, `http.Client` | REST API calls |
| gRPC | `*.proto`, `grpc` imports | gRPC communication |
| Message queues | `kafka`, `rabbitmq`, `sqs` imports | Async messaging |
| Service discovery | `consul`, `eureka`, environment URLs | Dynamic service location |

```bash
# Detection commands
grep -rn "http://\|https://" --include="*.{ts,js,py,go}" | grep -v test
grep -rn "process.env.*_URL\|os.environ.*_URL" --include="*.{ts,js,py}"
grep -rn "kafka\|rabbitmq\|sqs\|amqp" --include="*.{ts,js,py,go,java}"
```

### Environment Configuration

```bash
# Check for service URLs in env files
grep -E ".*_URL=|.*_HOST=|.*_ENDPOINT=" .env* config/*.env 2>/dev/null

# Example findings:
# USER_SERVICE_URL=http://user-service:8080
# ORDER_API_HOST=orders.internal
# PAYMENT_ENDPOINT=https://payment.company.com
```

### API Gateway Patterns

| Signal | Pattern | Indicates |
|--------|---------|-----------|
| Route aggregation | `/api/v1/users`, `/api/v1/orders` | Gateway routing |
| BFF pattern | `gateway/`, `bff/` directories | Backend for frontend |
| Proxy config | `nginx.conf`, `envoy.yaml` | Reverse proxy |

## Architecture Classification

### Monolith

```
Single deployable unit
├── All code in one repo
├── Single database
├── No inter-service HTTP calls
└── Single Dockerfile (if containerized)
```

**Testing implications**: Standard pyramid, integration tests hit real database.

### Modular Monolith

```
Single deployable, internal modules
├── Clear module boundaries
├── Shared database (possibly schemas per module)
├── Internal function calls, not HTTP
└── Single deployment
```

**Testing implications**: Module integration tests, contract tests between modules.

### Microservices

```
Multiple deployable services
├── Multiple repos or monorepo with services/
├── Service-per-database (usually)
├── Inter-service HTTP/gRPC/messaging
└── Multiple Dockerfiles, K8s manifests
```

**Testing implications**: Contract tests critical, integration tests need mocking or containers.

### Serverless/FaaS

```
Individual functions
├── functions/ directory
├── serverless.yml, sam.yaml
├── No long-running processes
└── Event-driven triggers
```

**Testing implications**: Unit test functions, integration test with local emulators.

## Testing Implications by Architecture

### For Microservices

| Testing Need | Why | Approach |
|--------------|-----|----------|
| Contract tests | Services must agree on API shape | Pact, OpenAPI validation |
| Integration tests | Verify actual communication | Testcontainers, docker-compose |
| Chaos testing | Services fail independently | Chaos Monkey, fault injection |
| E2E tests | Full system verification | Staging environment |

### Contract Testing Detection

Check if contract tests exist:

```bash
# Pact contracts
find . -name "*.pact.json" -o -path "*/pacts/*"

# OpenAPI specs
find . -name "openapi.yaml" -o -name "swagger.json"

# Contract test files
grep -rn "Pact\|Contract\|Provider\|Consumer" --include="*test*"
```

### Service Dependency Mapping

```python
# Script to map service dependencies
import re
import glob

def find_service_calls(directory):
    deps = {}
    for file in glob.glob(f"{directory}/**/*.py", recursive=True):
        with open(file) as f:
            content = f.read()
            # Find HTTP calls
            urls = re.findall(r'https?://([^/"\']+)', content)
            # Find env var service URLs
            env_urls = re.findall(r'os\.environ\.get\(["\'](\w+_URL)["\']', content)
            if urls or env_urls:
                deps[file] = {'urls': urls, 'env_urls': env_urls}
    return deps
```

## Audit Checklist

### Architecture Detection

- [ ] **Deployment model**: Single unit vs multiple services?
- [ ] **Communication**: Sync HTTP, async messaging, both?
- [ ] **Data ownership**: Shared DB vs service-per-DB?
- [ ] **Service discovery**: Hardcoded vs dynamic?
- [ ] **API gateway**: Present? What does it route?

### For Each External Service Call

Document:
- **Service name**: What service is being called?
- **Protocol**: HTTP, gRPC, message queue?
- **Failure modes**: What happens when it's down?
- **Test strategy**: Mocked, containerized, or skipped?

### Testing Gap Analysis

| Integration Point | Contract Test? | Integration Test? | E2E Coverage? |
|------------------|----------------|-------------------|---------------|
| User Service | ✅/❌ | ✅/❌ | ✅/❌ |
| Payment API | ✅/❌ | ✅/❌ | ✅/❌ |
| Notification Queue | ✅/❌ | ✅/❌ | ✅/❌ |

## Output Format

```markdown
## Service Architecture Analysis

### Architecture Type
[Monolith | Modular Monolith | Microservices | Serverless]

### Services Detected
| Service | Location | Protocol | Dependencies |
|---------|----------|----------|--------------|
| this-service | ./src | - | user-service, payment-api |
| user-service | external | HTTP | - |
| payment-api | external | HTTP | - |

### Communication Patterns
- HTTP REST: [services]
- gRPC: [services]
- Message Queue: [queues/topics]

### Testing Requirements
- Contract tests needed for: [list]
- Integration test containers needed: [list]
- Service mocks needed: [list]

### Gaps Identified
- [ ] No contract tests for user-service integration
- [ ] Payment API mocked everywhere, never tested real
- [ ] Message queue consumer has no tests
```

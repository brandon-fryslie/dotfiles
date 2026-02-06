# Infrastructure Testing Scenario

Testing Docker containers, Kubernetes configurations, Terraform, and CI/CD pipelines.

## Testing Strategy for Infrastructure

```
         ╱╲
        ╱E2E╲          Full deployment, real resources
       ╱──────╲
      ╱ Integ  ╲       Container builds, K8s manifests apply
     ╱──────────╲
    ╱    Unit    ╲     Config validation, policy checks
   ╱──────────────╲
```

| Level | What to Test | Resources Used |
|-------|--------------|----------------|
| Unit | Config syntax, policies | None |
| Integration | Builds, manifest validation | Local/CI only |
| E2E | Actual deployments | Real cloud resources |

## Docker Testing

### Dockerfile Linting

```bash
# Hadolint - Dockerfile linter
hadolint Dockerfile

# Common issues caught:
# - Missing HEALTHCHECK
# - Running as root
# - Using latest tag
# - Missing .dockerignore
```

### Build Testing

```bash
# Test build succeeds
docker build -t myapp:test .

# Test with different args
docker build --build-arg NODE_ENV=production -t myapp:prod .
```

### Container Behavior Tests

```python
import docker
import pytest

@pytest.fixture
def container():
    client = docker.from_env()
    container = client.containers.run(
        "myapp:test",
        detach=True,
        ports={"8080/tcp": None}
    )
    yield container
    container.stop()
    container.remove()

def test_container_starts(container):
    container.reload()
    assert container.status == "running"

def test_healthcheck_passes(container):
    # Wait for healthy
    for _ in range(30):
        container.reload()
        health = container.attrs["State"]["Health"]["Status"]
        if health == "healthy":
            return
        time.sleep(1)
    pytest.fail("Container never became healthy")

def test_app_responds(container):
    port = container.attrs["NetworkSettings"]["Ports"]["8080/tcp"][0]["HostPort"]
    response = requests.get(f"http://localhost:{port}/health")
    assert response.status_code == 200
```

### Security Scanning

```bash
# Trivy - vulnerability scanner
trivy image myapp:latest

# Grype - alternative scanner
grype myapp:latest

# Snyk
snyk container test myapp:latest
```

## Kubernetes Testing

### Manifest Validation

```bash
# Dry run
kubectl apply --dry-run=server -f manifests/

# Kubeval - schema validation
kubeval deployment.yaml

# Kubeconform - faster alternative
kubeconform -summary manifests/
```

### Policy Testing (OPA/Gatekeeper)

```rego
# policy/require-labels.rego
package kubernetes.admission

deny[msg] {
    input.request.kind.kind == "Deployment"
    not input.request.object.metadata.labels.app
    msg := "Deployments must have app label"
}
```

```bash
# Test policy
conftest test deployment.yaml -p policy/
```

### Helm Chart Testing

```bash
# Lint chart
helm lint ./chart

# Template validation
helm template ./chart | kubeval

# Unit tests with helm-unittest
helm unittest ./chart
```

```yaml
# tests/deployment_test.yaml
suite: deployment tests
templates:
  - deployment.yaml
tests:
  - it: should set correct replicas
    set:
      replicaCount: 3
    asserts:
      - equal:
          path: spec.replicas
          value: 3
```

### Integration Testing (Kind/Minikube)

```python
import subprocess
import pytest

@pytest.fixture(scope="session")
def cluster():
    subprocess.run(["kind", "create", "cluster", "--name", "test"], check=True)
    subprocess.run(["kubectl", "apply", "-f", "manifests/"], check=True)
    yield
    subprocess.run(["kind", "delete", "cluster", "--name", "test"])

def test_deployment_ready(cluster):
    result = subprocess.run(
        ["kubectl", "wait", "--for=condition=available",
         "deployment/myapp", "--timeout=60s"],
        capture_output=True
    )
    assert result.returncode == 0

def test_service_accessible(cluster):
    # Port forward and test
    pass
```

## Terraform Testing

### Static Analysis

```bash
# Format check
terraform fmt -check

# Validate
terraform validate

# TFLint
tflint

# Checkov - security scanning
checkov -d .
```

### Unit Testing (Terratest)

```go
package test

import (
    "testing"
    "github.com/gruntwork-io/terratest/modules/terraform"
)

func TestVPCModule(t *testing.T) {
    terraformOptions := &terraform.Options{
        TerraformDir: "../modules/vpc",
        Vars: map[string]interface{}{
            "cidr_block": "10.0.0.0/16",
        },
    }

    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)

    vpcID := terraform.Output(t, terraformOptions, "vpc_id")
    assert.NotEmpty(t, vpcID)
}
```

### Plan Testing

```bash
# Generate plan
terraform plan -out=plan.tfplan

# Convert to JSON for testing
terraform show -json plan.tfplan > plan.json

# Test with OPA
conftest test plan.json -p policy/
```

## CI/CD Pipeline Testing

### GitHub Actions

```yaml
# .github/workflows/test-workflow.yml
name: Test CI Workflow
on: [push]

jobs:
  test-actions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Test that workflow syntax is valid
      - name: Validate workflow
        run: |
          pip install check-jsonschema
          check-jsonschema --schemafile \
            https://json.schemastore.org/github-workflow.json \
            .github/workflows/*.yml
```

### Local Testing (act)

```bash
# Run GitHub Actions locally
act -j build

# With specific event
act push -e event.json
```

## Coverage Expectations

### Unit Tests (Validation)
- [ ] Dockerfile linting passes
- [ ] K8s manifests valid schema
- [ ] Terraform validates
- [ ] Policies pass
- [ ] No hardcoded secrets

### Integration Tests (Build/Apply)
- [ ] Docker builds succeed
- [ ] Helm templates render
- [ ] Terraform plans cleanly
- [ ] Manifests apply to test cluster

### E2E Tests (Deploy)
- [ ] App deploys and runs
- [ ] Health checks pass
- [ ] Networking works
- [ ] Persistence works

## Critical Test Areas

### 1. Security

```yaml
# K8s SecurityContext test
tests:
  - it: should not run as root
    asserts:
      - equal:
          path: spec.template.spec.securityContext.runAsNonRoot
          value: true
```

### 2. Resource Limits

```yaml
tests:
  - it: should have resource limits
    asserts:
      - isNotNull:
          path: spec.template.spec.containers[0].resources.limits.memory
```

### 3. High Availability

```python
def test_multiple_replicas():
    result = kubectl("get", "deployment/myapp", "-o", "jsonpath={.spec.replicas}")
    assert int(result) >= 2

def test_pod_disruption_budget():
    result = kubectl("get", "pdb", "myapp-pdb", "-o", "jsonpath={.spec.minAvailable}")
    assert result == "1"
```

### 4. Secrets Management

```bash
# Detect hardcoded secrets
gitleaks detect --source .

# Validate secrets reference
grep -r "secretKeyRef" manifests/ | while read line; do
    # Verify secret exists
done
```

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Testing only in production | Risky, slow feedback | Test in CI with ephemeral resources |
| No dry-run/plan | Surprises on deploy | Always dry-run first |
| Skipping security scans | Vulnerabilities ship | Scan in CI pipeline |
| Manual testing only | Not reproducible | Automated tests |
| Real cloud in unit tests | Expensive, slow | Mock or use test fixtures |

## Test Structure

```
infrastructure/
├── terraform/
│   ├── modules/
│   │   └── vpc/
│   │       ├── main.tf
│   │       └── test/
│   │           └── vpc_test.go
│   └── environments/
│       └── staging/
├── kubernetes/
│   ├── base/
│   │   └── deployment.yaml
│   ├── overlays/
│   └── tests/
│       └── deployment_test.yaml
├── docker/
│   ├── Dockerfile
│   └── test/
│       └── container_test.py
└── policies/
    ├── require-labels.rego
    └── test/
        └── require-labels_test.rego
```

## CI Pipeline Example

```yaml
jobs:
  validate:
    steps:
      - run: hadolint Dockerfile
      - run: terraform validate
      - run: kubeconform manifests/
      - run: checkov -d .

  build:
    steps:
      - run: docker build -t app:$SHA .
      - run: trivy image app:$SHA

  test:
    steps:
      - run: kind create cluster
      - run: kubectl apply -f manifests/
      - run: ./scripts/integration-tests.sh

  deploy:
    if: github.ref == 'refs/heads/main'
    steps:
      - run: terraform apply -auto-approve
```

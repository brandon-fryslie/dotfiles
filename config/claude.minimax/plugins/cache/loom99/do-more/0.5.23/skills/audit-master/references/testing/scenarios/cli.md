# CLI Tool Testing Scenario

Testing command-line applications with interactive shells, completions, and piping.

## Testing Pyramid for CLIs

```
         ╱╲
        ╱E2E╲          Subprocess invocation, full workflows
       ╱──────╲
      ╱ Integ  ╲       Command parsing + execution
     ╱──────────╲
    ╱    Unit    ╲     Individual functions, validators
   ╱──────────────╲
```

| Level | What to Test | Example |
|-------|--------------|---------|
| Unit | Validators, formatters, parsers | `parse_args("--verbose")` |
| Integration | Command handlers, subcommands | `run_command(["list", "--all"])` |
| E2E | Full subprocess, stdio, exit codes | `subprocess.run(["mycli", "list"])` |

## Critical Test Areas

### 1. Argument Parsing

**Must test:**
- Required args missing → helpful error
- Invalid arg values → validation error
- Flag combinations
- Default values applied
- Help text displays correctly

```python
# Unit test
def test_parse_verbose_flag():
    args = parse_args(["--verbose"])
    assert args.verbose is True

# Integration test
def test_missing_required_arg():
    result = run_command(["create"])  # Missing name arg
    assert result.exit_code == 1
    assert "required" in result.stderr.lower()
```

### 2. Exit Codes

| Exit Code | Meaning | Must Test |
|-----------|---------|-----------|
| 0 | Success | Happy path |
| 1 | General error | Invalid input |
| 2 | Misuse | Wrong arguments |
| Other | Application-specific | Document and test |

```python
def test_exit_codes():
    # Success
    result = subprocess.run(["mycli", "version"])
    assert result.returncode == 0

    # Error
    result = subprocess.run(["mycli", "invalid"])
    assert result.returncode == 1
```

### 3. Standard IO

**stdin:**
```python
def test_stdin_input():
    result = subprocess.run(
        ["mycli", "process"],
        input="input data\n",
        capture_output=True,
        text=True
    )
    assert "processed" in result.stdout
```

**stdout vs stderr:**
```python
def test_output_streams():
    result = subprocess.run(["mycli", "list"], capture_output=True, text=True)
    # Data goes to stdout
    assert "item1" in result.stdout
    # Errors go to stderr
    assert result.stderr == ""
```

**Piping:**
```python
def test_pipe_compatibility():
    # Output should be pipeable
    result = subprocess.run(
        "mycli list | grep pattern",
        shell=True,
        capture_output=True,
        text=True
    )
    assert result.returncode == 0
```

### 4. Interactive Input

**Testing prompts:**
```python
import pexpect

def test_interactive_prompt():
    child = pexpect.spawn("mycli init")
    child.expect("Project name:")
    child.sendline("myproject")
    child.expect("Created successfully")
    child.wait()
    assert child.exitstatus == 0
```

**Confirmation dialogs:**
```python
def test_confirmation():
    child = pexpect.spawn("mycli delete item")
    child.expect("Are you sure?")
    child.sendline("y")
    child.expect("Deleted")
```

### 5. Shell Completions

**Testing completion scripts:**
```bash
# Generate completions
mycli --completion bash > completions.bash

# Test they parse
bash -n completions.bash

# Test completion works
source completions.bash
complete -p mycli  # Should show completion function
```

**Programmatic completion testing:**
```python
def test_completion_suggestions():
    # Get completions for partial input
    completions = get_completions("mycli lis")
    assert "list" in completions

    # Subcommand completions
    completions = get_completions("mycli list --")
    assert "--verbose" in completions
    assert "--format" in completions
```

### 6. Configuration Files

```python
def test_config_file_loading():
    # Create config
    config_path = tmp_path / ".myclirc"
    config_path.write_text("verbose: true")

    result = run_cli(["list"], home=tmp_path)
    # Should behave as if --verbose was passed

def test_config_precedence():
    # CLI args override config file
    result = run_cli(["list", "--no-verbose"], config={"verbose": True})
    # verbose should be False
```

### 7. Environment Variables

```python
def test_env_var_configuration():
    result = subprocess.run(
        ["mycli", "list"],
        env={**os.environ, "MYCLI_VERBOSE": "1"},
        capture_output=True
    )
    assert "verbose output" in result.stdout

def test_env_var_precedence():
    # CLI args should override env vars
    result = subprocess.run(
        ["mycli", "list", "--quiet"],
        env={**os.environ, "MYCLI_VERBOSE": "1"},
        capture_output=True
    )
    # quiet should win
```

## Coverage Expectations

### Unit Tests (Many)
- [ ] Argument parsing
- [ ] Input validation
- [ ] Output formatting
- [ ] Error message generation
- [ ] Configuration merging

### Integration Tests (Medium)
- [ ] Each subcommand happy path
- [ ] Error handling per command
- [ ] Command chaining if supported
- [ ] Config + env + args interaction

### E2E Tests (Few)
- [ ] Full workflow with subprocess
- [ ] Exit codes for key scenarios
- [ ] Shell completion loading
- [ ] Interactive prompts work

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Testing only happy paths | Errors slip through | Test every exit code |
| Mocking subprocess | Doesn't test real CLI | Use actual subprocess |
| Testing output by exact match | Breaks on formatting changes | Match key content |
| Skipping interactive tests | Prompts may break | Use pexpect/expect |

## Tools

| Tool | Purpose | Language |
|------|---------|----------|
| pexpect | Interactive testing | Python |
| expect | Interactive testing | Any (TCL) |
| bats | Shell testing | Bash |
| cram | CLI testing DSL | Python |
| shellcheck | Shell script linting | Any |

## Example Test Structure

```
tests/
├── unit/
│   ├── test_parser.py
│   ├── test_validators.py
│   └── test_formatters.py
├── integration/
│   ├── test_list_command.py
│   ├── test_create_command.py
│   └── test_config.py
├── e2e/
│   ├── test_full_workflow.py
│   ├── test_interactive.py
│   └── test_completions.sh
└── fixtures/
    ├── sample_config.yaml
    └── test_data/
```

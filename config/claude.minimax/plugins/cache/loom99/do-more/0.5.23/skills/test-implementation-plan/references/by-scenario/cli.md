# CLI Tool Test Implementation Plan

Specific implementation guidance for testing command-line applications.

## Typical Testability Blockers

### 1. Direct stdin/stdout

**Blocker**: Reading from stdin and writing to stdout directly

```python
# BEFORE
def main():
    name = input("Enter name: ")
    print(f"Hello, {name}!")
```

**Fix**: Abstract I/O

```python
# AFTER
from typing import Protocol

class IO(Protocol):
    def input(self, prompt: str) -> str: ...
    def output(self, message: str) -> None: ...

class ConsoleIO:
    def input(self, prompt: str) -> str:
        return input(prompt)

    def output(self, message: str) -> None:
        print(message)

def main(io: IO = ConsoleIO()):
    name = io.input("Enter name: ")
    io.output(f"Hello, {name}!")
```

### 2. sys.exit() Calls

**Blocker**: Exiting directly without testable return

```python
# BEFORE
def main():
    if error:
        print("Error!")
        sys.exit(1)
```

**Fix**: Return exit codes

```python
# AFTER
def main() -> int:
    if error:
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

### 3. Hardcoded File Paths

**Blocker**: Reading/writing to fixed paths

```python
# BEFORE
def load_config():
    with open("~/.myapp/config.yaml") as f:
        return yaml.load(f)
```

**Fix**: Injectable paths

```python
# AFTER
def load_config(config_path: Path = None):
    if config_path is None:
        config_path = Path.home() / ".myapp" / "config.yaml"
    with open(config_path) as f:
        return yaml.load(f)
```

### 4. Environment Variables

**Blocker**: Direct os.environ access

```python
# BEFORE
def get_api_key():
    return os.environ["API_KEY"]
```

**Fix**: Config object

```python
# AFTER
@dataclass
class Config:
    api_key: str

    @classmethod
    def from_env(cls) -> "Config":
        return cls(api_key=os.environ.get("API_KEY", ""))
```

## Implementation Sequence

### Phase 1: Core Logic Extraction (Day 1)

```markdown
1. Identify pure logic
   - [ ] Argument parsing logic
   - [ ] Business logic
   - [ ] Output formatting

2. Extract to testable functions
   - [ ] parse_args() → Config object
   - [ ] process() → pure function
   - [ ] format_output() → pure function
```

Example extraction:

```python
# BEFORE: All in one function
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output")
    args = parser.parse_args()

    with open(args.input) as f:
        data = json.load(f)

    result = process(data)

    if args.output:
        with open(args.output, "w") as f:
            json.dump(result, f)
    else:
        print(json.dumps(result))

# AFTER: Separated concerns
def parse_args(argv: list[str] = None) -> Config:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output")
    args = parser.parse_args(argv)
    return Config(input=args.input, output=args.output)

def process_data(data: dict) -> dict:
    # Pure business logic
    return transform(data)

def main(argv: list[str] = None) -> int:
    config = parse_args(argv)
    data = load_json(config.input)
    result = process_data(data)
    write_output(result, config.output)
    return 0
```

### Phase 2: I/O Abstraction (Day 2)

```markdown
1. Abstract file system
   - [ ] Create FileSystem interface
   - [ ] Implement real and mock versions

2. Abstract console I/O
   - [ ] Create Console interface
   - [ ] Implement real and mock versions
```

Example:

```python
class FileSystem(Protocol):
    def read_text(self, path: Path) -> str: ...
    def write_text(self, path: Path, content: str) -> None: ...
    def exists(self, path: Path) -> bool: ...

class RealFileSystem:
    def read_text(self, path: Path) -> str:
        return path.read_text()

    def write_text(self, path: Path, content: str) -> None:
        path.write_text(content)

    def exists(self, path: Path) -> bool:
        return path.exists()

class MemoryFileSystem:
    def __init__(self):
        self.files: dict[Path, str] = {}

    def read_text(self, path: Path) -> str:
        if path not in self.files:
            raise FileNotFoundError(path)
        return self.files[path]

    def write_text(self, path: Path, content: str) -> None:
        self.files[path] = content

    def exists(self, path: Path) -> bool:
        return path in self.files
```

### Phase 3: Unit Tests (Day 3)

```markdown
1. Argument parsing tests
   - [ ] Valid arguments
   - [ ] Invalid arguments
   - [ ] Default values
   - [ ] Help text

2. Business logic tests
   - [ ] Normal cases
   - [ ] Edge cases
   - [ ] Error cases
```

Example tests:

```python
def test_parse_args_valid():
    config = parse_args(["--input", "data.json"])
    assert config.input == "data.json"
    assert config.output is None

def test_parse_args_with_output():
    config = parse_args(["--input", "data.json", "--output", "out.json"])
    assert config.output == "out.json"

def test_parse_args_missing_required():
    with pytest.raises(SystemExit):
        parse_args([])

def test_process_data_empty():
    result = process_data({})
    assert result == {}

def test_process_data_transforms():
    result = process_data({"name": "alice"})
    assert result["name"] == "ALICE"  # Example transformation
```

### Phase 4: Integration Tests (Day 4)

```markdown
1. Command execution tests
   - [ ] Success cases
   - [ ] Error handling
   - [ ] Exit codes

2. File I/O tests
   - [ ] Reading files
   - [ ] Writing files
   - [ ] Missing files
```

Example integration tests:

```python
def test_cli_with_input_file(tmp_path):
    input_file = tmp_path / "input.json"
    input_file.write_text('{"data": 123}')

    output_file = tmp_path / "output.json"

    exit_code = main([
        "--input", str(input_file),
        "--output", str(output_file)
    ])

    assert exit_code == 0
    assert output_file.exists()
    assert json.loads(output_file.read_text())["data"] == 123

def test_cli_missing_input_file(tmp_path, capsys):
    exit_code = main(["--input", str(tmp_path / "nonexistent.json")])

    assert exit_code == 1
    captured = capsys.readouterr()
    assert "not found" in captured.err.lower()
```

### Phase 5: Interactive Testing (Day 5)

```markdown
1. PTY tests for interactive features
   - [ ] Prompts
   - [ ] Confirmations
   - [ ] Progress indicators

2. Shell completion tests
   - [ ] Bash completion
   - [ ] Zsh completion
```

Example interactive tests:

```python
import pexpect

def test_interactive_setup():
    child = pexpect.spawn("python mycli.py init")

    child.expect("Project name:")
    child.sendline("my-project")

    child.expect("Author:")
    child.sendline("Alice")

    child.expect("Created successfully")
    child.wait()

    assert child.exitstatus == 0

def test_dangerous_operation_requires_confirmation():
    child = pexpect.spawn("python mycli.py delete-all")

    child.expect("Are you sure.*\\[y/N\\]")
    child.sendline("n")

    child.expect("Cancelled")
    assert child.exitstatus == 0

def test_password_not_echoed():
    child = pexpect.spawn("python mycli.py login")

    child.expect("Password:")
    child.sendline("secret123")

    output = child.before.decode()
    assert "secret123" not in output
```

### Phase 6: E2E Tests (Day 6)

```markdown
1. Full workflow tests
   - [ ] Complete user scenarios
   - [ ] Multi-command workflows
   - [ ] Configuration persistence
```

Example E2E test:

```python
def test_full_workflow(tmp_path):
    # Initialize project
    result = subprocess.run(
        ["mycli", "init", "--name", "test-project"],
        cwd=tmp_path,
        capture_output=True
    )
    assert result.returncode == 0

    # Verify config created
    assert (tmp_path / "config.yaml").exists()

    # Add some data
    result = subprocess.run(
        ["mycli", "add", "--item", "something"],
        cwd=tmp_path,
        capture_output=True
    )
    assert result.returncode == 0

    # List items
    result = subprocess.run(
        ["mycli", "list"],
        cwd=tmp_path,
        capture_output=True
    )
    assert result.returncode == 0
    assert b"something" in result.stdout
```

## File Structure After Refactoring

```
src/
├── cli/
│   ├── __main__.py        # Entry point
│   ├── commands/
│   │   ├── init.py
│   │   ├── add.py
│   │   └── list.py
│   ├── io.py              # I/O abstractions
│   └── config.py          # Configuration
├── core/
│   ├── processor.py       # Business logic
│   └── models.py
└── completions/
    ├── bash.sh
    └── zsh.sh

tests/
├── conftest.py
├── unit/
│   ├── test_commands.py
│   └── test_processor.py
├── integration/
│   └── test_cli.py
├── interactive/
│   └── test_prompts.py
└── e2e/
    └── test_workflows.py
```

## Coverage Targets

| Layer | Target | Type |
|-------|--------|------|
| Business logic | 90% | Unit |
| Commands | 80% | Integration |
| Interactive | 70% | PTY tests |
| E2E | Critical paths | E2E |

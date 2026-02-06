# Property-Based Testing Strategy

When to use: Libraries/SDKs, parsers, serializers, algorithms, any code where examples can't cover all cases.

## The Problem with Example-Based Tests

```python
# Example-based: Tests specific cases
def test_reverse_string():
    assert reverse("hello") == "olleh"
    assert reverse("") == ""
    assert reverse("a") == "a"
```

**What's missing?**
- Unicode? `reverse("こんにちは")`
- Emoji? `reverse("👨‍👩‍👧‍👦")`
- Null bytes? `reverse("a\x00b")`
- Very long strings? `reverse("a" * 10_000_000)`

## Property-Based Testing Solution

**Don't test specific examples. Test properties that must always hold.**

```python
from hypothesis import given
import hypothesis.strategies as st

@given(st.text())
def test_reverse_length_preserved(s):
    """Reversing doesn't change length"""
    assert len(reverse(s)) == len(s)

@given(st.text())
def test_reverse_twice_is_identity(s):
    """Reversing twice gives original"""
    assert reverse(reverse(s)) == s

@given(st.text())
def test_reverse_first_last_swap(s):
    """First and last chars swap"""
    if len(s) >= 2:
        assert reverse(s)[0] == s[-1]
        assert reverse(s)[-1] == s[0]
```

## What Are Properties?

Properties are invariants that must hold for all inputs.

| Property Type | Example |
|---------------|---------|
| **Roundtrip** | `deserialize(serialize(x)) == x` |
| **Idempotent** | `f(f(x)) == f(x)` |
| **Commutative** | `f(a, b) == f(b, a)` |
| **Associative** | `f(f(a, b), c) == f(a, f(b, c))` |
| **Invariant** | `len(sort(x)) == len(x)` |
| **Oracle** | `our_sort(x) == reference_sort(x)` |

## Common Property Patterns

### Serialization/Parsing

```python
@given(st.builds(User, name=st.text(), age=st.integers(0, 150)))
def test_json_roundtrip(user):
    """Serialize then deserialize gives same user"""
    json_str = user.to_json()
    restored = User.from_json(json_str)
    assert user == restored

@given(st.binary())
def test_base64_roundtrip(data):
    """Encode then decode gives same data"""
    encoded = base64_encode(data)
    decoded = base64_decode(encoded)
    assert decoded == data
```

### Sorting/Ordering

```python
@given(st.lists(st.integers()))
def test_sort_preserves_elements(lst):
    """Sorting doesn't add or remove elements"""
    sorted_lst = sort(lst)
    assert sorted(sorted_lst) == sorted(lst)  # Same elements
    assert len(sorted_lst) == len(lst)

@given(st.lists(st.integers()))
def test_sort_is_ordered(lst):
    """Result is actually sorted"""
    sorted_lst = sort(lst)
    for i in range(len(sorted_lst) - 1):
        assert sorted_lst[i] <= sorted_lst[i + 1]

@given(st.lists(st.integers()))
def test_sort_idempotent(lst):
    """Sorting twice gives same result"""
    assert sort(sort(lst)) == sort(lst)
```

### Data Structures

```python
@given(st.lists(st.integers()))
def test_set_union_commutative(a, b):
    """Union is commutative"""
    set_a, set_b = set(a), set(b)
    assert set_a | set_b == set_b | set_a

@given(st.lists(st.integers()), st.integers())
def test_insert_find(lst, item):
    """After insert, item is findable"""
    tree = BST(lst)
    tree.insert(item)
    assert tree.contains(item)
```

### Mathematical Functions

```python
@given(st.floats(allow_nan=False), st.floats(allow_nan=False))
def test_add_commutative(a, b):
    """Addition is commutative"""
    assert add(a, b) == add(b, a)

@given(st.integers())
def test_abs_non_negative(n):
    """Absolute value is never negative"""
    assert abs(n) >= 0

@given(st.integers())
def test_negate_twice_identity(n):
    """Negating twice gives original"""
    assert negate(negate(n)) == n
```

### APIs/Services

```python
@given(st.builds(CreateUserRequest, name=st.text(min_size=1)))
def test_create_user_returns_id(request):
    """Creating user always returns valid ID"""
    response = api.create_user(request)
    assert response.id is not None
    assert isinstance(response.id, str)

@given(st.builds(CreateUserRequest), st.builds(CreateUserRequest))
def test_different_users_different_ids(req1, req2):
    """Two creates produce different IDs"""
    id1 = api.create_user(req1).id
    id2 = api.create_user(req2).id
    assert id1 != id2
```

## Strategies (Data Generators)

| Strategy | Generates |
|----------|-----------|
| `st.integers()` | Integers (inc. negative, zero) |
| `st.floats()` | Floats (inc. inf, nan by default) |
| `st.text()` | Unicode strings (inc. empty) |
| `st.binary()` | Byte sequences |
| `st.lists(st.X())` | Lists of X |
| `st.dictionaries(st.X(), st.Y())` | Dicts with X keys, Y values |
| `st.builds(Class, field=st.X())` | Instances of Class |
| `st.one_of(st.X(), st.Y())` | Either X or Y |

## Testing Frameworks

| Language | Library |
|----------|---------|
| Python | Hypothesis |
| JavaScript | fast-check |
| Rust | proptest, quickcheck |
| Go | gopter |
| Java | jqwik, QuickTheories |
| Haskell | QuickCheck |

## When to Use Property-Based Testing

| Use Case | Why |
|----------|-----|
| Parsers | Infinite input space |
| Serializers | Roundtrip properties |
| Algorithms | Mathematical properties |
| Data structures | Invariants must hold |
| Compilers | Semantic preservation |
| Security | Find edge case exploits |

## When NOT to Use

| Case | Why Not |
|------|---------|
| UI tests | Properties hard to define |
| Integration tests | Too slow |
| Simple CRUD | Example tests sufficient |
| Business logic | Properties domain-specific |

## Recommendation Patterns

### For Library/Parser Gaps

| Gap | Property Test |
|-----|---------------|
| JSON parser untested | Roundtrip property |
| Sort algorithm | Ordering + element preservation |
| Hash function | Determinism + no collisions |
| Compression | Decompress(compress(x)) == x |
| Encryption | Decrypt(encrypt(x)) == x |

### Combining with Example Tests

```python
# Example test: Specific, documented behavior
def test_sort_empty():
    """Empty list returns empty"""
    assert sort([]) == []

# Property test: General invariants
@given(st.lists(st.integers()))
def test_sort_properties(lst):
    """Sort preserves elements and orders"""
    result = sort(lst)
    assert len(result) == len(lst)
    assert all(result[i] <= result[i+1] for i in range(len(result)-1))
```

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Overly complex properties | Hard to understand failures | Keep properties simple |
| Slow generation | Tests take too long | Limit size, use simpler strategies |
| Flaky from randomness | Non-deterministic failures | Use seeds, fix random issues |
| Properties too weak | Misses bugs | Think harder about invariants |

# Java/Kotlin Testing Reference

## Framework Detection

```bash
# Check build files
grep -E "junit|testng|mockito|assertj" pom.xml build.gradle build.gradle.kts 2>/dev/null
```

| Framework | Indicator | Recommended |
|-----------|-----------|-------------|
| JUnit 5 | `junit-jupiter` | ✅ Standard |
| JUnit 4 | `junit:junit:4` | Legacy, migrate |
| TestNG | `testng` | Alternative |
| Mockito | `mockito-core` | ✅ Mocking |
| AssertJ | `assertj-core` | ✅ Fluent assertions |

## Test File Patterns

```bash
# Maven/Gradle convention
find . -path "*/test/*" -name "*Test.java" | head -30
find . -path "*/test/*" -name "*Test.kt" | head -30
```

**Convention**: `src/test/java/` mirrors `src/main/java/`

## Coverage Tools

### JaCoCo (Standard)

**Maven:**
```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.11</version>
    <executions>
        <execution>
            <goals><goal>prepare-agent</goal></goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>test</phase>
            <goals><goal>report</goal></goals>
        </execution>
    </executions>
</plugin>
```

**Run:**
```bash
mvn test jacoco:report
# Report at target/site/jacoco/index.html
```

**Gradle:**
```kotlin
plugins {
    jacoco
}

tasks.jacocoTestReport {
    reports {
        xml.required.set(true)
        html.required.set(true)
    }
}

tasks.jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit {
                minimum = "0.80".toBigDecimal()
            }
        }
    }
}
```

## Test Categories

### JUnit 5 Tags

```java
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("unit")
class UserServiceTest {
    @Test
    void testValidation() { }
}

@Tag("integration")
class DatabaseTest {
    @Test
    void testConnection() { }
}
```

**Run by tag:**
```bash
# Maven
mvn test -Dgroups=unit

# Gradle
./gradlew test -Pinclude=unit
```

### Nested Tests

```java
@DisplayName("UserService")
class UserServiceTest {
    @Nested
    @DisplayName("when user exists")
    class WhenUserExists {
        @Test
        void returnsUser() { }
    }

    @Nested
    @DisplayName("when user missing")
    class WhenUserMissing {
        @Test
        void throwsException() { }
    }
}
```

## Common Patterns to Audit

### AssertJ (Fluent Assertions)

```java
import static org.assertj.core.api.Assertions.*;

@Test
void testUser() {
    User user = service.getUser(1);

    assertThat(user)
        .isNotNull()
        .hasFieldOrPropertyWithValue("name", "Alice")
        .extracting(User::getEmail)
        .isEqualTo("alice@example.com");
}
```

### Mockito

**Good** - Verify behavior:
```java
@Test
void testService() {
    UserRepository repo = mock(UserRepository.class);
    when(repo.findById(1)).thenReturn(Optional.of(testUser));

    UserService service = new UserService(repo);
    service.getUser(1);

    verify(repo).findById(1);
}
```

**Bad** - Over-mocking:
```java
// Mocking data classes is a smell
User mockUser = mock(User.class);
when(mockUser.getName()).thenReturn("Test");  // Just use real User!
```

### Parameterized Tests

```java
@ParameterizedTest
@CsvSource({
    "1, 2, 3",
    "-1, -2, -3",
    "0, 0, 0"
})
void testAdd(int a, int b, int expected) {
    assertEquals(expected, calculator.add(a, b));
}
```

## Integration Testing

### Spring Boot Test

```java
@SpringBootTest
@AutoConfigureMockMvc
class ApiTest {
    @Autowired
    MockMvc mockMvc;

    @Test
    void testEndpoint() throws Exception {
        mockMvc.perform(get("/users/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Alice"));
    }
}
```

### Testcontainers (Real Services)

```java
@Testcontainers
class DatabaseTest {
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");

    @Test
    void testRealDatabase() {
        // Uses real PostgreSQL in Docker
    }
}
```

## Quality Checks

### Find Tests Without Assertions
```bash
grep -L "assert\|verify\|expect" src/test/**/*Test.java
```

### Find Disabled Tests
```bash
grep -rn "@Disabled\|@Ignore" src/test/
```

### Find Tests with Only
```bash
grep -rn "@Tag.*only\|@Only" src/test/  # Custom patterns
```

### Mutation Testing (PITest)

```xml
<plugin>
    <groupId>org.pitest</groupId>
    <artifactId>pitest-maven-plugin</artifactId>
    <configuration>
        <targetClasses>
            <param>com.myapp.*</param>
        </targetClasses>
    </configuration>
</plugin>
```

**Run:**
```bash
mvn pitest:mutationCoverage
```

## CI Configuration

### GitHub Actions
```yaml
- name: Test
  run: mvn test jacoco:report

- name: Check Coverage
  run: mvn jacoco:check
```

### Maven Failsafe (Integration Tests)
```xml
<plugin>
    <artifactId>maven-failsafe-plugin</artifactId>
    <executions>
        <execution>
            <goals>
                <goal>integration-test</goal>
                <goal>verify</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

**Convention**: Integration tests named `*IT.java`

## Directory Convention

```
project/
├── src/
│   ├── main/java/
│   │   └── com/myapp/
│   └── test/java/
│       └── com/myapp/
│           ├── unit/           # Optional subdirs
│           └── integration/
└── pom.xml
```

## Kotlin-Specific

### kotest (Native Kotlin)

```kotlin
class UserServiceTest : StringSpec({
    "should return user by id" {
        val user = service.getUser(1)
        user.name shouldBe "Alice"
    }

    "should throw for missing user" {
        shouldThrow<NotFoundException> {
            service.getUser(999)
        }
    }
})
```

### MockK (Kotlin Mocking)

```kotlin
@Test
fun `test with mockk`() {
    val repo = mockk<UserRepository>()
    every { repo.findById(1) } returns testUser

    val service = UserService(repo)
    val result = service.getUser(1)

    verify { repo.findById(1) }
}
```

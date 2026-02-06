# Mobile App Testing Scenario

Testing iOS (Swift/SwiftUI) and Android (Kotlin/Jetpack Compose) applications.

## Testing Pyramid for Mobile

```
         ╱╲
        ╱E2E╲          Real device/simulator, UI automation
       ╱──────╲
      ╱ Integ  ╲       View + ViewModel, Navigation
     ╱──────────╲
    ╱    Unit    ╲     ViewModels, Services, Utils
   ╱──────────────╲
```

| Level | What to Test | Speed |
|-------|--------------|-------|
| Unit | Business logic, ViewModels | Milliseconds |
| Integration | UI components, navigation | Seconds |
| E2E | Full user flows on device | Minutes |

## iOS Testing

### Unit Tests (XCTest)

```swift
import XCTest
@testable import MyApp

class UserViewModelTests: XCTestCase {
    var sut: UserViewModel!
    var mockService: MockUserService!

    override func setUp() {
        mockService = MockUserService()
        sut = UserViewModel(service: mockService)
    }

    func testFetchUserUpdatesState() async {
        mockService.mockUser = User(name: "Alice")

        await sut.fetchUser(id: 1)

        XCTAssertEqual(sut.user?.name, "Alice")
        XCTAssertFalse(sut.isLoading)
    }

    func testFetchUserErrorSetsError() async {
        mockService.shouldFail = true

        await sut.fetchUser(id: 1)

        XCTAssertNotNil(sut.error)
    }
}
```

### Integration Tests (UI Testing)

```swift
import XCTest

class LoginUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        app = XCUIApplication()
        app.launch()
    }

    func testLoginSuccess() {
        let emailField = app.textFields["email"]
        let passwordField = app.secureTextFields["password"]
        let loginButton = app.buttons["Sign In"]

        emailField.tap()
        emailField.typeText("test@test.com")

        passwordField.tap()
        passwordField.typeText("password")

        loginButton.tap()

        XCTAssertTrue(app.staticTexts["Welcome"].waitForExistence(timeout: 5))
    }
}
```

### SwiftUI Preview Tests

```swift
import SnapshotTesting

func testUserCardSnapshot() {
    let view = UserCard(user: .preview)

    assertSnapshot(matching: view, as: .image(layout: .device(config: .iPhone13)))
}
```

### Coverage Tools

```bash
# Run tests with coverage
xcodebuild test \
  -scheme MyApp \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  -enableCodeCoverage YES

# Generate report
xcrun xccov view --report Build/Logs/Test/*.xcresult
```

## Android Testing

### Unit Tests (JUnit)

```kotlin
class UserViewModelTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var viewModel: UserViewModel
    private val mockService = mockk<UserService>()

    @Before
    fun setup() {
        viewModel = UserViewModel(mockService)
    }

    @Test
    fun `fetchUser updates state on success`() = runTest {
        coEvery { mockService.getUser(1) } returns User(name = "Alice")

        viewModel.fetchUser(1)

        assertEquals("Alice", viewModel.user.value?.name)
        assertFalse(viewModel.isLoading.value)
    }
}
```

### Integration Tests (Compose)

```kotlin
class LoginScreenTest {
    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun loginButton_enabledWhenFieldsFilled() {
        composeTestRule.setContent {
            LoginScreen()
        }

        composeTestRule.onNodeWithTag("email").performTextInput("test@test.com")
        composeTestRule.onNodeWithTag("password").performTextInput("password")

        composeTestRule.onNodeWithTag("loginButton").assertIsEnabled()
    }
}
```

### Instrumented Tests (Espresso)

```kotlin
@RunWith(AndroidJUnit4::class)
class LoginInstrumentedTest {
    @get:Rule
    val activityRule = ActivityScenarioRule(LoginActivity::class.java)

    @Test
    fun loginFlow_success() {
        onView(withId(R.id.email)).perform(typeText("test@test.com"))
        onView(withId(R.id.password)).perform(typeText("password"))
        onView(withId(R.id.loginButton)).perform(click())

        onView(withId(R.id.welcome)).check(matches(isDisplayed()))
    }
}
```

### Coverage Tools (JaCoCo)

```kotlin
// build.gradle.kts
android {
    buildTypes {
        debug {
            enableAndroidTestCoverage = true
            enableUnitTestCoverage = true
        }
    }
}
```

## Critical Test Areas

### 1. State Management

```swift
// iOS
func testStateTransitions() async {
    XCTAssertEqual(sut.state, .idle)

    let task = Task { await sut.fetchData() }
    XCTAssertEqual(sut.state, .loading)

    await task.value
    XCTAssertEqual(sut.state, .loaded)
}
```

```kotlin
// Android
@Test
fun `state transitions correctly`() = runTest {
    assertEquals(UiState.Idle, viewModel.state.value)

    viewModel.fetchData()
    assertEquals(UiState.Loading, viewModel.state.value)

    advanceUntilIdle()
    assertTrue(viewModel.state.value is UiState.Success)
}
```

### 2. Navigation

```swift
// iOS
func testNavigationToDetail() {
    app.tables.cells.firstMatch.tap()
    XCTAssertTrue(app.navigationBars["Detail"].exists)
}
```

```kotlin
// Android with Navigation
@Test
fun `navigate to detail on item click`() {
    composeTestRule.setContent {
        val navController = rememberNavController()
        NavHost(navController, startDestination = "list") {
            composable("list") { ListScreen(navController) }
            composable("detail/{id}") { DetailScreen() }
        }
    }

    composeTestRule.onNodeWithTag("item_1").performClick()
    composeTestRule.onNodeWithTag("detail_screen").assertIsDisplayed()
}
```

### 3. Network/API Calls

```swift
// Mock network layer
class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) -> (HTTPURLResponse, Data?))?

    override func startLoading() {
        let (response, data) = Self.requestHandler!(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        if let data = data {
            client?.urlProtocol(self, didLoad: data)
        }
        client?.urlProtocolDidFinishLoading(self)
    }
}
```

### 4. Offline Mode

```kotlin
@Test
fun `shows cached data when offline`() = runTest {
    // Setup cached data
    cache.save(listOf(cachedItem))

    // Simulate offline
    coEvery { networkService.fetch() } throws IOException()

    viewModel.loadData()

    assertEquals(listOf(cachedItem), viewModel.items.value)
    assertTrue(viewModel.isOffline.value)
}
```

### 5. Permissions

```swift
// iOS
func testLocationPermissionFlow() {
    // Simulate permission not granted
    let app = XCUIApplication()
    app.launchArguments.append("--uitesting-reset-permissions")
    app.launch()

    app.buttons["Enable Location"].tap()

    // System permission dialog
    addUIInterruptionMonitor(withDescription: "Location") { alert in
        alert.buttons["Allow While Using App"].tap()
        return true
    }
    app.tap()

    XCTAssertTrue(app.staticTexts["Location Enabled"].exists)
}
```

## Coverage Expectations

### Unit Tests (Many)
- [ ] ViewModels/Presenters
- [ ] Service classes
- [ ] Data mappers
- [ ] Validators
- [ ] Utilities

### Integration Tests (Medium)
- [ ] Screen components
- [ ] Navigation flows
- [ ] State management
- [ ] Data persistence

### E2E Tests (Few)
- [ ] Login/auth flow
- [ ] Main user journey
- [ ] Purchase flow (if applicable)
- [ ] Critical business flows

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Testing UI implementation | Breaks on redesign | Test behavior/state |
| Sleeping in tests | Slow, flaky | Use async assertions |
| Real network in unit tests | Slow, unreliable | Mock network layer |
| Testing private methods | Breaks on refactor | Test through public API |
| No loading state tests | Users see broken UI | Test all states |

## Test Structure

### iOS
```
MyApp/
├── Sources/
│   └── Features/
│       └── Login/
│           ├── LoginView.swift
│           └── LoginViewModel.swift
├── Tests/
│   ├── UnitTests/
│   │   └── LoginViewModelTests.swift
│   └── UITests/
│       └── LoginUITests.swift
└── Previews/
    └── LoginPreviews.swift
```

### Android
```
app/
├── src/
│   ├── main/
│   │   └── java/.../login/
│   │       ├── LoginScreen.kt
│   │       └── LoginViewModel.kt
│   ├── test/                    # Unit tests
│   │   └── LoginViewModelTest.kt
│   └── androidTest/             # Instrumented tests
│       └── LoginScreenTest.kt
```

## CI Configuration

### iOS (Fastlane)
```ruby
lane :test do
  scan(
    scheme: "MyApp",
    devices: ["iPhone 15"],
    code_coverage: true
  )
end
```

### Android (GitHub Actions)
```yaml
- name: Unit Tests
  run: ./gradlew testDebugUnitTest

- name: Instrumented Tests
  uses: reactivecircus/android-emulator-runner@v2
  with:
    api-level: 34
    script: ./gradlew connectedDebugAndroidTest
```

# Game Development Testing Scenario

Testing Unity, Unreal Engine, Godot, and custom game engines.

## Unique Challenges

Game development presents unique testing challenges:
- **Non-determinism**: Physics, randomness, frame timing
- **Visual verification**: Graphics rendering correctness
- **Performance**: Frame rate, memory, load times
- **Input systems**: Controllers, touch, gestures
- **State complexity**: Save/load, game progression

## Testing Pyramid for Games

```
         ╱╲
        ╱E2E╲          Full playthrough, automated QA
       ╱──────╲
      ╱ Integ  ╲       Systems interaction, scene loading
     ╱──────────╲
    ╱    Unit    ╲     Game logic, math, AI
   ╱──────────────╲
```

| Level | What to Test | Determinism |
|-------|--------------|-------------|
| Unit | Pure game logic, math | Deterministic |
| Integration | System interactions | Semi-deterministic |
| E2E | Full gameplay | Non-deterministic |

## Unity Testing

### Unit Tests (Unity Test Framework)

```csharp
using NUnit.Framework;

[TestFixture]
public class InventoryTests {
    private Inventory inventory;

    [SetUp]
    public void Setup() {
        inventory = new Inventory(maxSlots: 10);
    }

    [Test]
    public void AddItem_WhenSpaceAvailable_AddsItem() {
        var item = new Item("Sword", ItemType.Weapon);

        bool added = inventory.AddItem(item);

        Assert.IsTrue(added);
        Assert.AreEqual(1, inventory.ItemCount);
    }

    [Test]
    public void AddItem_WhenFull_ReturnsFalse() {
        for (int i = 0; i < 10; i++) {
            inventory.AddItem(new Item($"Item{i}", ItemType.Misc));
        }

        bool added = inventory.AddItem(new Item("Extra", ItemType.Misc));

        Assert.IsFalse(added);
        Assert.AreEqual(10, inventory.ItemCount);
    }

    [Test]
    public void StackableItems_Stack_Correctly() {
        var potion1 = new Item("Health Potion", ItemType.Consumable, stackable: true);
        var potion2 = new Item("Health Potion", ItemType.Consumable, stackable: true);

        inventory.AddItem(potion1);
        inventory.AddItem(potion2);

        Assert.AreEqual(1, inventory.ItemCount);  // Same slot
        Assert.AreEqual(2, inventory.GetItemStack("Health Potion").Count);
    }
}
```

### Play Mode Tests (Coroutines/Physics)

```csharp
using UnityEngine.TestTools;
using System.Collections;

public class CharacterMovementTests {
    private GameObject player;
    private CharacterController controller;

    [UnitySetUp]
    public IEnumerator Setup() {
        player = new GameObject("Player");
        controller = player.AddComponent<CharacterController>();
        player.AddComponent<PlayerMovement>();
        yield return null;
    }

    [UnityTearDown]
    public IEnumerator TearDown() {
        Object.Destroy(player);
        yield return null;
    }

    [UnityTest]
    public IEnumerator Move_Forward_MovesPlayer() {
        var startPos = player.transform.position;
        var movement = player.GetComponent<PlayerMovement>();

        movement.Move(Vector3.forward);

        // Wait for physics
        yield return new WaitForFixedUpdate();
        yield return new WaitForFixedUpdate();

        Assert.Greater(player.transform.position.z, startPos.z);
    }

    [UnityTest]
    public IEnumerator Jump_WhenGrounded_AppliesUpwardForce() {
        var movement = player.GetComponent<PlayerMovement>();
        movement.isGrounded = true;

        movement.Jump();

        yield return new WaitForFixedUpdate();

        Assert.Greater(player.GetComponent<Rigidbody>().velocity.y, 0);
    }
}
```

### Integration Tests (Scene-Based)

```csharp
public class LevelTests {
    [UnityTest]
    public IEnumerator Level1_Loads_Successfully() {
        yield return SceneManager.LoadSceneAsync("Level1");

        var player = GameObject.FindWithTag("Player");
        var spawnPoint = GameObject.FindWithTag("SpawnPoint");

        Assert.IsNotNull(player);
        Assert.IsNotNull(spawnPoint);
        Assert.AreEqual(spawnPoint.transform.position, player.transform.position);
    }

    [UnityTest]
    public IEnumerator Enemy_Dies_WhenHealthReachesZero() {
        yield return SceneManager.LoadSceneAsync("TestArena");

        var enemy = GameObject.FindWithTag("Enemy");
        var health = enemy.GetComponent<Health>();

        health.TakeDamage(health.MaxHealth);

        yield return null;  // Wait for death processing

        Assert.IsTrue(enemy == null || !enemy.activeInHierarchy);
    }
}
```

## Unreal Engine Testing

### Automation System

```cpp
// MyGameTest.cpp
#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FInventoryTest, "Game.Inventory.AddItem",
    EAutomationTestFlags::ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FInventoryTest::RunTest(const FString& Parameters) {
    UInventoryComponent* Inventory = NewObject<UInventoryComponent>();
    Inventory->MaxSlots = 10;

    FInventoryItem Item;
    Item.ItemID = "Sword";
    Item.Quantity = 1;

    bool bAdded = Inventory->AddItem(Item);

    TestTrue("Item should be added", bAdded);
    TestEqual("Inventory should have 1 item", Inventory->GetItemCount(), 1);

    return true;
}

// Latent test for async operations
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FLoadLevelTest, "Game.Level.Load",
    EAutomationTestFlags::ApplicationContextMask | EAutomationTestFlags::ProductFilter)

bool FLoadLevelTest::RunTest(const FString& Parameters) {
    ADD_LATENT_AUTOMATION_COMMAND(FLoadGameMapCommand("TestLevel"));
    ADD_LATENT_AUTOMATION_COMMAND(FWaitForMapToLoadCommand());
    ADD_LATENT_AUTOMATION_COMMAND(FVerifyPlayerSpawnedCommand());
    return true;
}
```

### Blueprint Testing

```cpp
// Test Blueprint functions
UFUNCTION(BlueprintCallable, Category = "Testing")
static bool TestDamageCalculation() {
    float Damage = UGameplayStatics::ApplyDamage(
        TestActor, 50.0f, nullptr, nullptr, nullptr);

    return FMath::IsNearlyEqual(Damage, 50.0f);
}
```

## Godot Testing

### GUT (Godot Unit Test)

```gdscript
extends GutTest

var inventory: Inventory

func before_each():
    inventory = Inventory.new()
    inventory.max_slots = 10

func test_add_item():
    var item = Item.new("Sword", Item.Type.WEAPON)

    var added = inventory.add_item(item)

    assert_true(added)
    assert_eq(inventory.item_count(), 1)

func test_inventory_full():
    for i in range(10):
        inventory.add_item(Item.new("Item%d" % i, Item.Type.MISC))

    var added = inventory.add_item(Item.new("Extra", Item.Type.MISC))

    assert_false(added)
```

## Critical Test Areas

### 1. Game Logic

```csharp
[Test]
public void DamageCalculation_WithArmor_ReducesDamage() {
    var attacker = new Character(attack: 100);
    var defender = new Character(armor: 20);

    float damage = CombatSystem.CalculateDamage(attacker, defender);

    // Damage = Attack - Armor
    Assert.AreEqual(80, damage);
}

[Test]
public void CriticalHit_DoublesBaseDamage() {
    var attacker = new Character(attack: 50, critChance: 1.0f);  // 100% crit

    float damage = CombatSystem.CalculateDamage(attacker, new Character());

    Assert.AreEqual(100, damage);  // 50 * 2
}
```

### 2. AI Behavior

```csharp
[Test]
public void Enemy_ChasesPlayer_WhenInRange() {
    var enemy = CreateEnemy(position: Vector3.zero);
    var player = CreatePlayer(position: new Vector3(5, 0, 0));  // Within chase range

    enemy.UpdateAI();

    Assert.AreEqual(AIState.Chasing, enemy.CurrentState);
}

[Test]
public void Enemy_Patrols_WhenPlayerOutOfRange() {
    var enemy = CreateEnemy(position: Vector3.zero);
    var player = CreatePlayer(position: new Vector3(100, 0, 0));  // Far away

    enemy.UpdateAI();

    Assert.AreEqual(AIState.Patrolling, enemy.CurrentState);
}
```

### 3. Save/Load Systems

```csharp
[Test]
public void SaveGame_PreservesPlayerState() {
    var gameState = new GameState {
        PlayerHealth = 75,
        PlayerPosition = new Vector3(10, 0, 5),
        InventoryItems = new List<string> { "Sword", "Shield" }
    };

    SaveSystem.Save(gameState, "test_save");
    var loaded = SaveSystem.Load("test_save");

    Assert.AreEqual(75, loaded.PlayerHealth);
    Assert.AreEqual(new Vector3(10, 0, 5), loaded.PlayerPosition);
    CollectionAssert.AreEqual(new[] { "Sword", "Shield" }, loaded.InventoryItems);
}

[Test]
public void LoadGame_HandlesCorruptedFile() {
    File.WriteAllText("corrupted_save.sav", "not valid data");

    var result = SaveSystem.Load("corrupted_save");

    Assert.IsNull(result);  // Or returns default state
}
```

### 4. Deterministic Replay

```csharp
[Test]
public void ReplaySystem_ProducesSameResult() {
    // Record inputs
    var inputRecording = new InputRecording();
    inputRecording.Add(0, InputAction.MoveForward);
    inputRecording.Add(10, InputAction.Jump);
    inputRecording.Add(50, InputAction.Attack);

    // Seed random
    Random.InitState(12345);

    // Play once
    var result1 = SimulateGame(inputRecording);

    // Reset and play again
    Random.InitState(12345);
    var result2 = SimulateGame(inputRecording);

    Assert.AreEqual(result1.FinalPosition, result2.FinalPosition);
    Assert.AreEqual(result1.Score, result2.Score);
}
```

### 5. Performance Testing

```csharp
[Test]
[Performance]
public void SpawnEnemies_StaysAbove60FPS() {
    var sw = Stopwatch.StartNew();

    for (int i = 0; i < 100; i++) {
        SpawnEnemy();
    }

    sw.Stop();
    float frameTime = sw.ElapsedMilliseconds;

    Assert.Less(frameTime, 16.67f);  // 60 FPS = 16.67ms per frame
}

[UnityTest]
public IEnumerator Level_MaintainsTargetFramerate() {
    yield return SceneManager.LoadSceneAsync("StressTestLevel");

    float totalTime = 0;
    int frameCount = 0;

    while (totalTime < 5f) {
        totalTime += Time.deltaTime;
        frameCount++;
        yield return null;
    }

    float avgFPS = frameCount / totalTime;
    Assert.Greater(avgFPS, 30f);  // Minimum 30 FPS
}
```

## Coverage Expectations

### Unit Tests (Many)
- [ ] Game logic calculations
- [ ] Inventory/item systems
- [ ] AI decision making
- [ ] Save/load serialization
- [ ] Math utilities

### Integration Tests (Medium)
- [ ] Scene loading
- [ ] System interactions
- [ ] Combat encounters
- [ ] UI state management

### E2E Tests (Few)
- [ ] Full level completion
- [ ] Save/load cycle
- [ ] Main menu flow
- [ ] Critical paths

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Testing randomness directly | Non-deterministic failures | Seed RNG, test distributions |
| Real-time waits | Slow tests | Use simulation time |
| Testing visuals only | Logic bugs hidden | Test logic separately |
| No performance tests | Launch day surprises | Profile in CI |

## Tools

| Tool | Engine | Purpose |
|------|--------|---------|
| Unity Test Framework | Unity | Unit/integration tests |
| Automation System | Unreal | Built-in testing |
| GUT | Godot | Unit testing |
| Recorded Input | Any | Replay testing |

## Test Structure

```
game/
├── Assets/
│   ├── Scripts/
│   │   ├── Inventory/
│   │   ├── Combat/
│   │   └── AI/
│   └── Tests/
│       ├── EditMode/
│       │   ├── InventoryTests.cs
│       │   └── CombatTests.cs
│       └── PlayMode/
│           ├── MovementTests.cs
│           └── LevelTests.cs
└── ProjectSettings/
```

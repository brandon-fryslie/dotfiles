# Embedded / IoT Testing Scenario

Testing firmware, hardware interfaces, and resource-constrained devices.

## Unique Challenges

Embedded systems require specialized testing approaches:
- **Hardware dependencies**: Tests may need actual hardware or simulators
- **Resource constraints**: Limited memory, no filesystem, no OS
- **Real-time requirements**: Timing-critical operations
- **Cross-compilation**: Build for different architecture than host
- **Debugging difficulty**: Limited visibility into running system

## Testing Pyramid for Embedded

```
         ╱╲
        ╱HIL╲           Hardware-in-the-loop, real device
       ╱──────╲
      ╱ Integ  ╲        Emulator/simulator, peripheral mocks
     ╱──────────╲
    ╱    Unit    ╲      Business logic, algorithms, protocols
   ╱──────────────╲
```

| Level | What to Test | Where it Runs |
|-------|--------------|---------------|
| Unit | Pure logic, algorithms | Host machine |
| Integration | HAL interactions, peripherals | Emulator/simulator |
| HIL | Full system, hardware timing | Real hardware |

## Critical Test Areas

### 1. Host-Based Unit Tests

Test pure logic on development machine (no hardware needed):

```c
// test_protocol.c - runs on host
#include "unity.h"
#include "protocol.h"

void test_parse_valid_packet(void) {
    uint8_t data[] = {0x02, 0x10, 0x20, 0x30, 0xA5};  // STX, payload, checksum
    Packet pkt;

    int result = parse_packet(data, sizeof(data), &pkt);

    TEST_ASSERT_EQUAL(0, result);
    TEST_ASSERT_EQUAL(0x10, pkt.payload[0]);
    TEST_ASSERT_EQUAL(3, pkt.length);
}

void test_parse_invalid_checksum(void) {
    uint8_t data[] = {0x02, 0x10, 0x20, 0x30, 0xFF};  // Wrong checksum

    int result = parse_packet(data, sizeof(data), NULL);

    TEST_ASSERT_EQUAL(ERR_CHECKSUM, result);
}

void test_calculate_crc16(void) {
    uint8_t data[] = {0x01, 0x02, 0x03};

    uint16_t crc = calculate_crc16(data, sizeof(data));

    TEST_ASSERT_EQUAL_HEX16(0x6131, crc);
}
```

### 2. Hardware Abstraction Layer (HAL) Mocking

```c
// Mock GPIO for unit tests
#include "fff.h"  // Fake Function Framework

DEFINE_FFF_GLOBALS;
FAKE_VOID_FUNC(GPIO_WritePin, GPIO_TypeDef*, uint16_t, GPIO_PinState);
FAKE_VALUE_FUNC(GPIO_PinState, GPIO_ReadPin, GPIO_TypeDef*, uint16_t);

void test_led_on_sets_gpio_high(void) {
    RESET_FAKE(GPIO_WritePin);

    led_on();

    TEST_ASSERT_EQUAL(1, GPIO_WritePin_fake.call_count);
    TEST_ASSERT_EQUAL(GPIO_PIN_SET, GPIO_WritePin_fake.arg2_val);
}

void test_button_pressed_returns_true_when_low(void) {
    GPIO_ReadPin_fake.return_val = GPIO_PIN_RESET;  // Active low button

    bool pressed = button_is_pressed();

    TEST_ASSERT_TRUE(pressed);
}
```

### 3. State Machine Testing

```c
void test_state_machine_transitions(void) {
    StateMachine sm;
    state_machine_init(&sm);

    TEST_ASSERT_EQUAL(STATE_IDLE, sm.current_state);

    // Event triggers transition
    state_machine_process(&sm, EVENT_START);
    TEST_ASSERT_EQUAL(STATE_RUNNING, sm.current_state);

    // Invalid event in this state
    state_machine_process(&sm, EVENT_START);  // Already running
    TEST_ASSERT_EQUAL(STATE_RUNNING, sm.current_state);  // No change

    // Stop event
    state_machine_process(&sm, EVENT_STOP);
    TEST_ASSERT_EQUAL(STATE_IDLE, sm.current_state);
}

void test_state_machine_actions_called(void) {
    StateMachine sm;
    state_machine_init(&sm);

    RESET_FAKE(motor_start);
    RESET_FAKE(motor_stop);

    state_machine_process(&sm, EVENT_START);
    TEST_ASSERT_EQUAL(1, motor_start_fake.call_count);

    state_machine_process(&sm, EVENT_STOP);
    TEST_ASSERT_EQUAL(1, motor_stop_fake.call_count);
}
```

### 4. Memory Safety Testing

```c
void test_no_buffer_overflow(void) {
    char buffer[10];

    // Should safely truncate
    int result = safe_copy(buffer, sizeof(buffer), "this is too long");

    TEST_ASSERT_EQUAL(9, result);  // Copied 9 chars + null
    TEST_ASSERT_EQUAL('\0', buffer[9]);
}

void test_handles_null_pointer(void) {
    int result = process_data(NULL, 0);

    TEST_ASSERT_EQUAL(ERR_NULL_PTR, result);
}

// Valgrind/AddressSanitizer for dynamic analysis
// Run: valgrind --leak-check=full ./test_runner
```

### 5. Timing Tests (Emulator/Simulator)

```c
// QEMU or similar emulator
void test_timer_accuracy(void) {
    timer_start(1000);  // 1000ms

    uint32_t start = get_system_ticks();
    while (!timer_expired()) {
        // Wait
    }
    uint32_t elapsed = get_system_ticks() - start;

    // Allow 5% tolerance
    TEST_ASSERT_INT_WITHIN(50, 1000, elapsed);
}

void test_interrupt_latency(void) {
    volatile uint32_t isr_timestamp = 0;

    // Set up interrupt to record timestamp
    configure_interrupt(record_timestamp, &isr_timestamp);

    uint32_t trigger_time = get_system_ticks();
    trigger_interrupt();

    // Latency should be under 10us
    uint32_t latency = isr_timestamp - trigger_time;
    TEST_ASSERT_LESS_THAN(10, latency);
}
```

### 6. Communication Protocol Testing

```c
// I2C, SPI, UART protocol tests
void test_i2c_read_register(void) {
    // Mock I2C HAL
    uint8_t expected[] = {0x42};
    I2C_Read_fake.return_val = HAL_OK;
    I2C_Read_fake.arg3_val = expected;

    uint8_t value;
    int result = sensor_read_register(SENSOR_ADDR, REG_ID, &value);

    TEST_ASSERT_EQUAL(0, result);
    TEST_ASSERT_EQUAL(0x42, value);
}

void test_uart_frame_parsing(void) {
    // Simulate receiving bytes over time
    uart_receive_byte(0x02);  // Start
    uart_receive_byte(0x05);  // Length
    uart_receive_byte(0x01);  // Command
    uart_receive_byte(0x02);  // Data
    uart_receive_byte(0x03);  // Data
    uart_receive_byte(0x04);  // Data
    uart_receive_byte(0x05);  // Data
    uart_receive_byte(0x0F);  // Checksum

    TEST_ASSERT_TRUE(frame_complete());
    Frame* f = get_frame();
    TEST_ASSERT_EQUAL(0x01, f->command);
}
```

### 7. Power Mode Testing

```c
void test_enters_low_power_mode(void) {
    // Simulate idle condition
    set_idle_timeout(100);
    simulate_idle(150);  // Exceed timeout

    TEST_ASSERT_EQUAL(POWER_MODE_SLEEP, get_power_mode());
}

void test_wakes_on_interrupt(void) {
    enter_sleep_mode();
    TEST_ASSERT_EQUAL(POWER_MODE_SLEEP, get_power_mode());

    // Simulate wake interrupt
    trigger_wake_interrupt();

    TEST_ASSERT_EQUAL(POWER_MODE_ACTIVE, get_power_mode());
}
```

### 8. Hardware-in-the-Loop (HIL)

```python
# Python test script controlling real hardware
import serial
import pytest

@pytest.fixture
def device():
    ser = serial.Serial('/dev/ttyUSB0', 115200, timeout=1)
    yield ser
    ser.close()

def test_led_command(device):
    device.write(b'LED ON\n')
    response = device.readline()
    assert response == b'OK\n'

    # Physically verify LED is on (or use light sensor)

def test_sensor_reading(device):
    device.write(b'READ TEMP\n')
    response = device.readline()

    temp = float(response.decode().strip())
    assert 15.0 <= temp <= 35.0  # Reasonable room temperature

def test_watchdog_reset(device):
    # Stop feeding watchdog
    device.write(b'STOP_WDT_FEED\n')

    # Device should reset
    time.sleep(5)

    # Try to reconnect
    device.close()
    device.open()

    # Verify boot message
    response = device.readline()
    assert b'BOOT' in response
```

## Coverage Expectations

### Unit Tests (Many, on Host)
- [ ] Protocol parsing/building
- [ ] State machines
- [ ] Algorithms
- [ ] Data structures
- [ ] Error handling

### Integration Tests (Medium, on Emulator)
- [ ] HAL interactions
- [ ] Peripheral simulation
- [ ] Timing behavior
- [ ] Communication protocols

### HIL Tests (Few, on Hardware)
- [ ] Hardware initialization
- [ ] Sensor readings
- [ ] Actuator control
- [ ] Power modes
- [ ] Full system behavior

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| All tests on hardware | Slow, hard to debug | Most tests on host |
| No HAL abstraction | Can't mock hardware | Abstract hardware interfaces |
| Ignoring memory constraints | Stack overflow in prod | Test with limited memory |
| No timing tests | Real-time failures | Test timing on emulator |
| Skipping edge cases | Field failures | Test boundary conditions |

## Tools

| Tool | Purpose |
|------|---------|
| Unity | C unit test framework |
| CMock / FFF | Mocking for C |
| Ceedling | Build/test runner for Unity |
| QEMU | ARM emulation |
| Renode | Multi-device emulation |
| Valgrind | Memory analysis |
| AddressSanitizer | Memory safety |

## Test Structure

```
firmware/
├── src/
│   ├── hal/              # Hardware abstraction
│   ├── drivers/          # Peripheral drivers
│   ├── app/              # Application logic
│   └── protocol/         # Communication protocols
├── test/
│   ├── unit/             # Host-based tests
│   │   ├── test_protocol.c
│   │   └── test_state_machine.c
│   ├── integration/      # Emulator tests
│   │   └── test_i2c_sensor.c
│   ├── hil/              # Hardware tests
│   │   └── test_full_system.py
│   └── mocks/
│       └── mock_gpio.c
├── support/
│   └── unity_config.h
└── Makefile              # Build for host and target
```

## CI Configuration

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: make test-host  # Unit tests on host

  emulator-tests:
    runs-on: ubuntu-latest
    steps:
      - run: apt-get install qemu-system-arm
      - run: make test-emulator

  hil-tests:
    runs-on: self-hosted  # With hardware attached
    steps:
      - run: make test-hil
```

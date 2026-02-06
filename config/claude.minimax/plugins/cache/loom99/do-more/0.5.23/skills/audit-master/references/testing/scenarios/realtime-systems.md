# Real-time / Event-Driven Systems Testing Scenario

Testing message queues, Kafka consumers/producers, WebSocket servers, and event-driven architectures.

## Unique Challenges

Real-time systems require testing:
- **Asynchronous behavior**: Events arrive out of order, at unpredictable times
- **Eventual consistency**: State converges over time, not immediately
- **Backpressure**: System behavior under load
- **Ordering guarantees**: Message ordering within partitions
- **Failure modes**: What happens when consumers die mid-processing

## Testing Pyramid for Real-time Systems

```
         ╱╲
        ╱E2E╲          Full system with real broker
       ╱──────╲
      ╱ Integ  ╲       Consumer/producer with test broker
     ╱──────────╲
    ╱    Unit    ╲     Message handlers, serializers
   ╱──────────────╲
```

| Level | What to Test | Infrastructure |
|-------|--------------|----------------|
| Unit | Handler logic, serialization | None |
| Integration | Produce/consume, offset management | Testcontainers/embedded |
| E2E | Full event flow, multiple services | Staging environment |

## Critical Test Areas

### 1. Message Handler Logic

```python
# Unit test - no broker needed
def test_order_handler_creates_record():
    handler = OrderHandler(mock_db)
    event = OrderCreatedEvent(order_id=123, amount=99.99)

    handler.handle(event)

    mock_db.save.assert_called_once()
    saved = mock_db.save.call_args[0][0]
    assert saved.order_id == 123
    assert saved.amount == 99.99

def test_handler_rejects_invalid_event():
    handler = OrderHandler(mock_db)
    invalid = OrderCreatedEvent(order_id=None, amount=-1)

    with pytest.raises(ValidationError):
        handler.handle(invalid)

    mock_db.save.assert_not_called()
```

### 2. Serialization/Deserialization

```python
def test_avro_serialization():
    event = UserCreated(user_id=1, email="test@test.com")
    serialized = serialize_avro(event)
    deserialized = deserialize_avro(serialized, UserCreated)

    assert deserialized.user_id == 1
    assert deserialized.email == "test@test.com"

def test_handles_schema_evolution():
    # Old message without new field
    old_bytes = b'...'  # Serialized without 'phone' field
    deserialized = deserialize_avro(old_bytes, UserCreatedV2)

    assert deserialized.phone is None  # Default for missing field

def test_rejects_incompatible_schema():
    incompatible = b'...'  # Wrong schema entirely
    with pytest.raises(SchemaError):
        deserialize_avro(incompatible, UserCreated)
```

### 3. Kafka Producer Testing

```python
from testcontainers.kafka import KafkaContainer
import pytest

@pytest.fixture(scope="module")
def kafka():
    with KafkaContainer() as kafka:
        yield kafka.get_bootstrap_server()

def test_producer_sends_message(kafka):
    producer = MyProducer(bootstrap_servers=kafka)

    producer.send("orders", OrderCreated(order_id=1))

    # Verify message arrived
    consumer = KafkaConsumer("orders", bootstrap_servers=kafka)
    messages = list(consumer.poll(timeout_ms=5000).values())
    assert len(messages) == 1

def test_producer_partitioning(kafka):
    producer = MyProducer(bootstrap_servers=kafka)

    # Same key should go to same partition
    producer.send("orders", key="user-1", value=event1)
    producer.send("orders", key="user-1", value=event2)

    # Verify same partition
    consumer = KafkaConsumer("orders", bootstrap_servers=kafka)
    messages = consumer.poll(timeout_ms=5000)
    partitions = set(msg.partition for msg in messages)
    assert len(partitions) == 1  # All in same partition
```

### 4. Kafka Consumer Testing

```python
def test_consumer_processes_message(kafka):
    # Produce test message
    produce("orders", OrderCreated(order_id=1))

    # Run consumer
    consumer = MyConsumer(bootstrap_servers=kafka)
    consumer.process_one()

    # Verify side effect
    assert db.get_order(1) is not None

def test_consumer_commits_offset_after_success(kafka):
    produce("orders", OrderCreated(order_id=1))

    consumer = MyConsumer(bootstrap_servers=kafka, group_id="test")
    consumer.process_one()

    # Verify offset committed
    offsets = consumer.committed()
    assert offsets[TopicPartition("orders", 0)].offset == 1

def test_consumer_does_not_commit_on_failure(kafka):
    produce("orders", InvalidEvent())

    consumer = MyConsumer(bootstrap_servers=kafka, group_id="test")
    with pytest.raises(ProcessingError):
        consumer.process_one()

    # Offset should NOT be committed
    offsets = consumer.committed()
    assert offsets[TopicPartition("orders", 0)] is None
```

### 5. WebSocket Testing

```python
import pytest
import websockets

@pytest.fixture
async def ws_server():
    server = await start_websocket_server(port=8765)
    yield "ws://localhost:8765"
    await server.close()

@pytest.mark.asyncio
async def test_websocket_echo(ws_server):
    async with websockets.connect(ws_server) as ws:
        await ws.send("hello")
        response = await ws.recv()
        assert response == "hello"

@pytest.mark.asyncio
async def test_websocket_broadcast(ws_server):
    async with websockets.connect(ws_server) as ws1, \
               websockets.connect(ws_server) as ws2:
        # Send from ws1
        await ws1.send(json.dumps({"type": "broadcast", "msg": "hi"}))

        # ws2 should receive
        response = await asyncio.wait_for(ws2.recv(), timeout=5)
        assert json.loads(response)["msg"] == "hi"

@pytest.mark.asyncio
async def test_websocket_reconnection(ws_server):
    async with websockets.connect(ws_server) as ws:
        await ws.send("subscribe:orders")

        # Simulate disconnect
        await ws.close()

        # Reconnect
        async with websockets.connect(ws_server) as ws2:
            await ws2.send("subscribe:orders")
            # Should receive messages again
```

### 6. Event Ordering

```python
def test_events_processed_in_order(kafka):
    # Produce ordered events
    for i in range(10):
        produce("orders", key="order-1", value=Event(seq=i))

    consumer = MyConsumer(bootstrap_servers=kafka)
    processed = []
    for _ in range(10):
        event = consumer.process_one()
        processed.append(event.seq)

    # Should be in order
    assert processed == list(range(10))

def test_handles_out_of_order_events(kafka):
    """Test idempotency when events arrive out of order."""
    produce("orders", OrderUpdated(order_id=1, version=2))
    produce("orders", OrderUpdated(order_id=1, version=1))  # Late arrival

    consumer = MyConsumer(bootstrap_servers=kafka)
    consumer.process_all()

    order = db.get_order(1)
    assert order.version == 2  # Newer version wins
```

### 7. Backpressure and Load

```python
def test_consumer_handles_backpressure(kafka):
    # Produce many messages
    for i in range(10000):
        produce("orders", Event(id=i))

    consumer = MyConsumer(
        bootstrap_servers=kafka,
        max_poll_records=100  # Process in batches
    )

    start = time.time()
    consumer.process_all()
    duration = time.time() - start

    # Should complete in reasonable time
    assert duration < 60  # Not stuck

def test_consumer_lag_monitoring(kafka):
    # Produce messages
    for i in range(1000):
        produce("orders", Event(id=i))

    consumer = MyConsumer(bootstrap_servers=kafka)
    lag = consumer.get_lag()

    assert lag["orders"] == 1000  # All messages pending
```

### 8. Dead Letter Queue

```python
def test_failed_messages_go_to_dlq(kafka):
    # Produce poison message
    produce("orders", PoisonMessage())

    consumer = MyConsumer(bootstrap_servers=kafka)

    # Should not raise, should route to DLQ
    consumer.process_one()

    # Verify DLQ
    dlq_consumer = KafkaConsumer("orders.dlq", bootstrap_servers=kafka)
    messages = list(dlq_consumer.poll(timeout_ms=5000).values())
    assert len(messages) == 1
```

## E2E Testing

```python
def test_full_event_flow():
    """Test complete flow: API → Kafka → Consumer → Database → WebSocket."""
    ws_client = websockets.connect("ws://localhost:8765")
    await ws_client.send("subscribe:orders")

    # Trigger via API
    response = requests.post("/api/orders", json={"amount": 100})
    order_id = response.json()["id"]

    # Wait for WebSocket notification
    notification = await asyncio.wait_for(ws_client.recv(), timeout=10)
    assert json.loads(notification)["order_id"] == order_id

    # Verify database updated
    order = db.get_order(order_id)
    assert order.status == "processed"
```

## Coverage Expectations

### Unit Tests (Many)
- [ ] Message handlers
- [ ] Serializers/deserializers
- [ ] Validation logic
- [ ] Retry logic
- [ ] Error classification

### Integration Tests (Medium)
- [ ] Producer sends to broker
- [ ] Consumer receives and commits
- [ ] Offset management
- [ ] Partition assignment
- [ ] Schema evolution
- [ ] Dead letter queue

### E2E Tests (Few)
- [ ] Full event flow across services
- [ ] WebSocket real-time updates
- [ ] Failure and recovery scenarios

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|--------------|---------|-----------------|
| Mocking the broker | Doesn't test real behavior | Use testcontainers |
| No ordering tests | Out-of-order bugs in prod | Test ordering guarantees |
| Ignoring offset commits | Message loss or duplicates | Test commit behavior |
| No failure injection | Unknown failure modes | Test consumer death mid-process |
| Sleeping to wait | Flaky tests | Use polling with timeout |

## Tools

| Tool | Purpose |
|------|---------|
| testcontainers-kafka | Embedded Kafka for tests |
| pytest-asyncio | Async test support |
| websockets | WebSocket client for tests |
| kafka-python | Kafka client |
| confluent-kafka | Alternative Kafka client |

## Test Structure

```
service/
├── consumers/
│   └── order_consumer.py
├── producers/
│   └── order_producer.py
├── handlers/
│   └── order_handler.py
├── tests/
│   ├── unit/
│   │   ├── test_handlers.py
│   │   └── test_serializers.py
│   ├── integration/
│   │   ├── test_producer.py
│   │   ├── test_consumer.py
│   │   └── conftest.py  # Kafka fixture
│   └── e2e/
│       └── test_event_flow.py
└── schemas/
    └── orders.avsc
```

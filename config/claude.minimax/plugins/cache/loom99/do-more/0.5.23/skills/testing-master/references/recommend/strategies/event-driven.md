# Event-Driven Testing Strategy

When to use: Message queues, event sourcing, WebSockets, pub/sub systems, real-time applications.

## The Challenge

Event-driven systems are hard to test because:

```
Producer                      Consumer
┌─────────┐                  ┌─────────┐
│ Publish │  ──Message──→    │ Process │
│ Event   │    Queue/Bus     │ Event   │
└─────────┘                  └─────────┘
    ↓                            ↓
 When?                       Did it arrive?
 In order?                   How many times?
 What if queue down?         What if duplicate?
```

## Testing Layers

### Layer 1: Message Serialization

Test that messages can be serialized/deserialized correctly.

```python
def test_event_serialization():
    event = OrderCreated(order_id="123", amount=100.0)

    # Serialize
    serialized = event.to_json()

    # Deserialize
    restored = OrderCreated.from_json(serialized)

    assert restored.order_id == "123"
    assert restored.amount == 100.0
```

### Layer 2: Producer Logic

Test that correct events are produced for given inputs.

```python
def test_order_service_emits_event(mock_publisher):
    service = OrderService(publisher=mock_publisher)

    service.create_order(user_id="user1", items=[...])

    mock_publisher.publish.assert_called_once()
    event = mock_publisher.publish.call_args[0][0]
    assert isinstance(event, OrderCreated)
    assert event.user_id == "user1"
```

### Layer 3: Consumer Logic

Test that consumers handle events correctly.

```python
def test_inventory_consumer_reserves_stock():
    consumer = InventoryConsumer(inventory=mock_inventory)
    event = OrderCreated(order_id="123", items=[
        {"sku": "ABC", "quantity": 2}
    ])

    consumer.handle(event)

    mock_inventory.reserve.assert_called_with("ABC", 2)
```

### Layer 4: Integration

Test full publish/consume cycle with real (or containerized) broker.

```python
@pytest.mark.integration
def test_event_flows_through_system(kafka_container):
    producer = KafkaProducer(kafka_container.bootstrap_servers)
    consumer = KafkaConsumer(kafka_container.bootstrap_servers)

    # Publish
    producer.send("orders", OrderCreated(order_id="123"))

    # Consume
    messages = consumer.poll(timeout=5.0)

    assert len(messages) == 1
    assert messages[0].order_id == "123"
```

## Critical Test Scenarios

### Message Ordering

```python
def test_events_processed_in_order():
    events = [
        OrderCreated(order_id="1"),
        OrderUpdated(order_id="1", status="paid"),
        OrderShipped(order_id="1")
    ]

    handler = OrderHandler()
    for event in events:
        handler.handle(event)

    order = handler.get_order("1")
    assert order.status == "shipped"
```

### Idempotency

```python
def test_duplicate_events_handled_safely():
    event = OrderCreated(order_id="123", idempotency_key="abc")
    handler = OrderHandler()

    # Process twice
    handler.handle(event)
    handler.handle(event)  # Duplicate

    # Only one order created
    assert Order.count() == 1
```

### Out-of-Order Delivery

```python
def test_out_of_order_events():
    handler = OrderHandler()

    # Receive "updated" before "created"
    handler.handle(OrderUpdated(order_id="1", status="paid"))
    handler.handle(OrderCreated(order_id="1"))

    # System should handle gracefully
    order = handler.get_order("1")
    assert order.status == "paid"
```

### Partial Failures

```python
def test_partial_failure_rollback():
    handler = OrderHandler(inventory=failing_inventory)

    with pytest.raises(InventoryError):
        handler.handle(OrderCreated(order_id="1"))

    # Event should be requeued, not lost
    assert handler.dead_letter_queue.count() == 0
    assert handler.retry_queue.count() == 1
```

### Poison Messages

```python
def test_malformed_message_goes_to_dlq():
    consumer = EventConsumer()

    # Invalid message
    consumer.receive(b"not valid json")

    assert consumer.dead_letter_queue.count() == 1
    assert consumer.processed_count == 0
```

## Test Strategies by Queue Type

### Kafka

| Scenario | Test Approach |
|----------|---------------|
| Partition ordering | Use testcontainers with single partition |
| Consumer groups | Test multiple consumers receive different messages |
| Offset management | Verify commits after successful processing |
| Rebalancing | Simulate consumer join/leave |

### RabbitMQ

| Scenario | Test Approach |
|----------|---------------|
| Routing keys | Verify correct queue receives message |
| Acknowledgments | Test ack/nack behavior |
| Dead letter | Verify DLQ receives rejected messages |
| TTL | Test message expiration |

### AWS SQS

| Scenario | Test Approach |
|----------|---------------|
| Visibility timeout | Test message reappears after timeout |
| FIFO ordering | Use FIFO queue with message groups |
| Deduplication | Verify duplicate rejection |
| Batch processing | Test partial batch success/failure |

## Testing Tools

| Tool | Use Case |
|------|----------|
| Testcontainers | Real brokers in containers |
| LocalStack | AWS SQS/SNS simulation |
| Mock libraries | Unit test producers/consumers |
| WireMock | HTTP webhook simulation |

## Recommendation Patterns

### For Gaps in Event Testing

| Gap | Recommendation |
|-----|----------------|
| No idempotency tests | Add duplicate event tests |
| No ordering tests | Add sequence tests |
| No failure tests | Add poison message tests |
| No integration tests | Add containerized broker tests |
| No replay tests | Test event replay scenarios |

### Test Coverage Matrix

```markdown
| Event Type | Serialization | Producer | Consumer | E2E |
|------------|--------------|----------|----------|-----|
| OrderCreated | ✅ | ✅ | ✅ | ❌ |
| OrderUpdated | ✅ | ❌ | ❌ | ❌ |
| PaymentReceived | ❌ | ❌ | ❌ | ❌ |
```

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Testing only happy path | Failures not handled | Test timeouts, errors, duplicates |
| Mocking the broker | Behavior differs from real | Use testcontainers |
| Ignoring ordering | Race conditions | Test specific ordering scenarios |
| No DLQ testing | Poison messages lost | Test DLQ routing |

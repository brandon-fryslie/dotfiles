/**
 * Dense Index Types for IR
 *
 * Branded types for dense numeric indices used in runtime lookups.
 * String IDs are for persistence and debugging; indices are for fast runtime access.
 *
 * NOTE: InstanceId and DomainTypeId are now defined in src/core/ids.ts.
 * This module re-exports them for backward compatibility during migration.
 */

// Re-export InstanceId and DomainTypeId from core (single source of truth)
export type { InstanceId, DomainTypeId } from '../../core/ids';
export { instanceId, domainTypeId } from '../../core/ids';

// =============================================================================
// Branded Index Types (Numeric)
// =============================================================================

/** Dense index for nodes in the NodeTable. */
export type NodeIndex = number & { readonly __brand: 'NodeIndex' };

/** Dense index for ports within a node. */
export type PortIndex = number & { readonly __brand: 'PortIndex' };


/** Dense index for value slots in the ValueStore. */
export type ValueSlot = number & { readonly __brand: 'ValueSlot' };

/** Dense index for persistent state slots (cross-frame storage). */
export type StateSlotId = number & { readonly __brand: 'StateSlotId' };

/** Dense index for steps in the Schedule. */
export type StepIndex = number & { readonly __brand: 'StepIndex' };

/** Dense index for signal expressions. */
export type SigExprId = number & { readonly __brand: 'SigExprId' };

/** Dense index for field expressions. */
export type FieldExprId = number & { readonly __brand: 'FieldExprId' };

/** Dense index for event expressions. */
export type EventExprId = number & { readonly __brand: 'EventExprId' };

/** Dense index for event slots (distinct from ValueSlot — events use boolean storage). */
export type EventSlotId = number & { readonly __brand: 'EventSlotId' };

/** Dense index for transform chains. */
export type TransformChainId = number & { readonly __brand: 'TransformChainId' };

// =============================================================================
// Branded ID Types (String)
// =============================================================================

/** Stable string ID for nodes. */
export type NodeId = string & { readonly __brand: 'NodeId' };


/** Stable string ID for schedule steps. */
export type StepId = string & { readonly __brand: 'StepId' };

/** Stable string ID for field expressions. */
export type ExprId = string & { readonly __brand: 'ExprId' };

/** Stable string ID for state bindings. */
export type StateId = string & { readonly __brand: 'StateId' };

/** Stable string ID for slots. */
export type SlotId = string & { readonly __brand: 'SlotId' };

// =============================================================================
// Factory Functions (Zero-cost casts)
// =============================================================================

export function nodeIndex(n: number): NodeIndex {
  return n as NodeIndex;
}

export function portIndex(n: number): PortIndex {
  return n as PortIndex;
}


export function valueSlot(n: number): ValueSlot {
  return n as ValueSlot;
}

/**
 * Offset a value slot by a component index.
 * Used for reading/writing individual components of multi-component values (vec2, vec3, color).
 *
 * Example:
 *   const baseSlot = allocSlot(3); // vec3
 *   const xSlot = slotOffset(baseSlot, 0);
 *   const ySlot = slotOffset(baseSlot, 1);
 *   const zSlot = slotOffset(baseSlot, 2);
 */
export function slotOffset(base: ValueSlot, offset: number): ValueSlot {
  return ((base as number) + offset) as ValueSlot;
}

export function stateSlotId(n: number): StateSlotId {
  return n as StateSlotId;
}

export function stepIndex(n: number): StepIndex {
  return n as StepIndex;
}

export function sigExprId(n: number): SigExprId {
  return n as SigExprId;
}

export function fieldExprId(n: number): FieldExprId {
  return n as FieldExprId;
}

export function eventExprId(n: number): EventExprId {
  return n as EventExprId;
}

export function eventSlotId(n: number): EventSlotId {
  return n as EventSlotId;
}

export function nodeId(s: string): NodeId {
  return s as NodeId;
}


export function stepId(s: string): StepId {
  return s as StepId;
}

export function exprId(s: string): ExprId {
  return s as ExprId;
}

export function stateId(s: string): StateId {
  return s as StateId;
}

export function slotId(s: string): SlotId {
  return s as SlotId;
}

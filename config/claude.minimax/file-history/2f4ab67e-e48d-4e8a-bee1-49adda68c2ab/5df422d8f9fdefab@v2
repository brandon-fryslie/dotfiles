/**
 * Branded ID Types
 *
 * Centralized source of truth for all branded ID types in the system.
 * Branded types provide type safety by creating nominal types from primitives.
 *
 * Contents:
 * - Branded type primitives (Brand<K, T>)
 * - Axis variable IDs (Cardinality, Temporality, Binding, Perspective, Branch)
 * - Domain/Instance IDs (DomainTypeId, InstanceId)
 * - Factory functions for creating branded IDs
 */

/**
 * Brand primitive type constructor.
 * Creates a nominal type from a base type with a unique brand tag.
 */
export type Brand<K, T extends string> = K & { readonly __brand: T };

// =============================================================================
// Axis Variable IDs
// =============================================================================

export type CardinalityVarId = Brand<string, 'CardinalityVarId'>;
export type TemporalityVarId = Brand<string, 'TemporalityVarId'>;
export type BindingVarId = Brand<string, 'BindingVarId'>;
export type PerspectiveVarId = Brand<string, 'PerspectiveVarId'>;
export type BranchVarId = Brand<string, 'BranchVarId'>;

// =============================================================================
// Domain and Instance IDs
// =============================================================================

/**
 * Stable string ID for domain types.
 * Domain types classify elements (shape, circle, control, event).
 */
export type DomainTypeId = Brand<string, 'DomainTypeId'>;

/**
 * Stable string ID for instances.
 * Instances are specific instantiations of domain types (count, layout).
 */
export type InstanceId = Brand<string, 'InstanceId'>;

// =============================================================================
// Factory Functions (Zero-cost casts)
// =============================================================================

export const cardinalityVarId = (s: string) => s as CardinalityVarId;
export const temporalityVarId = (s: string) => s as TemporalityVarId;
export const bindingVarId = (s: string) => s as BindingVarId;
export const perspectiveVarId = (s: string) => s as PerspectiveVarId;
export const branchVarId = (s: string) => s as BranchVarId;

export const domainTypeId = (s: string) => s as DomainTypeId;
export const instanceId = (s: string) => s as InstanceId;

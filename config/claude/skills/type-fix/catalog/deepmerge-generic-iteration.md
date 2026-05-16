# Example: `deepMerge` generic iteration over PowerlineConfig

Source: cc-candybar, `src/config/loader.ts`, commit prior to the fix below.
Discovered: 2026-05-15.

## What the problematic code looked like

```ts
function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    if (sourceValue !== undefined) {
      if (
        typeof sourceValue === "object" &&
        sourceValue !== null &&
        !Array.isArray(sourceValue)
      ) {
        const targetValue = result[key] || {};
        result[key] = deepMerge(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          targetValue as Record<string, any>,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sourceValue as Record<string, any>,
        ) as T[Extract<keyof T, string>];
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}
```

Call sites (all three the same shape):

```ts
config = deepMerge(config, fileConfig);
config = deepMerge(config, envConfig);
config = deepMerge(config, cliOverrides);
```

`config` is `PowerlineConfig`. The three source values are `Partial<PowerlineConfig>`. The function is generic but only ever called with this one type.

## Why it is problematic even though the typecheck technically passes

Four `any` usages and two `eslint-disable` comments live in this function. They aren't independent — they're one decision propagating:

1. `T extends Record<string, any>` adds an `any`-valued index signature so `source[key]` is indexable when `key` is `string` (which is what `for...in` produces, regardless of how `T` is typed).
2. That makes `sourceValue` and `targetValue` typed `any`.
3. The recursive call needs both arguments shaped as `Record<string, any>` to satisfy the constraint, so two `as Record<string, any>` casts (with `eslint-disable`) bridge the descent.
4. The return is then re-narrowed via `as T[Extract<keyof T, string>]`.

Each cast is the function admitting "I have lost the type." The function is doing dynamic-key tree traversal on a value whose keys are statically known. The two paradigms collide and `any` is the price.

Behavioral consequence the casts hide: the function applies one merge rule everywhere (recurse on plain objects, replace otherwise). That uniformity is unjustified per-field. For example, `themeMapping: Record<string, SegmentColorOverride>` (a runtime-keyed map) and `display: DisplayConfig` (a closed-schema config) get the same recursive treatment, even though shallow-merging the map and deep-merging the config might want different rules. The generic signature gives no place to put the per-field decision, so the decision gets made by accident.

## Broader symptoms that could indicate this sort of issue

- Any function signature like `<T extends Record<string, any>>` or `<T extends Record<string, unknown>>`
- A `for...in` over an identifier whose type is a named-property interface (not a runtime-keyed `Record<K, V>`)
- `Object.entries(x)` / `Object.keys(x)` followed by indexed access on a typed `x`, especially with a cast on either the loop variable or the indexed result
- `eslint-disable-next-line @typescript-eslint/no-explicit-any` immediately followed by `as Record<string, any>` or `as Record<string, unknown>`
- A "generic, reusable" utility function that has only one or two distinct call-site types in the entire codebase
- A function whose body does the same operation against `for...in`-iterated keys, when the type's keys are statically known

The deepest symptom: the function operates on a *typed* parameter as if its keys were *unknown*. If the keys are known statically, iterating them is the smell.

## The correct way to resolve it

Replace the generic iteration with a per-field typed merger. Each field is named explicitly. Each nested type with deep-merge semantics gets its own typed merger. Arrays and runtime-keyed maps get their merge rule chosen explicitly per field.

```ts
function mergeConfig(
  target: PowerlineConfig,
  source: Partial<PowerlineConfig>,
): PowerlineConfig {
  return {
    theme: source.theme ?? target.theme,
    style: source.style ?? target.style,
    display: source.display
      ? mergeDisplay(target.display, source.display)
      : target.display,
    colors: source.colors ?? target.colors,
    themeMapping: source.themeMapping
      ? { ...target.themeMapping, ...source.themeMapping }
      : target.themeMapping,
    hueStep: source.hueStep ?? target.hueStep,
    panel: source.panel ? mergePanel(target.panel, source.panel) : target.panel,
    budget: source.budget
      ? mergeBudget(target.budget, source.budget)
      : target.budget,
    modelContextLimits: source.modelContextLimits
      ? { ...target.modelContextLimits, ...source.modelContextLimits }
      : target.modelContextLimits,
  };
}

function mergeDisplay(
  target: DisplayConfig,
  source: Partial<DisplayConfig>,
): DisplayConfig {
  return {
    lines: source.lines ?? target.lines,
    style: source.style ?? target.style,
    charset: source.charset ?? target.charset,
    colorCompatibility: source.colorCompatibility ?? target.colorCompatibility,
    autoWrap: source.autoWrap ?? target.autoWrap,
    padding: source.padding ?? target.padding,
  };
}

function mergePanel(
  target: PanelConfig | undefined,
  source: Partial<PanelConfig>,
): PanelConfig {
  return {
    items: source.items ?? target?.items ?? [],
    separator: source.separator ?? target?.separator,
  };
}

function mergeBudget(
  target: BudgetConfig | undefined,
  source: Partial<BudgetConfig>,
): BudgetConfig {
  return {
    session: source.session
      ? mergeBudgetItem(target?.session, source.session)
      : target?.session,
    today: source.today
      ? mergeBudgetItem(target?.today, source.today)
      : target?.today,
    block: source.block
      ? mergeBudgetItem(target?.block, source.block)
      : target?.block,
  };
}

function mergeBudgetItem(
  target: BudgetItemConfig | undefined,
  source: Partial<BudgetItemConfig>,
): BudgetItemConfig {
  return {
    amount: source.amount ?? target?.amount,
    warningThreshold: source.warningThreshold ?? target?.warningThreshold,
    type: source.type ?? target?.type,
  };
}
```

Call sites become:

```ts
config = mergeConfig(config, fileConfig);
config = mergeConfig(config, envConfig);
config = mergeConfig(config, cliOverrides);
```

## Why it's correct

- Zero `any`. Zero `as` casts. Zero `eslint-disable`.
- Every field of every config type is named. The compiler enforces that adding a new field to `PowerlineConfig` (or any nested type) breaks the relevant merger and forces an explicit decision about how the new field merges. The previous version applied a default rule silently.
- The per-field merge decision is now visible in the source: `??` for last-write-wins primitives, named typed mergers for nested objects with deep-merge semantics, `{ ...target, ...source }` for runtime-keyed maps, `source.lines ?? target.lines` for arrays that should be replaced wholesale.
- The total amount of code is larger. The total amount of *implicit behavior* is zero. Verbosity is paying for the loss of the implicit-uniformity bug class.
- TypeScript handles the whole thing without a single workaround. No generic constraint, no `for...in`, no indexed access on a closed-schema type, no place where the type system was forced to pretend the keys were unknown.

## Verification

After the fix in cc-candybar:
- `pnpm typecheck` clean
- `pnpm test -- test/config.test.ts` 26/26 passing
- `pnpm lint` reports zero `no-explicit-any` and zero `no-restricted-syntax` violations from this region

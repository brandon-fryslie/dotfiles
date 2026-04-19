---
name: oscilla-naga-dsl-reference
description: Canonical reference for the oscilla-naga-shim Rust DSL (ModuleBuilder/FnBuilder/FnBodyBuilder), including WGSL mappings, Naga AST equivalents, and translation examples.
---

# Oscilla Naga DSL Reference

This document is the source-of-truth reference for the Rust helper DSL in:
- `ModuleBuilder`
- `FnBuilder`
- `FnBodyBuilder` (same helper surface as `FnBuilder` when inside `if_then`, `if_then_else`, and `loop_body` closures)

Notes:
- `Expr` means `Handle<naga::Expression>`.
- WGSL snippets below show semantic equivalents. Naga may emit formatting/parens differently.
- For builder-only functions (`new`, `finish`, type/global registration), "WGSL" means "module/function structure produced", not a single expression.

## ModuleBuilder

| Function (args) | WGSL/Module effect | Use this when WGSL looks like | Naga AST it simplifies | DSL example |
|---|---|---|---|---|
| `new()` | Start empty module | N/A | `naga::Module::default()` | `let mut m = ModuleBuilder::new();` |
| `finish()` | Final module | Entire shader module | Return assembled `naga::Module` | `let module = m.finish();` |
| `scalar_type(kind)` | scalar type (`f32/u32/i32/bool`) | `f32` / `u32` / `i32` / `bool` types | `TypeInner::Scalar` | `let f32_ty = m.scalar_type(naga::ScalarKind::Float);` |
| `atomic_type(kind)` | atomic scalar type | `atomic<u32>` / `atomic<i32>` | `TypeInner::Atomic` | `let a_ty = m.atomic_type(naga::ScalarKind::Uint);` |
| `f32_type()` | `f32` type | `f32` | `TypeInner::Scalar(Float)` | `let f32_ty = m.f32_type();` |
| `i32_type()` | `i32` type | `i32` | `TypeInner::Scalar(Sint)` | `let i32_ty = m.i32_type();` |
| `u32_type()` | `u32` type | `u32` | `TypeInner::Scalar(Uint)` | `let u32_ty = m.u32_type();` |
| `vector_type(size, kind)` | vector type | `vec2<f32>`, `vec3<u32>`, etc. | `TypeInner::Vector` | `let v2f = m.vector_type(naga::VectorSize::Bi, naga::ScalarKind::Float);` |
| `vec4_f32_type()` | `vec4<f32>` | `vec4<f32>` | `TypeInner::Vector(Quad, Float)` | `let v4 = m.vec4_f32_type();` |
| `array_type(base, size, stride)` | array type | `array<T>` / `array<T,N>` | `TypeInner::Array` | `let arr = m.array_type(f32_ty, None, 4);` |
| `add_global_storage(name, ty, group, binding, access)` | storage global | `@group(g) @binding(b) var<storage,...> name: ...;` | `GlobalVariable { space: Storage{...} }` | `let arena = m.add_global_storage("arena", arr, 0, 0, naga::StorageAccess::LOAD | naga::StorageAccess::STORE);` |
| `add_global_uniform(name, ty, group, binding)` | uniform global | `@group(g) @binding(b) var<uniform> name: ...;` | `GlobalVariable { space: Uniform }` | `let uniforms = m.add_global_uniform("uniforms", u_arr, 0, 4);` |
| `add_global_handle(name, ty, group, binding)` | handle global (textures/samplers) | `var tex: texture_2d<f32>;` / `var samp: sampler;` | `GlobalVariable { space: Handle }` | `let tex = m.add_global_handle("sampled_image", img_ty, 0, 6);` |
| `sampler_type(comparison)` | sampler type | `sampler` / `sampler_comparison` | `TypeInner::Sampler` | `let s_ty = m.sampler_type(false);` |
| `image_type(dim, arrayed, class)` | image type | `texture_2d<f32>`, `texture_storage_2d<...>` | `TypeInner::Image` | `let img_ty = m.image_type(naga::ImageDimension::D2, false, naga::ImageClass::Sampled { kind: naga::ScalarKind::Float, multi: false });` |
| `add_compute_entry(name, workgroup_size, function)` | compute entry point | `@compute @workgroup_size(x,y,z)` | `EntryPoint { stage: Compute }` | `m.add_compute_entry("compute_main", [64,1,1], f);` |
| `add_vertex_entry(name, function)` | vertex entry point | `@vertex fn ...` | `EntryPoint { stage: Vertex }` | `m.add_vertex_entry("vertex_main", f);` |
| `add_fragment_entry(name, function)` | fragment entry point | `@fragment fn ...` | `EntryPoint { stage: Fragment }` | `m.add_fragment_entry("fragment_main", f);` |

## FnBuilder / FnBodyBuilder

`FnBuilder` is used at function root. `FnBodyBuilder` is passed to control-flow closures and has the same helper methods.

### Function lifecycle and globals

| Function (args) | WGSL/Module effect | Use this when WGSL looks like | Naga AST it simplifies | DSL example |
|---|---|---|---|---|
| `new(name)` | start function | `fn name(...) { ... }` | `naga::Function { name: Some(...) }` | `let mut f = FnBuilder::new("compute_main");` |
| `finish()` | finalize function body | close `fn` body | flush emits + assign body | `let func = f.finish();` |
| `set_uniform_source(uniform_source)` | select base uniform pointer for `load_uniform` | `uniforms[...]` reads | set internal uniform source handle | `f.set_uniform_source(uniforms_expr);` |
| `global(handle)` | global var expression | `arena` / `uniforms` / `texture` identifiers | `Expression::GlobalVariable` | `let arena = f.global(arena_gv);` |

### Literals and casts

| Function (args) | WGSL | Use when WGSL string has | Naga AST it simplifies | DSL example |
|---|---|---|---|---|
| `lit_f32(v)` | `v` (`f32`) | `1.0`, `0.25` | `Expression::Literal(F32)` | `let one = f.lit_f32(1.0);` |
| `lit_u32(v)` | `vu` | `1u`, `64u` | `Expression::Literal(U32)` | `let lane = f.lit_u32(1);` |
| `lit_i32(v)` | `v` (`i32`) | `0`, `-1` | `Expression::Literal(I32)` | `let x = f.lit_i32(0);` |
| `lit_bool(v)` | `true` / `false` | `if (true)` | `Expression::Literal(Bool)` | `let t = f.lit_bool(true);` |
| `f32(e)` | `f32(e)` | `f32(gid.x)` | `Expression::As { kind: Float }` | `let lane_f = f.f32(lane_u);` |
| `u32(e)` | `u32(e)` | `u32(x)` | `Expression::As { kind: Uint }` | `let x_u = f.u32(x_f);` |
| `i32(e)` | `i32(e)` | `i32(x)` | `Expression::As { kind: Sint }` | `let x_i = f.i32(x_u);` |

### Arithmetic and comparisons

| Function (args) | WGSL | Use when WGSL string has | Naga AST it simplifies | DSL example |
|---|---|---|---|---|
| `add(a,b)` | `(a + b)` | `a + b` | `Binary(Add)` | `let s = f.add(a,b);` |
| `sub(a,b)` | `(a - b)` | `a - b` | `Binary(Subtract)` | `let d = f.sub(a,b);` |
| `mul(a,b)` | `(a * b)` | `a * b` | `Binary(Multiply)` | `let p = f.mul(a,b);` |
| `div(a,b)` | `(a / b)` | `a / b` | `Binary(Divide)` | `let q = f.div(a,b);` |
| `modulo(a,b)` | `(a % b)` | `a % b` | `Binary(Modulo)` | `let m = f.modulo(a,b);` |
| `neg(a)` | `(-a)` | `-a` | `Unary(Negate)` | `let n = f.neg(a);` |
| `lt(a,b)` | `(a < b)` | `a < b` | `Binary(Less)` | `let c = f.lt(a,b);` |
| `le(a,b)` | `(a <= b)` | `a <= b` | `Binary(LessEqual)` | `let c = f.le(a,b);` |
| `gt(a,b)` | `(a > b)` | `a > b` | `Binary(Greater)` | `let c = f.gt(a,b);` |
| `ge(a,b)` | `(a >= b)` | `a >= b` | `Binary(GreaterEqual)` | `let c = f.ge(a,b);` |
| `eq(a,b)` | `(a == b)` | `a == b` | `Binary(Equal)` | `let c = f.eq(a,b);` |
| `ne(a,b)` | `(a != b)` | `a != b` | `Binary(NotEqual)` | `let c = f.ne(a,b);` |

### Math functions

| Function (args) | WGSL | Use when WGSL string has | Naga AST it simplifies | DSL example |
|---|---|---|---|---|
| `sin(a)` | `sin(a)` | `sin(x)` | `Math(Sin)` | `let y = f.sin(x);` |
| `cos(a)` | `cos(a)` | `cos(x)` | `Math(Cos)` | `let y = f.cos(x);` |
| `tan(a)` | `tan(a)` | `tan(x)` | `Math(Tan)` | `let y = f.tan(x);` |
| `floor(a)` | `floor(a)` | `floor(x)` | `Math(Floor)` | `let y = f.floor(x);` |
| `ceil(a)` | `ceil(a)` | `ceil(x)` | `Math(Ceil)` | `let y = f.ceil(x);` |
| `round(a)` | `round(a)` | `round(x)` | `Math(Round)` | `let y = f.round(x);` |
| `trunc(a)` | `trunc(a)` | `trunc(x)` | `Math(Trunc)` | `let y = f.trunc(x);` |
| `abs(a)` | `abs(a)` | `abs(x)` | `Math(Abs)` | `let y = f.abs(x);` |
| `sqrt(a)` | `sqrt(a)` | `sqrt(x)` | `Math(Sqrt)` | `let y = f.sqrt(x);` |
| `clamp(v,lo,hi)` | `clamp(v, lo, hi)` | `clamp(x,0.0,1.0)` | `Math(Clamp)` | `let y = f.clamp(v,lo,hi);` |
| `min(a,b)` | `min(a,b)` | `min(a,b)` | `Math(Min)` | `let y = f.min(a,b);` |
| `max(a,b)` | `max(a,b)` | `max(a,b)` | `Math(Max)` | `let y = f.max(a,b);` |
| `pow(a,b)` | `pow(a,b)` | `pow(x,y)` | `Math(Pow)` | `let y = f.pow(a,b);` |
| `fract(a)` | `fract(a)` | `fract(x)` | `Math(Fract)` | `let y = f.fract(x);` |
| `exp(a)` | `exp(a)` | `exp(x)` | `Math(Exp)` | `let y = f.exp(x);` |
| `log(a)` | `log(a)` | `log(x)` | `Math(Log)` | `let y = f.log(x);` |
| `sign(a)` | `sign(a)` | `sign(x)` | `Math(Sign)` | `let y = f.sign(x);` |
| `atan2(y,x)` | `atan2(y,x)` | `atan2(y,x)` | `Math(Atan2)` | `let a = f.atan2(y,x);` |

### Composite values and access

| Function (args) | WGSL | Use when WGSL string has | Naga AST it simplifies | DSL example |
|---|---|---|---|---|
| `compose(ty, components)` | constructor | `vec2<f32>(x,y)`, `vec4<f32>(...)` | `Expression::Compose` | `let uv = f.compose(vec2_f32_ty, vec![u,v]);` |
| `access(base,index)` | `base[index]` pointer/indexing | `buffer[idx]`, `arr[i]` | `Expression::Access` | `let ptr = f.access(buf, idx);` |
| `access_index(base,index)` | `base.x/.y/.z/.w` or fixed field index | `v.x`, `v.y` | `Expression::AccessIndex` | `let x = f.access_index(v,0);` |

### Buffers, uniforms, and slots

| Function (args) | WGSL | Use when WGSL string has | Naga AST it simplifies | DSL example |
|---|---|---|---|---|
| `load_buffer(buffer,index)` | `buffer[index]` read | `let x = arena[idx];` | `Access + Load` | `let x = f.load_buffer(arena, idx);` |
| `store_buffer(buffer,index,value)` | `buffer[index] = value;` | `arena[idx] = v;` | `Access + Store` | `f.store_buffer(arena, idx, v);` |
| `buffer_address(base,lane,lane_stride,component,component_stride)` | `base + lane*lane_stride + component*component_stride` | index math string boilerplate | `Binary(Add/Mul)` chain | `let addr = f.buffer_address(10, lane, 4, 2, 8);` |
| `load_slot(buffer, base, lane, lane_stride, component, component_stride)` | `buffer[buffer_address(...)]` read | symbolic slot read formula | `buffer_address + load_buffer` | `let x = f.load_slot(arena, 0, lane, 4, 0, 4);` |
| `store_slot(buffer, base, lane, lane_stride, component, component_stride, value)` | `buffer[buffer_address(...)] = value;` | symbolic slot store formula | `buffer_address + store_buffer` | `f.store_slot(arena, 8, lane, 4, 0, 4, v);` |
| `load_uniform(vec4_index, component)` | `uniforms[vec4_index][component]` | `uniforms[i].x` style reads | `Access + AccessIndex + Load` | `let t = f.load_uniform(0,1);` |

### Selection and utility composites

| Function (args) | WGSL | Use when WGSL string has | Naga AST it simplifies | DSL example |
|---|---|---|---|---|
| `select(cond, accept, reject)` | ternary-like select | `cond ? t : f` semantics | `Expression::Select` | `let v = f.select(cond, on_true, on_false);` |
| `fma(a,b,c)` | `fma(a,b,c)` semantic helper (current lowering computes `a*b+c`) | multiply-add patterns | `mul + add` composition | `let y = f.fma(a,b,c);` |
| `mix(a,b,t)` | `mix(a,b,t)` semantic helper (current lowering computes `a + (b-a)*t`) | interpolation patterns | `sub + mul + add` | `let y = f.mix(a,b,t);` |
| `saturate(v)` | `clamp(v,0.0,1.0)` | clamping to unit interval | `clamp + literals` | `let y = f.saturate(v);` |
| `remap01(v,lo,hi)` | `(v - lo) / (hi - lo)` | normalization from arbitrary range | `sub + sub + div` | `let y = f.remap01(v, lo, hi);` |
| `bool_to_f32(cond)` | `cond ? 1.0 : 0.0` | bool-to-float mask conversion | `select + literals` | `let m = f.bool_to_f32(cond);` |

### Textures and samplers

| Function (args) | WGSL | Use when WGSL string has | Naga AST it simplifies | DSL example |
|---|---|---|---|---|
| `texture_sample(image,sampler,coordinate)` | `textureSample(image, sampler, coordinate)` | implicit-lod sampling | `Expression::ImageSample { level: Auto }` | `let c = f.texture_sample(tex, samp, uv);` |
| `texture_sample_level(image,sampler,coordinate,level)` | `textureSampleLevel(image, sampler, coordinate, level)` | explicit-lod sampling | `Expression::ImageSample { level: Exact(level) }` | `let c = f.texture_sample_level(tex, samp, uv, lod);` |
| `texture_load(image,coordinate,level)` | `textureLoad(image, coordinate, level?)` | integer texel loads | `Expression::ImageLoad` | `let t = f.texture_load(storage_tex, coord, None);` |
| `texture_store(image,coordinate,value)` | `textureStore(image, coordinate, value)` | texel stores | `Statement::ImageStore` | `f.texture_store(storage_tex, coord, value);` |

### Control flow and statements

| Function (args) | WGSL | Use when WGSL string has | Naga AST it simplifies | DSL example |
|---|---|---|---|---|
| `if_then(cond, body)` | `if (cond) { ... }` | single-branch conditional | `Statement::If` with empty reject | `f.if_then(cond, |b| { b.store_buffer(...); });` |
| `if_then_else(cond,accept,reject)` | `if (cond) { ... } else { ... }` | two-branch conditional | `Statement::If` | `f.if_then_else(cond, |a| {...}, |r| {...});` |
| `loop_body(body)` | `loop { ... }` | explicit loop blocks | `Statement::Loop` | `f.loop_body(|b| { ... });` |
| `break_if(cond)` | `break if cond;` loop break condition | structured loop exits | `Loop.break_if = Some(cond)` | `b.break_if(done);` |
| `emit_break()` | `break;` | immediate loop/switch exit | `Statement::Break` | `b.emit_break();` |
| `emit_continue()` | `continue;` | continue current loop | `Statement::Continue` | `b.emit_continue();` |
| `emit_return()` | `return;` | function early return | `Statement::Return { None }` | `f.emit_return();` |

### Synchronization and atomics

| Function (args) | WGSL | Use when WGSL string has | Naga AST it simplifies | DSL example |
|---|---|---|---|---|
| `storage_barrier()` | `storageBarrier();` | storage memory ordering | `Statement::Barrier(STORAGE)` | `f.storage_barrier();` |
| `workgroup_barrier()` | `workgroupBarrier();` | workgroup synchronization | `Statement::Barrier(WORK_GROUP)` | `f.workgroup_barrier();` |
| `atomic_add(pointer,value,result_type)` | `atomicAdd(ptr, value)` | atomic increments/adds | `Expression::AtomicResult + Statement::Atomic(Add)` | `let prev = f.atomic_add(ptr, one, u32_ty);` |
| `atomic_exchange(pointer,value,result_type)` | `atomicExchange(ptr, value)` | atomic swaps | `Expression::AtomicResult + Statement::Atomic(Exchange)` | `let prev = f.atomic_exchange(ptr, v, u32_ty);` |

## Pattern examples (larger chunks)

## Chunk A: Symbolic slot read/write + arithmetic

### WGSL
```wgsl
let lane: u32 = global_id.x;
let addr: u32 = 10u + lane * 4u + 2u * 8u;
let x: f32 = arena[addr];
arena[addr] = clamp(sin(f32(lane)) + cos(f32(lane)), 0.0, 1.0);
return;
```

### Equivalent Naga AST (shape)
```rust
let lane = expressions.append(Expression::AccessIndex { base: global_id, index: 0 }, ...);
let addr = expressions.append(Expression::Binary { op: Add, left: base_plus_lane, right: component_term }, ...);
let x_ptr = expressions.append(Expression::Access { base: arena, index: addr }, ...);
let x = expressions.append(Expression::Load { pointer: x_ptr }, ...);
let lane_f = expressions.append(Expression::As { expr: lane, kind: Float, convert: Some(4) }, ...);
let sin_lane = expressions.append(Expression::Math { fun: Sin, arg: lane_f, arg1: None, arg2: None, arg3: None }, ...);
let cos_lane = expressions.append(Expression::Math { fun: Cos, arg: lane_f, arg1: None, arg2: None, arg3: None }, ...);
let sum = expressions.append(Expression::Binary { op: Add, left: sin_lane, right: cos_lane }, ...);
let clamped = expressions.append(Expression::Math { fun: Clamp, arg: sum, arg1: Some(zero), arg2: Some(one), arg3: None }, ...);
block.push(Statement::Store { pointer: x_ptr, value: clamped }, ...);
block.push(Statement::Return { value: None }, ...);
```

### DSL
```rust
let lane = fb.access_index(global_id, 0);
let addr = fb.buffer_address(10, lane, 4, 2, 8);
let _x = fb.load_buffer(arena, addr);
let lane_f = fb.f32(lane);
let sum = fb.add(fb.sin(lane_f), fb.cos(lane_f));
fb.store_buffer(arena, addr, fb.clamp(sum, fb.lit_f32(0.0), fb.lit_f32(1.0)));
fb.emit_return();
```

## Chunk B: Texture + atomic + barriers

### WGSL
```wgsl
let coord = vec2<i32>(0, 0);
let texel = textureLoad(storage_image, coord);
textureStore(storage_image, coord, texel);
storageBarrier();
workgroupBarrier();
let prev = atomicAdd(&atomic_words[0u], 1u);
let prev2 = atomicExchange(&atomic_words[0u], 2u);
arena[17u] = f32(prev + prev2);
return;
```

### Equivalent Naga AST (shape)
```rust
let coord = Expression::Compose { ty: vec2_i32, components: vec![zero_i, zero_i] };
let texel = Expression::ImageLoad { image: storage_image, coordinate: coord, array_index: None, sample: None, level: None };
Statement::ImageStore { image: storage_image, coordinate: coord, array_index: None, value: texel };
Statement::Barrier(Barrier::STORAGE);
Statement::Barrier(Barrier::WORK_GROUP);
let ptr = Expression::Access { base: atomic_words, index: zero_u };
let res1 = Expression::AtomicResult { ty: u32_ty, comparison: false };
Statement::Atomic { pointer: ptr, fun: AtomicFunction::Add, value: one_u, result: res1 };
let res2 = Expression::AtomicResult { ty: u32_ty, comparison: false };
Statement::Atomic { pointer: ptr, fun: AtomicFunction::Exchange { compare: None }, value: two_u, result: res2 };
```

### DSL
```rust
let coord = fb.compose(vec2_i32_ty, vec![fb.lit_i32(0), fb.lit_i32(0)]);
let texel = fb.texture_load(storage_image, coord, None);
fb.texture_store(storage_image, coord, texel);
fb.storage_barrier();
fb.workgroup_barrier();

let ptr = fb.access(atomic_words, fb.lit_u32(0));
let prev = fb.atomic_add(ptr, fb.lit_u32(1), u32_ty);
let prev2 = fb.atomic_exchange(ptr, fb.lit_u32(2), u32_ty);
fb.store_buffer(arena, fb.lit_u32(17), fb.f32(fb.add(prev, prev2)));
fb.emit_return();
```

## Quick conversion cheat sheet

- If WGSL string has `a + b`, use `add(a,b)`.
- If WGSL string has `textureSampleLevel(...)`, use `texture_sample_level(...)`.
- If WGSL string has `base + lane*stride + comp*stride`, use `buffer_address(...)`.
- If Naga AST code is repeating `Expression::Access + Expression::Load`, use `load_buffer(...)`.
- If Naga AST code is repeating `Expression::Math { fun: Clamp ... }` with `0.0/1.0`, use `saturate(...)`.
- If Naga AST code is repeating `AtomicResult + Statement::Atomic`, use `atomic_add(...)` / `atomic_exchange(...)`.

#!/usr/bin/env node
/**
 * find-near-match-versions.mjs
 *
 * Build ranked near-match candidates for detected dependencies.
 *
 * Usage:
 *   node find-near-match-versions.mjs --deps deps/detected-dependencies.json --app-dir resources/app --out deps/near-matches.json
 *
 * Optional:
 *   --registry-file <json>   (test/offline fixture: {"pkg":["1.2.3", ...]})
 *
 * // [LAW:verifiable-goals] Emits deterministic candidate rankings with explicit evidence and recommendation.
 * // [LAW:one-source-of-truth] near-matches.json is the canonical candidate source for dependency trial decisions.
 * // [LAW:dataflow-not-control-flow] All packages run through the same fixed scoring pipeline.
 */

import fs from "fs";
import path from "path";
import process from "process";
import { spawnSync } from "child_process";

function parseArgs(argv) {
  const opts = {
    deps: "deps/detected-dependencies.json",
    appDir: "resources/app",
    out: "deps/near-matches.json",
    registryFile: "",
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--deps") opts.deps = argv[++i] || opts.deps;
    else if (arg === "--app-dir") opts.appDir = argv[++i] || opts.appDir;
    else if (arg === "--out") opts.out = argv[++i] || opts.out;
    else if (arg === "--registry-file") opts.registryFile = argv[++i] || "";
    else if (arg === "-h" || arg === "--help") return { help: true, opts };
  }

  return { help: false, opts };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function parseSemver(version) {
  if (typeof version !== "string") return null;
  const main = version.trim().split("-")[0].split("+")[0];
  const parts = main.split(".");
  if (parts.length !== 3) return null;
  const [majorStr, minorStr, patchStr] = parts;
  if (!/^\d+$/.test(majorStr) || !/^\d+$/.test(minorStr) || !/^\d+$/.test(patchStr)) return null;
  return {
    major: Number(majorStr),
    minor: Number(minorStr),
    patch: Number(patchStr),
    normalized: `${Number(majorStr)}.${Number(minorStr)}.${Number(patchStr)}`,
  };
}

function compareSemverDesc(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a && !b) return right.localeCompare(left);
  if (!a) return 1;
  if (!b) return -1;
  if (a.major !== b.major) return b.major - a.major;
  if (a.minor !== b.minor) return b.minor - a.minor;
  if (a.patch !== b.patch) return b.patch - a.patch;
  return right.localeCompare(left);
}

function npmViewVersions(pkgName) {
  const result = spawnSync("npm", ["view", pkgName, "versions", "--json"], {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return { ok: false, versions: [], error: result.stderr?.trim() || result.stdout?.trim() || "npm view failed" };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    if (Array.isArray(parsed)) {
      return { ok: true, versions: parsed.filter((item) => typeof item === "string") };
    }
    if (typeof parsed === "string") {
      return { ok: true, versions: [parsed] };
    }
    return { ok: true, versions: [] };
  } catch (error) {
    return { ok: false, versions: [], error: String(error?.message || error) };
  }
}

function collectPackageContexts(report) {
  const byName = new Map();

  function ensure(name) {
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        observedVersion: null,
        onDiskVersion: null,
        codeSpecifierCount: 0,
        moduleHits: 0,
        signals: new Set(),
        licenseVersions: new Set(),
        hashMatchVersions: new Set(),
      });
    }
    return byName.get(name);
  }

  for (const pkg of report?.onDisk?.packages || []) {
    if (!pkg?.name) continue;
    const ctx = ensure(pkg.name);
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      ctx.onDiskVersion = pkg.version;
      ctx.observedVersion = pkg.version;
    }
  }

  const bareSpecifiers = report?.code?.bareSpecifiers || {};
  for (const [pkgName, meta] of Object.entries(bareSpecifiers)) {
    const ctx = ensure(pkgName);
    ctx.codeSpecifierCount += Number(meta?.count || 0);
  }

  for (const bundle of report?.bundles || []) {
    for (const module of bundle?.modules || []) {
      if (!module?.package) continue;
      const ctx = ensure(module.package);
      ctx.moduleHits += 1;

      if (!ctx.observedVersion && typeof module.version === "string" && module.version.length > 0) {
        ctx.observedVersion = module.version;
      }

      if (module.signal) ctx.signals.add(module.signal);

      for (const evidence of module.evidence || []) {
        if (!evidence || evidence.package !== module.package) continue;
        if (evidence.signal) ctx.signals.add(evidence.signal);
        if (evidence.signal === "license" && typeof evidence.detail === "string" && parseSemver(evidence.detail)) {
          ctx.licenseVersions.add(parseSemver(evidence.detail).normalized);
        }
      }

      for (const item of module.hashMatchPackages || []) {
        const marker = `${module.package}@`;
        const pos = String(item).indexOf(marker);
        if (pos === -1) continue;
        const versionPart = String(item).slice(pos + marker.length).split(":")[0];
        const parsed = parseSemver(versionPart);
        if (parsed) ctx.hashMatchVersions.add(parsed.normalized);
      }
    }
  }

  const out = Array.from(byName.values()).map((ctx) => ({
    name: ctx.name,
    observedVersion: ctx.observedVersion,
    onDiskVersion: ctx.onDiskVersion,
    codeSpecifierCount: ctx.codeSpecifierCount,
    moduleHits: ctx.moduleHits,
    signals: Array.from(ctx.signals).sort(),
    licenseVersions: Array.from(ctx.licenseVersions).sort(compareSemverDesc),
    hashMatchVersions: Array.from(ctx.hashMatchVersions).sort(compareSemverDesc),
  }));

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function scoreCandidate(candidateVersion, observedVersion, ctx) {
  const reasons = [];
  let score = 0;

  const parsedObserved = parseSemver(observedVersion);
  const parsedCandidate = parseSemver(candidateVersion);

  if (parsedObserved && parsedCandidate && parsedObserved.normalized === parsedCandidate.normalized) {
    score += 100;
    reasons.push("exact-observed-version");
  }

  if (parsedObserved && parsedCandidate) {
    const patchDistance = Math.abs(parsedObserved.patch - parsedCandidate.patch);
    score += Math.max(0, 60 - patchDistance * 8);
    reasons.push(`patch-distance:${patchDistance}`);
  }

  if (ctx.licenseVersions.includes(candidateVersion)) {
    score += 18;
    reasons.push("license-version-signal");
  }

  if (ctx.hashMatchVersions.includes(candidateVersion)) {
    score += 18;
    reasons.push("shape-hash-version-signal");
  }

  if (ctx.moduleHits > 0) {
    const moduleBonus = Math.min(12, ctx.moduleHits);
    score += moduleBonus;
    reasons.push(`module-hit-count:${ctx.moduleHits}`);
  }

  if (ctx.codeSpecifierCount > 0) {
    const specifierBonus = Math.min(8, ctx.codeSpecifierCount);
    score += specifierBonus;
    reasons.push(`bare-specifier-count:${ctx.codeSpecifierCount}`);
  }

  const risk =
    parsedObserved && parsedCandidate && parsedObserved.normalized === parsedCandidate.normalized
      ? "low"
      : score >= 90
        ? "medium"
        : "high";

  return {
    version: candidateVersion,
    score,
    reasons,
    risk,
  };
}

function rankCandidates(ctx, registryVersions) {
  const observed = parseSemver(ctx.observedVersion || "");
  if (!observed) return [];

  const filtered = [];
  for (const version of registryVersions) {
    const parsed = parseSemver(version);
    if (!parsed) continue;
    if (parsed.major !== observed.major || parsed.minor !== observed.minor) continue;
    filtered.push(parsed.normalized);
  }

  filtered.push(observed.normalized);
  const unique = Array.from(new Set(filtered));

  const scored = unique.map((version) => scoreCandidate(version, observed.normalized, ctx));
  scored.sort((a, b) => b.score - a.score || compareSemverDesc(a.version, b.version));

  return scored;
}

function main() {
  const { help, opts } = parseArgs(process.argv);
  if (help) {
    console.log(
      "Usage: node find-near-match-versions.mjs --deps deps/detected-dependencies.json --app-dir resources/app --out deps/near-matches.json [--registry-file versions.json]",
    );
    process.exit(0);
  }

  const projectRoot = process.cwd();
  const depsPath = path.resolve(projectRoot, opts.deps);
  const appDir = path.resolve(projectRoot, opts.appDir);
  const outPath = path.resolve(projectRoot, opts.out);

  if (!fs.existsSync(depsPath)) {
    console.error(`Dependency report missing: ${depsPath}`);
    process.exit(2);
  }

  const report = readJson(depsPath);
  const packageContexts = collectPackageContexts(report);
  const registryFixture = opts.registryFile ? readJson(path.resolve(projectRoot, opts.registryFile)) : null;

  let degradedMode = false;
  const degradedReasons = [];
  const packages = [];

  for (const ctx of packageContexts) {
    const observed = parseSemver(ctx.observedVersion || "")?.normalized || null;

    let versions = [];
    let source = "registry";
    if (registryFixture && Array.isArray(registryFixture[ctx.name])) {
      versions = registryFixture[ctx.name].filter((item) => typeof item === "string");
      source = "fixture";
    } else {
      const registryResult = npmViewVersions(ctx.name);
      if (!registryResult.ok) {
        degradedMode = true;
        degradedReasons.push({ package: ctx.name, reason: registryResult.error });
        versions = observed ? [observed] : [];
        source = "degraded-local";
      } else {
        versions = registryResult.versions;
      }
    }

    const candidates = observed ? rankCandidates(ctx, versions) : [];

    const recommendation =
      !observed || candidates.length === 0
        ? "no-safe-near-match"
        : candidates[0].version === observed
          ? "exact"
          : "near-match";

    const packageResult = {
      name: ctx.name,
      observedVersion: observed,
      recommendation,
      rankingEvidence: {
        source,
        moduleHits: ctx.moduleHits,
        codeSpecifierCount: ctx.codeSpecifierCount,
        signals: ctx.signals,
        licenseVersions: ctx.licenseVersions,
        hashMatchVersions: ctx.hashMatchVersions,
      },
      candidates,
      bestCandidate: candidates[0] || null,
    };

    packages.push(packageResult);
  }

  const unresolved = packages
    .filter((item) => item.recommendation === "no-safe-near-match")
    .map((item) => item.name)
    .sort((a, b) => a.localeCompare(b));

  const payload = {
    generatedAt: new Date().toISOString(),
    depsFile: path.relative(projectRoot, depsPath).split(path.sep).join("/"),
    appDir: path.relative(projectRoot, appDir).split(path.sep).join("/"),
    policy: {
      nearMatchRange: "patch-only",
      trialMode: "auto-iterate-gated",
    },
    degradedMode,
    degradedReasons,
    packages,
    unresolved,
    summary: {
      totalPackages: packages.length,
      exactRecommendations: packages.filter((item) => item.recommendation === "exact").length,
      nearMatchRecommendations: packages.filter((item) => item.recommendation === "near-match").length,
      unresolvedRecommendations: unresolved.length,
    },
  };

  writeJson(outPath, payload);
  console.log(`Wrote ${path.relative(projectRoot, outPath)}`);
  console.log(`- packages: ${payload.summary.totalPackages}`);
  console.log(`- exact: ${payload.summary.exactRecommendations}`);
  console.log(`- near-match: ${payload.summary.nearMatchRecommendations}`);
  console.log(`- unresolved: ${payload.summary.unresolvedRecommendations}`);
  console.log(`- degraded mode: ${payload.degradedMode ? "yes" : "no"}`);
}

main();

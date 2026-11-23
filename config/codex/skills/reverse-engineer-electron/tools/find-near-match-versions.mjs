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
import { isNonEmptyString, JSON_SHAPE } from "./json-value.mjs";
import { readJson } from "./path-state.mjs";

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

// The JSON object an input file holds; one that is missing or can't be used stops the run, naming the file and why.
function readInput(filePath, what) {
  const read = readJson(filePath, JSON_SHAPE.object);
  if (read.kind === "json") return read.value;
  console.error(`${what} ${filePath} ${read.reason}`);
  process.exit(2);
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

// [LAW:parse-dont-validate] The one reader of detect-dependencies' onDisk section: the copies replace-dependency can
// trial, each with a name, a version and a location, or why the report holds no such list. Only a node_modules
// detect-dependencies listed in full, or one the app doesn't ship, lists every trialable copy; any other is a tree it
// couldn't read.
function parseOnDiskPackages(report) {
  const onDisk = report.onDisk;
  if (!Array.isArray(onDisk?.packages) || !onDisk.packages.every((pkg) => isNonEmptyString(pkg?.name) && isNonEmptyString(pkg?.version) && isNonEmptyString(pkg?.location))) {
    return { ok: false, error: "it has no onDisk.packages list of { name, version, location } — rerun detect-dependencies.mjs to write it" };
  }
  if (!["listed", "absent"].includes(onDisk.nodeModules?.kind)) {
    const why = onDisk.nodeModules?.kind === "incomplete" ? onDisk.nodeModules.reason : `its node_modules verdict is ${JSON.stringify(onDisk.nodeModules)}`;
    return { ok: false, error: `${why} — fix it, then rerun detect-dependencies.mjs` };
  }
  return { ok: true, packages: onDisk.packages.map(({ name, version, location }) => ({ name, version, location })) };
}

// [LAW:one-source-of-truth] One context per package name and exact version a copy of it is on disk, the key
// replace-dependency looks a copy's candidates up by; a name with no copy on disk has one context, observed from its
// bundles. Evidence from code and bundles is the name's, shared by each of its versions.
function collectPackageContexts(report, onDiskPackages) {
  const byName = new Map();

  function ensure(name) {
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        bundleVersion: null,
        onDiskVersions: new Set(),
        codeSpecifierCount: 0,
        moduleHits: 0,
        signals: new Set(),
        licenseVersions: new Set(),
        hashMatchVersions: new Set(),
      });
    }
    return byName.get(name);
  }

  for (const pkg of onDiskPackages) ensure(pkg.name).onDiskVersions.add(pkg.version);

  const bareSpecifiers = report.code?.bareSpecifiers || {};
  for (const [pkgName, meta] of Object.entries(bareSpecifiers)) {
    const ctx = ensure(pkgName);
    ctx.codeSpecifierCount += Number(meta?.count || 0);
  }

  for (const bundle of report.bundles || []) {
    for (const module of bundle?.modules || []) {
      if (!module?.package) continue;
      const ctx = ensure(module.package);
      ctx.moduleHits += 1;

      if (!ctx.bundleVersion && typeof module.version === "string" && module.version.length > 0) {
        ctx.bundleVersion = module.version;
      }

      if (module.signal) ctx.signals.add(module.signal);

      for (const evidence of module.evidence || []) {
        if (!evidence || evidence.package !== module.package) continue;
        if (evidence.signal) ctx.signals.add(evidence.signal);
        if (evidence.signal === "license" && typeof evidence.detail === "string" && parseSemver(evidence.detail)) {
          ctx.licenseVersions.add(parseSemver(evidence.detail).normalized);
        }
      }

      for (const { package: pkgName, version } of module.hashMatches) {
        const parsed = pkgName === module.package ? parseSemver(version) : null;
        if (parsed) ctx.hashMatchVersions.add(parsed.normalized);
      }
    }
  }

  const out = Array.from(byName.values()).flatMap((ctx) => (ctx.onDiskVersions.size > 0 ? [...ctx.onDiskVersions].sort() : [null]).map((onDiskVersion) => ({
    name: ctx.name,
    observedVersion: onDiskVersion ?? ctx.bundleVersion,
    onDiskVersion,
    codeSpecifierCount: ctx.codeSpecifierCount,
    moduleHits: ctx.moduleHits,
    signals: Array.from(ctx.signals).sort(),
    licenseVersions: Array.from(ctx.licenseVersions).sort(compareSemverDesc),
    hashMatchVersions: Array.from(ctx.hashMatchVersions).sort(compareSemverDesc),
  })));

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function scoreCandidate(candidateVersion, observedVersion, ctx) {
  const reasons = [];
  let score = 0;

  const parsedObserved = parseSemver(observedVersion);
  const parsedCandidate = parseSemver(candidateVersion);

  if (candidateVersion === observedVersion) {
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
    candidateVersion === observedVersion
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

// [LAW:types-are-the-program] Candidates are versions as the registry publishes them, beside the observed version as
// the copy holds it, so a prerelease copy is offered only versions that exist and is exact only against itself.
function rankCandidates(ctx, registryVersions) {
  const observed = parseSemver(ctx.observedVersion || "");
  if (!observed) return [];

  // A prerelease is offered only as the copy's own version: a near match is a published release of its major.minor.
  const sameMinor = registryVersions.filter((version) => {
    const parsed = parseSemver(version);
    const release = !version.replace(/\+.*$/, "").includes("-");
    return parsed !== null && release && parsed.major === observed.major && parsed.minor === observed.minor;
  });
  const unique = Array.from(new Set([...sameMinor, ctx.observedVersion]));

  const scored = unique.map((version) => scoreCandidate(version, ctx.observedVersion, ctx));
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

  const report = readInput(depsPath, "Dependency report");
  const onDisk = parseOnDiskPackages(report);
  if (!onDisk.ok) {
    console.error(`Dependency report ${depsPath} can't be used: ${onDisk.error}`);
    process.exit(2);
  }
  const packageContexts = collectPackageContexts(report, onDisk.packages);
  const registryFixture = opts.registryFile ? readInput(path.resolve(projectRoot, opts.registryFile), "Registry file") : null;

  let degradedMode = false;
  const degradedReasons = [];
  const packages = [];

  // The registry is asked once per name, however many versions of it the app ships.
  const registryVersions = new Map();
  const versionsOf = (name) => {
    if (!registryVersions.has(name)) registryVersions.set(name, npmViewVersions(name));
    return registryVersions.get(name);
  };

  for (const ctx of packageContexts) {
    const observed = parseSemver(ctx.observedVersion || "") ? ctx.observedVersion : null;

    let versions = [];
    let source = "registry";
    if (registryFixture && Array.isArray(registryFixture[ctx.name])) {
      versions = registryFixture[ctx.name].filter((item) => typeof item === "string");
      source = "fixture";
    } else {
      const registryResult = versionsOf(ctx.name);
      if (!registryResult.ok) {
        degradedMode = true;
        // One reason per package, however many of its versions the app ships.
        if (!degradedReasons.some(({ package: name }) => name === ctx.name)) degradedReasons.push({ package: ctx.name, reason: registryResult.error });
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
      onDiskVersion: ctx.onDiskVersion,
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
    .map(({ name, onDiskVersion }) => ({ name, onDiskVersion }));

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
      totalPackages: new Set(packages.map(({ name }) => name)).size,
      totalPackageVersions: packages.length,
      exactRecommendations: packages.filter((item) => item.recommendation === "exact").length,
      nearMatchRecommendations: packages.filter((item) => item.recommendation === "near-match").length,
      unresolvedRecommendations: unresolved.length,
    },
  };

  writeJson(outPath, payload);
  console.log(`Wrote ${path.relative(projectRoot, outPath)}`);
  console.log(`- packages: ${payload.summary.totalPackages} (${payload.summary.totalPackageVersions} versions)`);
  console.log(`- exact: ${payload.summary.exactRecommendations}`);
  console.log(`- near-match: ${payload.summary.nearMatchRecommendations}`);
  console.log(`- unresolved: ${payload.summary.unresolvedRecommendations}`);
  console.log(`- degraded mode: ${payload.degradedMode ? "yes" : "no"}`);
}

main();

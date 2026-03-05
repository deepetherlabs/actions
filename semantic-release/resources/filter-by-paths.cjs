/**
 * Semantic-release plugin that filters commits by file paths.
 *
 * Reads RELEASE_PATHS env var (comma-separated directory prefixes, e.g. "crypto-futures,common").
 * Only commits touching files in those directories (or root-level files) are forwarded
 * to the standard commit-analyzer and release-notes-generator plugins.
 *
 * When RELEASE_PATHS is unset, all commits pass through unfiltered (backward compatible).
 */

const { execFileSync } = require("child_process");

let commitAnalyzerMod;
let releaseNotesMod;

async function loadPlugins() {
  if (!commitAnalyzerMod) {
    commitAnalyzerMod = await import("@semantic-release/commit-analyzer");
  }
  if (!releaseNotesMod) {
    releaseNotesMod = await import("@semantic-release/release-notes-generator");
  }
}

function getChangedFiles(hash) {
  try {
    return execFileSync("git", ["diff-tree", "--root", "--no-commit-id", "--name-only", "-r", hash], {
      encoding: "utf-8",
    })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isRelevant(file, paths) {
  if (!file.includes("/")) return true;
  return paths.some((p) => file.startsWith(p + "/"));
}

function filterCommits(commits, paths) {
  if (paths.length === 0) return commits;

  return commits.filter((commit) => {
    const files = getChangedFiles(commit.hash);
    return files.some((file) => isRelevant(file, paths));
  });
}

function getPaths() {
  return (process.env.RELEASE_PATHS || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

async function analyzeCommits(pluginConfig, context) {
  await loadPlugins();
  const paths = getPaths();
  const filtered = filterCommits(context.commits, paths);
  const fn = commitAnalyzerMod.analyzeCommits || commitAnalyzerMod.default;
  return fn(pluginConfig, { ...context, commits: filtered });
}

async function generateNotes(pluginConfig, context) {
  await loadPlugins();
  const paths = getPaths();
  const filtered = filterCommits(context.commits, paths);
  const fn = releaseNotesMod.generateNotes || releaseNotesMod.default;
  return fn(pluginConfig, { ...context, commits: filtered });
}

module.exports = { analyzeCommits, generateNotes };

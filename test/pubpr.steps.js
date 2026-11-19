// propose and github against the fake GitHub in fake-github.js, run with
// `npm test`. The suite's Givens set up the repository on the fake; its
// Whens call pubpr through `attempt`, and its reads of the fake (chained
// after a proposal) leave what GitHub holds as the result, for pubtest's
// steps to check. A commit is named by its label: "start" for the first one
// on main, or the one a Given gave it.
import { Given, When } from "@cucumber/cucumber";
import { readFile } from "node:fs/promises";
import { propose, github } from "../lib/pubpr.js";
import { blobSha, fakeGitHub } from "./fake-github.js";

function gh(world) {
  if (!world.gh) {
    world.gh = fakeGitHub(world.ghOptions ?? {});
    world.labels = { [world.gh.branch("main")]: "start" };
    world.fetch = world.gh.fetch;
  }
  return world.gh;
}
const label = (world, sha) => world.labels[sha] ?? sha;
const byLabel = (world, name) => Object.entries(world.labels).find(([, l]) => l === name)?.[0] ?? name;

// In a JSON value: "{undefined}" is left out, "{blob of T}" is the blob sha of
// T, and "{commit L}" the commit labelled L.
function values(world, value) {
  if (Array.isArray(value)) return value.map((v) => values(world, v));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, values(world, v)]));
  if (value === "{undefined}") return undefined;
  const blob = typeof value === "string" && value.match(/^\{blob of (.*)\}$/s);
  if (blob) return blobSha(blob[1].replaceAll("\\n", "\n"));
  const commit = typeof value === "string" && value.match(/^\{commit (.*)\}$/);
  if (commit) return byLabel(world, commit[1]);
  return value;
}

Given("a GitHub repository o\\/r holding:", function (files) {
  this.ghOptions = { ...this.ghOptions, files: JSON.parse(files) };
});

Given("a GitHub repository o\\/r with nothing in it", function () {
  this.ghOptions = { ...this.ghOptions, files: {} };
});

Given("GitHub answers a request for auto-merge with the error {string}", function (message) {
  this.ghOptions = { ...this.ghOptions, autoMergeAnswer: message };
});

Given("someone else commits to {string}, labelled {string}:", function (branch, name, changes) {
  this.labels[gh(this).push(branch, JSON.parse(changes))] = name;
});

Given("I read {string} as the commit {string}", function (branch, name) {
  gh(this);
  this.labels[gh(this).branch(branch)] = name;
});

Given("GitHub answers {int} when asked for a file's contents", function (status) {
  const real = gh(this).fetch;
  this.fetch = async (url, init) => (String(url).includes("/contents/") ? new Response("", { status }) : real(url, init));
});

Given("GitHub answers {int} when asked to auto-merge", function (status) {
  const real = gh(this).fetch;
  this.fetch = async (url, init) => (String(url).endsWith("/graphql") ? new Response("{}", { status }) : real(url, init));
});

Given("my token is an async function that answers {string}", function (token) {
  this.asked = 0;
  this.token = async () => (this.asked++, token);
});

Given("my token is an async function that finds none", function () {
  this.token = async () => null;
});

const proposal = (world, fields) => ({
  repo: "o/r",
  branch: "edit/one",
  title: "Edit things",
  changes: { "a.txt": "new\n" },
  token: world.token ?? "secret",
  fetch: world.fetch,
  ...values(world, fields),
});

async function proposing(world, fields = "{}") {
  world.sentBefore = gh(world).requests.length;
  const result = await propose(proposal(world, JSON.parse(fields)));
  world.made = result.commit;
  return result;
}

Given("I have proposed:", async function (fields) {
  await proposing(this, fields);
});

When("I propose:", async function (fields) {
  await this.attempt(() => proposing(this, fields));
});

When("I propose the default change", async function () {
  await this.attempt(() => proposing(this));
});

// Reads of the fake GitHub, after the action.
When("I read the files on {string}", async function (name) {
  await this.attempt(() => gh(this).files(byLabel(this, name)));
});

When("I read the files of the commit it made", async function () {
  await this.attempt(() => gh(this).files(this.made));
});

When("I read the commit it made", async function () {
  await this.attempt(() => {
    const commit = gh(this).commit(this.made);
    const heads = ["main", "edit/one", "edit/two", "b", "c", "stable"].filter((b) => gh(this).branch(b) === this.made);
    // The message also line by line, as a quoted value holds no newline.
    return { parents: commit.parents.map((p) => label(this, p)), message: commit.message, "message's lines": commit.message.split("\n"), heads };
  });
});

When("I read the branch {string}", async function (name) {
  await this.attempt(() => {
    const sha = gh(this).branch(name);
    return sha === undefined ? null : label(this, sha);
  });
});

When("I read the pull requests", async function () {
  await this.attempt(() => gh(this).pulls.map(({ title, body, head, base, number }) => ({ title, body, head, base, number })));
});

When("I list what was written to GitHub", async function () {
  await this.attempt(() => gh(this).written().map((r) => `${r.method} ${r.path}`));
});

When("I list the requests the proposal sent to GitHub", async function () {
  await this.attempt(() => gh(this).requests.slice(this.sentBefore).map((r) => `${r.method} ${r.path}`));
});

When("I list the tokens the requests to GitHub carried", async function () {
  await this.attempt(() => [...new Set(gh(this).requests.map((r) => r.authorization))]);
});

When("I count how often my token was asked for", async function () {
  await this.attempt(() => this.asked);
});

When("I read the auto-merges asked for and the merges made", async function () {
  await this.attempt(() => ({ autoMerges: gh(this).autoMerges, merged: gh(this).merged }));
});

// What a refusal carries: its status, and whether any of it holds the token.
When("I read the status of the refusal, and whether it holds {string}", async function (secret) {
  const error = this.pubtest.refused?.error;
  this.pubtest.refusalRead = true;
  await this.attempt(() => ({ status: error?.status, message: error?.message, holds: JSON.stringify({ ...error, message: error?.message, stack: error?.stack }).includes(secret) }));
});

// github: the API function on its own.
When("I ask github for {string}", async function (path) {
  await this.attempt(() => github({ token: this.token ?? "secret", fetch: gh(this).fetch })(path));
});

When("I ask github for {string} on main, raw", async function (path) {
  await this.attempt(() => github({ token: "secret", fetch: gh(this).fetch })(`${path}?ref=${gh(this).branch("main")}`, { raw: true }));
});

When("I ask github for {string} with a token function that answers {string}, then {string}", async function (path, first, then) {
  await this.attempt(async () => {
    let current = first;
    const api = github({ token: () => current, fetch: gh(this).fetch });
    const answers = [];
    for (const next of [then, null]) {
      try { answers.push(await api(path)); } catch (e) { answers.push(`refused with ${e.status}`); }
      current = next;
    }
    return answers.map((a) => (typeof a === "string" ? a : a.default_branch));
  });
});

When("I ask github for {string} of a server that answers {int} with {string}", async function (path, status, body) {
  await this.attempt(() => github({ token: "secret", fetch: async () => new Response(body, { status }) })(path));
});

When("I ask github for {string} with no fetch given", async function (path) {
  const saved = globalThis.fetch;
  globalThis.fetch = gh(this).fetch;
  this.pubtest.cleanup(() => { globalThis.fetch = saved; });
  await this.attempt(() => github({ token: "secret" })(path));
});

When("I read the package", async function () {
  await this.attempt(async () => {
    const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    const source = await readFile(new URL("../lib/pubpr.js", import.meta.url), "utf8");
    return {
      dependencies: manifest.dependencies ?? null,
      imports: /^import\b/m.test(source),
      "Node's own": (source.match(/\b(process|require|Buffer)\b/g) ?? []),
    };
  });
});

// All of what GitHub holds that a scenario reads: the branches' commits, the
// pull requests, and what was written.
When("I read what GitHub holds", async function () {
  await this.attempt(() => {
    const g = gh(this);
    const at = (b) => (g.branch(b) === undefined ? null : label(this, g.branch(b)));
    return {
      main: at("main"),
      "edit/one": at("edit/one"),
      pulls: g.pulls.length,
      written: g.written().map((r) => `${r.method} ${r.path}`),
      requests: g.requests.length,
    };
  });
});

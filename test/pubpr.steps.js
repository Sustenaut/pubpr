// propose and github against GitHub, run with `npm test`. Every request goes through
// integrations' Caller on pubtest's record/replay harness: replaying (the default), each
// scenario is answered from its cassette in ../pubpr-data; recording (`pubtest record`),
// from a repository integrations' steps make in the GitHub test org for the scenario. The
// repository is "o/r" here, whatever it is called while recording. A commit is named by
// its label: "start" for the one the repository's files are in, or the one a push gave it.
//
// The suite's Givens and Whens call pubpr through `attempt`; its reads of GitHub (chained
// after a proposal) go through the same Caller, so they are recorded and replayed too, and
// leave what GitHub holds as the result, for pubtest's steps to check. What pubpr itself
// sent is kept as it went, its repository's name written as "o/r".
import { Given, When } from "@cucumber/cucumber";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Caller } from "@sustenaut/integrations/caller.js";
import { commit, repositories, token as recorderToken } from "@sustenaut/integrations/testing/github.js";
import { callerOptions } from "@sustenaut/pubtest/cassettes";
import { propose, github } from "../lib/pubpr.js";

const REPO = "o/r";
const API = "https://api.github.com";
const PLUGIN = "github.edit-pr";

// The scenario's repository as the code under test calls it: o/r replaying, the test
// org's while recording.
const repository = (world) => repositories(world.pubtest)[REPO];
const real = (world) => repository(world)?.recorded ?? REPO;
const logical = (world, text) => text.split(`/repos/${real(world)}`).join(`/repos/${REPO}`);
const actual = (world, text) => text.split(`/repos/${REPO}`).join(`/repos/${real(world)}`);

// The scenario's Caller, on the harness's transport and clock. Without the harness it
// would reach the network, so it refuses.
function caller(world) {
  if (!world.pubtest.tape) throw new Error('the GitHub scenarios replay cassettes: pubrules.json sets "pubtest": {"cassettes": true} and @sustenaut/integrations is installed');
  return (world.caller ??= new Caller("pubpr", "test", callerOptions(world.pubtest)));
}

// The token the code under test calls with: the recorder app's while recording, a
// stand-in replaying, or any text where the scenario makes no call.
const myToken = (world) => (repository(world) ? recorderToken(world.pubtest) : "unused");

// A fetch for pubpr through the Caller, which keeps what each request sent.
function sender(world, operation) {
  const send = caller(world).fetch(PLUGIN, operation);
  world.sent ??= [];
  return async (url, init = {}) => {
    const at = new URL(url);
    const entry = { method: init.method ?? "GET", path: logical(world, at.pathname + at.search), authorization: init.headers?.Authorization, body: init.body ? JSON.parse(init.body) : undefined };
    world.sent.push(entry);
    const response = await send(url, init);
    if (entry.method === "POST" && entry.path.endsWith("/pulls") && response.ok) entry.answer = await response.clone().json();
    return response;
  };
}
const sent = (world) => world.sent ?? [];
const said = (entries) => entries.map((r) => `${r.method} ${r.path}`);

// The suite's own reads of GitHub, through the Caller and kept out of what pubpr sent.
async function read(world, path) {
  const answer = await caller(world).fetch(PLUGIN, "read")(API + actual(world, path), {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${await myToken(world)}`, "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (answer.status === 404) return null;
  if (!answer.ok) throw new Error(`reading ${path}, GitHub said ${answer.status}`);
  return answer.json();
}
const head = async (world, branch) => (await read(world, `/repos/${REPO}/git/ref/heads/${branch}`))?.object.sha ?? null;

async function filesOf(world, sha) {
  const { tree } = await read(world, `/repos/${REPO}/git/commits/${sha}`);
  const listed = await read(world, `/repos/${REPO}/git/trees/${tree.sha}?recursive=1`);
  const files = {};
  for (const entry of listed.tree.filter((e) => e.type === "blob")) {
    const blob = await read(world, `/repos/${REPO}/git/blobs/${entry.sha}`);
    files[entry.path] = Buffer.from(blob.content, "base64").toString("utf8");
  }
  return files;
}

// A commit by its label, the commit the proposal made, or its sha.
function labelOf(world, sha) {
  if (sha === null) return null;
  for (const [name, value] of Object.entries(repository(world)?.commits ?? {})) if (value === sha) return name;
  return sha === world.made ? "the commit it made" : sha;
}

// git's name for a blob holding text.
const blobSha = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0${text}`).digest("hex");

// In a JSON value: "{undefined}" is left out, "{blob of T}" is the blob sha of T, "{blob I
// read of P}" the sha GitHub gave for P when the scenario read it, and "{commit L}" the
// commit labelled L.
function values(world, value) {
  if (Array.isArray(value)) return value.map((v) => values(world, v));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, values(world, v)]));
  if (value === "{undefined}") return undefined;
  if (typeof value !== "string") return value;
  const blob = value.match(/^\{blob of (.*)\}$/s);
  if (blob) return blobSha(blob[1].replaceAll("\\n", "\n"));
  const readBlob = value.match(/^\{blob I read of (.*)\}$/);
  if (readBlob) return world.blobs[readBlob[1]];
  const labelled = value.match(/^\{commit (.*)\}$/);
  if (labelled) return commit(world.pubtest, REPO, labelled[1]);
  return value;
}

Given("I have read the blob sha of {string}", async function (path) {
  this.blobs = { ...this.blobs, [path]: (await read(this, `/repos/${REPO}/contents/${path}`)).sha };
});

Given("my token is an async function", function () {
  this.asked = 0;
  this.token = async () => (this.asked++, myToken(this));
});

Given("my token is an async function that finds none", function () {
  this.token = async () => null;
});

async function proposal(world, fields) {
  return {
    repo: real(world),
    branch: "edit/one",
    title: "Edit things",
    changes: { "a.txt": "new\n" },
    token: world.token ?? (await myToken(world)),
    fetch: sender(world, "open-pr"),
    ...values(world, fields),
  };
}

async function proposing(world, fields = "{}") {
  world.sentBefore = sent(world).length;
  const asked = await proposal(world, JSON.parse(fields));
  world.branch = asked.branch;
  const result = await propose(asked);
  world.made = result.commit;
  // What comes back names the repository as the scenario does.
  return JSON.parse(logical(world, JSON.stringify(result)).split(`github.com/${real(world)}/`).join(`github.com/${REPO}/`));
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

// Reads of GitHub, after the action.
When("I read the files on {string}", async function (branch) {
  await this.attempt(async () => filesOf(this, await head(this, branch)));
});

When("I read the files of the commit it made", async function () {
  await this.attempt(() => filesOf(this, this.made));
});

When("I read the commit it made", async function () {
  await this.attempt(async () => {
    const made = await read(this, `/repos/${REPO}/git/commits/${this.made}`);
    const heads = [];
    for (const branch of [...new Set(["main", this.branch])]) if ((await head(this, branch)) === this.made) heads.push(branch);
    // The message also line by line, as a quoted value holds no newline.
    return { parents: made.parents.map((p) => labelOf(this, p.sha)), message: made.message, "message's lines": made.message.split("\n"), heads };
  });
});

When("I read the pull requests", async function () {
  await this.attempt(async () => {
    const pulls = await read(this, `/repos/${REPO}/pulls?state=all&sort=created&direction=asc`);
    return pulls.map((p) => ({ title: p.title, body: p.body, head: p.head.ref, base: p.base.ref, number: p.number, merged: p.merged_at !== null }));
  });
});

When("I list the requests the proposal sent to GitHub", async function () {
  await this.attempt(() => said(sent(this).slice(this.sentBefore ?? 0)));
});

When("I list the tokens the requests to GitHub carried", async function () {
  const mine = `Bearer ${await myToken(this)}`;
  await this.attempt(() => [...new Set(sent(this).map((r) => (r.authorization === mine ? "Bearer my token" : r.authorization)))]);
});

When("I count how often my token was asked for", async function () {
  await this.attempt(() => this.asked);
});

// Which pull requests pubpr asked GitHub to merge by itself, by their number, and which
// it merged.
When("I read the auto-merges asked for and the merges made", async function () {
  await this.attempt(() => {
    const pulls = sent(this).filter((r) => r.answer).map((r) => r.answer);
    const asked = sent(this).filter((r) => r.method === "POST" && r.path === "/graphql").map((r) => pulls.find((p) => p.node_id === r.body.variables.id)?.number ?? r.body.variables.id);
    const merged = sent(this).flatMap((r) => (r.method === "PUT" ? [Number(r.path.match(/\/pulls\/(\d+)\/merge$/)?.[1])] : []));
    return { autoMerges: asked, merged };
  });
});

// What a refusal carries: its status, and whether any of it holds the token.
When("I read the status of the refusal, and whether it holds {string}", async function (secret) {
  const error = this.pubtest.refused?.error;
  this.pubtest.refusalRead = true;
  await this.attempt(() => ({ status: error?.status, message: error?.message, holds: JSON.stringify({ ...error, message: error?.message, stack: error?.stack }).includes(secret) }));
});

// github: the API function on its own.
When("I ask github for {string}", async function (path) {
  await this.attempt(async () => github({ token: this.token ?? (await myToken(this)), fetch: sender(this, "read") })(actual(this, path)));
});

When("I ask github for {string} on main, raw", async function (path) {
  await this.attempt(async () => github({ token: await myToken(this), fetch: sender(this, "read") })(`${actual(this, path)}?ref=main`, { raw: true }));
});

// The token function answers "wrong" first, then mine: what came back each time, and the
// token each request carried.
When("I ask github for {string} twice, with a token function that answers {string}, then mine", async function (path, first) {
  const mine = await myToken(this);
  await this.attempt(async () => {
    let current = first;
    const api = github({ token: () => current, fetch: sender(this, "read") });
    const answers = [];
    for (const next of [mine, null]) {
      try { answers.push((await api(actual(this, path))).default_branch); } catch (e) { answers.push(`refused with ${e.status}`); }
      current = next;
    }
    return { answers, tokens: sent(this).map((r) => (r.authorization === `Bearer ${mine}` ? "Bearer my token" : r.authorization)) };
  });
});

When("I ask github for {string} of a server that answers {int} with {string}", async function (path, status, body) {
  await this.attempt(() => github({ token: "secret", fetch: async () => new Response(body, { status }) })(path));
});

When("I ask github for {string} with no fetch given", async function (path) {
  const saved = globalThis.fetch;
  globalThis.fetch = sender(this, "read");
  this.pubtest.cleanup(() => { globalThis.fetch = saved; });
  await this.attempt(async () => github({ token: await myToken(this) })(actual(this, path)));
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

// What GitHub holds that a scenario reads: main's and edit/one's commits, how many pull
// requests there are, and what pubpr wrote.
When("I read what GitHub holds", async function () {
  await this.attempt(async () => ({
    main: labelOf(this, await head(this, "main")),
    "edit/one": labelOf(this, await head(this, "edit/one")),
    pulls: (await read(this, `/repos/${REPO}/pulls?state=all`)).length,
    written: said(sent(this).filter((r) => r.method !== "GET")),
  }));
});

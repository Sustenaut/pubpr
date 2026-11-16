// propose and github against the fake GitHub in fake-github.js, run with
// `npm test`.
import { After, Then } from "@cucumber/cucumber";
import { mock as nodeMock } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { propose, github } from "../lib/pubpr.js";
import { blobSha, fakeGitHub } from "./fake-github.js";

// What node:test gave each test as `t`: its mocks, restored when the
// scenario ends, and the cleanups it registers with t.after().
const cleanups = [];
const scenarioContext = { mock: nodeMock, after: (fn) => cleanups.push(fn) };
After("@pubpr", async function () {
  while (cleanups.length) await cleanups.pop()();
  nodeMock.restoreAll();
});


const proposal = (gh, fields) => ({
  repo: "o/r",
  branch: "edit/one",
  title: "Edit things",
  changes: { "a.txt": "new\n" },
  token: "secret",
  fetch: gh.fetch,
  ...fields,
});

Then("one commit holds every change, on the newest base, and a pull request opens for it", function () {
  return (async () => {
  const gh = fakeGitHub({ files: { "a.txt": "old\n", "b.txt": "keep\n", "dir/c.txt": "go\n" } });
  const before = gh.branch("main");
  const result = await propose(
    proposal(gh, { body: "Why.", changes: { "a.txt": "new\n", "dir/d.txt": "added\n", "dir/c.txt": null } }),
  );

  assert.equal(result.status, "opened");
  assert.equal(result.url, "https://github.com/o/r/pull/1");
  assert.equal(result.number, 1);
  assert.equal(result.branch, "edit/one");
  assert.equal(result.commit, gh.branch("edit/one"));
  assert.deepEqual(gh.files("edit/one"), { "a.txt": "new\n", "b.txt": "keep\n", "dir/d.txt": "added\n" });
  assert.deepEqual(gh.commit(result.commit).parents, [before]);
  assert.equal(gh.branch("main"), before, "main is untouched");
  assert.equal(gh.written().filter((r) => r.path.endsWith("/git/commits")).length, 1);
  assert.equal(gh.pulls[0].title, "Edit things");
  assert.equal(gh.pulls[0].body, "Why.");
  assert.equal(gh.pulls[0].head, "edit/one");
  assert.equal(gh.pulls[0].base, "main");
})(scenarioContext);
});

Then("the commit goes on what the base is now, not what it was", function () {
  return (async () => {
  const gh = fakeGitHub({ files: { "a.txt": "old\n" } });
  await propose(proposal(gh));
  const newest = gh.push("main", { "b.txt": "theirs\n" });
  const result = await propose(proposal(gh, { branch: "edit/two", changes: { "c.txt": "mine\n" } }));
  assert.deepEqual(gh.commit(result.commit).parents, [newest]);
  assert.deepEqual(gh.files("edit/two"), { "a.txt": "old\n", "b.txt": "theirs\n", "c.txt": "mine\n" });
})(scenarioContext);
});

Then("a named base is used, and the default branch isn't looked up", function () {
  return (async () => {
  const gh = fakeGitHub({ files: { "a.txt": "old\n" } });
  await propose(proposal(gh, { branch: "stable", changes: { "s.txt": "s\n" } }));
  const result = await propose(proposal(gh, { base: "stable", branch: "edit/two" }));
  assert.equal(gh.pulls[1].base, "stable");
  assert.equal(gh.files(result.commit)["s.txt"], "s\n");
  assert.equal(gh.requests.some((r) => r.path === "/repos/o/r" && r !== gh.requests[0]), false);
})(scenarioContext);
});

Then("a parent keeps the commit on what the caller read", function () {
  return (async () => {
  const gh = fakeGitHub({ files: { "a.txt": "old\n" } });
  const read = gh.branch("main");
  gh.push("main", { "a.txt": "theirs\n" });
  const result = await propose(proposal(gh, { parent: read }));
  assert.deepEqual(gh.commit(result.commit).parents, [read]);
  assert.equal(gh.pulls[0].base, "main");
})(scenarioContext);
});

Then("<name> is nothing to change, and writes nothing that shows", async function () {
  // Every case, in turn, as the loop of tests did.
  for (const [name, files, changes] of [
  ["no changes", { "a.txt": "old\n" }, {}],
  ["a file that already has that text", { "a.txt": "same\n" }, { "a.txt": "same\n" }],
  ["a delete of a file that isn't there", { "a.txt": "old\n" }, { "gone.txt": null }],
  ["both", { "a.txt": "same\n" }, { "a.txt": "same\n", "gone.txt": null }],
]) {
    await (async () => {
    const gh = fakeGitHub({ files });
    const main = gh.branch("main");
    assert.deepEqual(await propose(proposal(gh, { changes })), { status: "nothing to change" });
    assert.equal(gh.branch("main"), main);
    assert.equal(gh.branch("edit/one"), undefined);
    assert.equal(gh.pulls.length, 0);
    const kinds = gh.written().map((r) => r.path);
    assert.deepEqual(kinds.filter((p) => !p.endsWith("/git/trees")), []);
  })(scenarioContext);
  }
});

Then("a delete of a missing file doesn't stop the rest", function () {
  return (async () => {
  const gh = fakeGitHub({ files: { "a.txt": "old\n" } });
  const result = await propose(proposal(gh, { changes: { "gone.txt": null, "a.txt": "new\n" } }));
  assert.equal(result.status, "opened");
  assert.deepEqual(gh.files("edit/one"), { "a.txt": "new\n" });
})(scenarioContext);
});

Then("a path is encoded, whatever is in it", function () {
  return (async () => {
  const gh = fakeGitHub({ files: { "a b/c#d?.txt": "old\n" } });
  await propose(proposal(gh, { changes: { "a b/c#d?.txt": null, "x.txt": "x\n" } }));
  assert.deepEqual(gh.files("edit/one"), { "x.txt": "x\n" });
})(scenarioContext);
});

Then("the commit message is the title and body, or the one given", function () {
  return (async () => {
  const gh = fakeGitHub();
  const titled = await propose(proposal(gh));
  assert.equal(gh.commit(titled.commit).message, "Edit things");
  const bodied = await propose(proposal(gh, { branch: "b", body: "Why." }));
  assert.equal(gh.commit(bodied.commit).message, "Edit things\n\nWhy.");
  const given = await propose(proposal(gh, { branch: "c", body: "Why.", message: "Mine\n\n- one\n" }));
  assert.equal(gh.commit(given.commit).message, "Mine\n\n- one\n");
  assert.equal(gh.pulls[2].body, "Why.");
})(scenarioContext);
});

Then("a token may be an async function, asked once per proposal", function () {
  return (async () => {
  const gh = fakeGitHub();
  let asked = 0;
  const result = await propose(proposal(gh, { token: async () => (asked++, "secret") }));
  assert.equal(result.status, "opened");
  assert.equal(asked, 1);
  assert.ok(gh.requests.every((r) => r.authorization === "Bearer secret"));
})(scenarioContext);
});

Then("a token that is <name> fails before any request", async function () {
  // Every case, in turn, as the loop of tests did.
  for (const [name, token] of [
  ["none", undefined],
  ["empty", ""],
  ["a function that finds none", async () => null],
]) {
    await (async () => {
    const gh = fakeGitHub();
    await assert.rejects(propose(proposal(gh, { token })), /no GitHub token/);
    assert.equal(gh.requests.length, 0);
  })(scenarioContext);
  }
});

Then("what GitHub refuses comes back with its status, and without the token", function () {
  return (async () => {
  const gh = fakeGitHub();
  await assert.rejects(propose(proposal(gh, { token: "wrong-token" })), (error) => {
    assert.equal(error.status, 401);
    assert.equal(error.message, "GitHub said 401: Bad credentials");
    assert.equal(JSON.stringify({ ...error, message: error.message, stack: error.stack }).includes("wrong-token"), false);
    return true;
  });
})(scenarioContext);
});

Then("a failure other than a missing file while checking a delete still fails", function () {
  return (async () => {
  const gh = fakeGitHub({ files: { "a.txt": "old\n" } });
  const failing = async (url, init) => (String(url).includes("/contents/") ? new Response("", { status: 500 }) : gh.fetch(url, init));
  await assert.rejects(propose(proposal(gh, { fetch: failing, changes: { "a.txt": null } })), (e) => e.status === 500);
  assert.equal(gh.written().length, 0);
})(scenarioContext);
});

Then("a branch that exists fails, and opens no pull request", function () {
  return (async () => {
  const gh = fakeGitHub();
  await propose(proposal(gh));
  await assert.rejects(propose(proposal(gh, { changes: { "b.txt": "b\n" } })), /Reference already exists/);
  assert.equal(gh.pulls.length, 1);
})(scenarioContext);
});

Then("propose without a <missing> fails before any request", async function () {
  // Every case, in turn, as the loop of tests did.
  for (const missing of ["repo", "branch", "title"]) {
    await (async () => {
    const gh = fakeGitHub();
    await assert.rejects(propose(proposal(gh, { [missing]: undefined })), new RegExp(`needs a ${missing}`));
    assert.equal(gh.requests.length, 0);
  })(scenarioContext);
  }
});

Then("changes that are <name> fail before any request", async function () {
  // Every case, in turn, as the loop of tests did.
  for (const [name, changes, pattern] of [
  ["a list", [{ path: "a", content: "b" }], /changes is an object/],
  ["null", null, /changes is an object/],
  ["undefined", undefined, /changes is an object/],
  ["a number for content", { "a.txt": 1 }, /a.txt is neither text nor null/],
  ["undefined for content", { "a.txt": undefined }, /a.txt is neither text nor null/],
  ["an empty path", { "": "x" }, /needs a path/],
]) {
    await (async () => {
    const gh = fakeGitHub();
    await assert.rejects(propose(proposal(gh, { changes })), pattern);
    assert.equal(gh.requests.length, 0);
  })(scenarioContext);
  }
});

Then("github answers JSON, or a file's text when asked for it raw", function () {
  return (async () => {
  const gh = fakeGitHub({ files: { "a.txt": "text\n" } });
  const api = github({ token: "secret", fetch: gh.fetch });
  assert.equal((await api("/repos/o/r")).default_branch, "main");
  assert.equal(await api(`/repos/o/r/contents/a.txt?ref=${gh.branch("main")}`, { raw: true }), "text\n");
})(scenarioContext);
});

Then("github asks a token function each time, so a new sign-in counts", function () {
  return (async () => {
  const gh = fakeGitHub();
  let current = "wrong";
  const api = github({ token: () => current, fetch: gh.fetch });
  await assert.rejects(api("/repos/o/r"), (e) => e.status === 401);
  current = "secret";
  assert.equal((await api("/repos/o/r")).default_branch, "main");
})(scenarioContext);
});

Then("an error without a message says the status alone", function () {
  return (async () => {
  const api = github({ token: "secret", fetch: async () => new Response("<html>", { status: 502 }) });
  await assert.rejects(api("/x"), (e) => e.message === "GitHub said 502" && e.status === 502);
})(scenarioContext);
});

Then("github uses the global fetch unless told otherwise", function () {
  return (async (t) => {
  const gh = fakeGitHub();
  t.mock.method(globalThis, "fetch", gh.fetch);
  assert.equal((await github({ token: "secret" })("/repos/o/r")).default_branch, "main");
})(scenarioContext);
});

Then("expect lets a proposal through when each file is as read", function () {
  return (async () => {
  const gh = fakeGitHub({ files: { "a.txt": "old\n" } });
  const result = await propose(proposal(gh, { expect: { "a.txt": blobSha("old\n"), "new.txt": null }, changes: { "a.txt": "new\n", "new.txt": "n\n" } }));
  assert.equal(result.status, "opened");
})(scenarioContext);
});

Then("expect refuses <name>, and writes nothing", async function () {
  // Every case, in turn, as the loop of tests did.
  for (const [name, expect, path] of [
  ["a file that has changed", { "a.txt": blobSha("older\n") }, "a.txt"],
  ["a file that has gone", { "gone.txt": "abc" }, "gone.txt"],
  ["a file that has appeared", { "a.txt": null }, "a.txt"],
]) {
    await (async () => {
    const gh = fakeGitHub({ files: { "a.txt": "old\n" } });
    assert.deepEqual(await propose(proposal(gh, { expect })), { status: "stale", path });
    assert.deepEqual(gh.written(), []);
  })(scenarioContext);
  }
});

Then("expect looks at what the proposal builds on, the newest commit by default", function () {
  return (async () => {
  const gh = fakeGitHub({ files: { "a.txt": "old\n" } });
  const read = gh.branch("main");
  gh.push("main", { "a.txt": "theirs\n" });
  const expect = { "a.txt": blobSha("old\n") };
  assert.equal((await propose(proposal(gh, { expect }))).status, "stale");
  assert.equal((await propose(proposal(gh, { expect, parent: read }))).status, "opened");
})(scenarioContext);
});

Then("autoMerge turns it on, and says so", function () {
  return (async () => {
  const gh = fakeGitHub();
  const result = await propose(proposal(gh, { autoMerge: true }));
  assert.equal(result.autoMerge, "on");
  assert.deepEqual(gh.autoMerges, ["PR_1"]);
  assert.deepEqual(gh.merged, []);
})(scenarioContext);
});

Then("without autoMerge, nothing is asked", function () {
  return (async () => {
  const gh = fakeGitHub();
  const result = await propose(proposal(gh));
  assert.equal("autoMerge" in result, false);
  assert.deepEqual(gh.autoMerges, []);
})(scenarioContext);
});

Then("autoMerge merges now when GitHub says there's nothing left to wait for", function () {
  return (async () => {
  const gh = fakeGitHub({ autoMergeAnswer: "Pull request Pull request is in clean status" });
  assert.equal((await propose(proposal(gh, { autoMerge: true }))).autoMerge, "merged");
  assert.deepEqual(gh.merged, [1]);
})(scenarioContext);
});

Then("autoMerge being refused is reported, and the pull request still stands", function () {
  return (async () => {
  const gh = fakeGitHub({ autoMergeAnswer: "Auto merge is not allowed for this repository" });
  const result = await propose(proposal(gh, { autoMerge: true }));
  assert.equal(result.status, "opened");
  assert.equal(result.url, "https://github.com/o/r/pull/1");
  assert.equal(result.autoMerge, "Auto merge is not allowed for this repository");
})(scenarioContext);
});

Then("autoMerge failing outright is reported too", function () {
  return (async () => {
  const gh = fakeGitHub();
  const failing = async (url, init) => (String(url).endsWith("/graphql") ? new Response("{}", { status: 502 }) : gh.fetch(url, init));
  const result = await propose(proposal(gh, { autoMerge: true, fetch: failing }));
  assert.equal(result.status, "opened");
  assert.equal(result.autoMerge, "GitHub said 502");
})(scenarioContext);
});

Then("the package needs nothing: no dependencies, no imports, nothing only Node has", function () {
  return (async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.dependencies, undefined);
  const source = await readFile(new URL("../lib/pubpr.js", import.meta.url), "utf8");
  assert.equal(/^import\b/m.test(source), false);
  assert.equal(/\b(process|require|Buffer)\b/.test(source), false);
})(scenarioContext);
});

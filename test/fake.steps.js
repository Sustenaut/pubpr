// The fake publisher a program's own tests use.
import { After, Then } from "@cucumber/cucumber";
import { mock as nodeMock } from "node:test";
import assert from "node:assert/strict";
import { fakePublisher } from "../lib/fake.js";

// What node:test gave each test as `t`: its mocks, restored when the
// scenario ends, and the cleanups it registers with t.after().
const cleanups = [];
const scenarioContext = { mock: nodeMock, after: (fn) => cleanups.push(fn) };
After("@fake", async function () {
  while (cleanups.length) await cleanups.pop()();
  nodeMock.restoreAll();
});


const proposal = (fields) => ({ repo: "o/r", branch: "b", title: "T", changes: { "a.txt": "new\n" }, ...fields });

Then("the would-be pull request is written to memory", function () {
  return (async () => {
  const fake = fakePublisher();
  const result = await fake.propose(proposal({ base: "main", body: "Why.", changes: { "a.txt": "new\n", "b.txt": null } }));
  assert.deepEqual(result, { status: "opened", url: "https://github.com/o/r/pull/1", number: 1, branch: "b", commit: "fake-commit-1" });
  assert.deepEqual(fake.proposals, [
    { repo: "o/r", base: "main", branch: "b", title: "T", body: "Why.", message: "T\n\nWhy.", parent: undefined, expect: undefined, autoMerge: undefined, changes: { "a.txt": "new\n" } },
  ]);
})(scenarioContext);
});

Then("it keeps no token, and needs none", function () {
  return (async () => {
  const fake = fakePublisher();
  await fake.propose(proposal({ token: "secret" }));
  assert.equal(JSON.stringify(fake.proposals).includes("secret"), false);
})(scenarioContext);
});

Then("a message and a parent are kept as given", function () {
  return (async () => {
  const fake = fakePublisher();
  await fake.propose(proposal({ message: "Mine", parent: "abc" }));
  assert.equal(fake.proposals[0].message, "Mine");
  assert.equal(fake.proposals[0].parent, "abc");
})(scenarioContext);
});

Then("what the repository already has is nothing to change", function () {
  return (async () => {
  const fake = fakePublisher({ files: { "a.txt": "same\n" } });
  assert.deepEqual(await fake.propose(proposal({ changes: { "a.txt": "same\n", "gone.txt": null } })), { status: "nothing to change" });
  assert.deepEqual(await fake.propose(proposal({ changes: {} })), { status: "nothing to change" });
  assert.equal(fake.proposals.length, 0);
  await fake.propose(proposal({ changes: { "a.txt": null } }));
  assert.deepEqual(fake.proposals[0].changes, { "a.txt": null });
})(scenarioContext);
});

Then("it refuses what propose refuses", function () {
  return (async () => {
  const fake = fakePublisher();
  await assert.rejects(fake.propose(proposal({ branch: undefined })), /needs a branch/);
  await assert.rejects(fake.propose(proposal({ changes: { "a.txt": 1 } })), /neither text nor null/);
  await fake.propose(proposal());
  await assert.rejects(fake.propose(proposal()), /Reference already exists/);
})(scenarioContext);
});

Then("it records expect and autoMerge, and answers as propose does", function () {
  return (async () => {
  const fake = fakePublisher();
  const result = await fake.propose(proposal({ expect: { "a.txt": "s" }, autoMerge: true }));
  assert.equal(result.autoMerge, "on");
  assert.deepEqual(fake.proposals[0].expect, { "a.txt": "s" });
  assert.equal(fake.proposals[0].autoMerge, true);
  assert.equal("autoMerge" in (await fake.propose(proposal({ branch: "b2" }))), false);
  const refused = fakePublisher({ autoMerge: "not allowed" });
  assert.equal((await refused.propose(proposal({ autoMerge: true }))).autoMerge, "not allowed");
})(scenarioContext);
});

Then("a moved file makes a proposal that expects it stale", function () {
  return (async () => {
  const fake = fakePublisher({ moved: ["a.txt"] });
  assert.deepEqual(await fake.propose(proposal({ expect: { "a.txt": "s" } })), { status: "stale", path: "a.txt" });
  assert.equal(fake.proposals.length, 0);
  assert.equal((await fake.propose(proposal())).status, "opened");
})(scenarioContext);
});

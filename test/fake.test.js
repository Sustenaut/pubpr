// The fake publisher a program's own tests use.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakePublisher } from "../lib/fake.js";

const proposal = (fields) => ({ repo: "o/r", branch: "b", title: "T", changes: { "a.txt": "new\n" }, ...fields });

test("the would-be pull request is written to memory", async () => {
  const fake = fakePublisher();
  const result = await fake.propose(proposal({ base: "main", body: "Why.", changes: { "a.txt": "new\n", "b.txt": null } }));
  assert.deepEqual(result, { status: "opened", url: "https://github.com/o/r/pull/1", number: 1, branch: "b", commit: "fake-commit-1" });
  assert.deepEqual(fake.proposals, [
    { repo: "o/r", base: "main", branch: "b", title: "T", body: "Why.", message: "T\n\nWhy.", parent: undefined, changes: { "a.txt": "new\n" } },
  ]);
});

test("it keeps no token, and needs none", async () => {
  const fake = fakePublisher();
  await fake.propose(proposal({ token: "secret" }));
  assert.equal(JSON.stringify(fake.proposals).includes("secret"), false);
});

test("a message and a parent are kept as given", async () => {
  const fake = fakePublisher();
  await fake.propose(proposal({ message: "Mine", parent: "abc" }));
  assert.equal(fake.proposals[0].message, "Mine");
  assert.equal(fake.proposals[0].parent, "abc");
});

test("what the repository already has is nothing to change", async () => {
  const fake = fakePublisher({ files: { "a.txt": "same\n" } });
  assert.deepEqual(await fake.propose(proposal({ changes: { "a.txt": "same\n", "gone.txt": null } })), { status: "nothing to change" });
  assert.deepEqual(await fake.propose(proposal({ changes: {} })), { status: "nothing to change" });
  assert.equal(fake.proposals.length, 0);
  await fake.propose(proposal({ changes: { "a.txt": null } }));
  assert.deepEqual(fake.proposals[0].changes, { "a.txt": null });
});

test("it refuses what propose refuses", async () => {
  const fake = fakePublisher();
  await assert.rejects(fake.propose(proposal({ branch: undefined })), /needs a branch/);
  await assert.rejects(fake.propose(proposal({ changes: { "a.txt": 1 } })), /neither text nor null/);
  await fake.propose(proposal());
  await assert.rejects(fake.propose(proposal()), /Reference already exists/);
});

// The fake publisher a program's own tests use (lib/fake.js): the suite's
// Givens make one, its Whens call its propose through `attempt`, and a read
// of what it kept leaves that as the result, for pubtest's steps.
import { Given, When } from "@cucumber/cucumber";
import { fakePublisher } from "../lib/fake.js";

const proposal = (fields) => ({ repo: "o/r", branch: "b", title: "T", changes: { "a.txt": "new\n" }, ...fields });
// In a JSON value, "{undefined}" is undefined.
const undefine = (v) => (v === "{undefined}" ? undefined : v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, undefine(x)])) : v);
const values = (fields) => undefine(JSON.parse(fields));
const fake = (world) => (world.fake ??= fakePublisher(world.fakeOptions));

Given("a fake publisher", function () {
  this.fakeOptions = {};
});

Given("a fake publisher with:", function (options) {
  this.fakeOptions = JSON.parse(options);
});

Given("the fake publisher has been asked to propose:", async function (fields) {
  await fake(this).propose(proposal(values(fields)));
});

When("I ask the fake publisher to propose:", async function (fields) {
  await this.attempt(() => fake(this).propose(proposal(values(fields))));
});

When("I read what the fake publisher kept", async function () {
  await this.attempt(() => JSON.parse(JSON.stringify(fake(this).proposals, (k, v) => (v === undefined ? "{undefined}" : v))));
});

When("I read whether what the fake publisher kept holds {string}", async function (text) {
  await this.attempt(() => JSON.stringify(fake(this).proposals).includes(text));
});

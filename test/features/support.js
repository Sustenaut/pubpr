// cucumber-js's setup for these scenarios: pubtest's steps (GRAMMAR.md), its record/replay
// harness with integrations' GitHub test customer (the GitHub repository "o/r" holds:,
// someone else pushes to ...), and a step may take as long as a test could under node:test.
import * as cucumber from "@cucumber/cucumber";
import { register } from "@sustenaut/pubtest";
import { github } from "@sustenaut/integrations/testing/github.js";
import { CASSETTE } from "@sustenaut/integrations/transports.js";

// pubtest 0.3.0 runs a customer's cleanup after it has taken INTEGRATIONS_CASSETTE away
// again, and the Caller integrations' cleanup deletes the test org's repositories with
// refuses to call in record mode without it, so every recorded scenario would fail and
// leave its repository to the janitor. Until one of them changes, the cleanup runs with
// the scenario's cassette named; its Caller has a fetch of its own and reads no cassette.
const customer = {
  ...github,
  async cleanup(tape, names) {
    const was = process.env[CASSETTE];
    process.env[CASSETTE] ??= tape.path;
    try {
      await github.cleanup(tape, names);
    } finally {
      if (was === undefined) delete process.env[CASSETTE];
      else process.env[CASSETTE] = was;
    }
  },
};

cucumber.setDefaultTimeout(60_000);
register(cucumber, { customers: [customer] });

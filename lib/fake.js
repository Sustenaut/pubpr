// A stand-in for pubpr.js in a program's tests: its propose takes the same
// arguments and answers the same way, but writes the would-be pull request to
// memory and never touches the network. It does not ask for a token.

import { changeEntries } from "./pubpr.js";

// `files` is what the repository already has, from each path to its text; a
// change it already has is no change, as on GitHub.
export function fakePublisher({ files = {} } = {}) {
  const proposals = [];

  async function propose({ repo, base, branch, title, body = "", message, parent, changes }) {
    for (const [name, value] of Object.entries({ repo, branch, title })) {
      if (!value) throw new TypeError(`propose needs a ${name}`);
    }
    if (proposals.some((p) => p.repo === repo && p.branch === branch)) {
      throw new Error(`GitHub said 422: Reference already exists`);
    }
    const changed = changeEntries(changes).filter(([path, content]) => content !== (files[path] ?? null));
    if (!changed.length) return { status: "nothing to change" };
    const number = proposals.length + 1;
    proposals.push({
      repo,
      base,
      branch,
      title,
      body,
      message: message ?? (body ? `${title}\n\n${body}` : title),
      parent,
      changes: Object.fromEntries(changed),
    });
    return { status: "opened", url: `https://github.com/${repo}/pull/${number}`, number, branch, commit: `fake-commit-${number}` };
  }

  return { propose, proposals };
}

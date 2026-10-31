// A stand-in for pubpr.js in a program's tests: its propose takes the same
// arguments and answers the same way, but writes the would-be pull request to
// memory and never touches the network. It does not ask for a token.

import { changeEntries } from "./pubpr.js";

// `files` is what the repository already has, from each path to its text; a
// change it already has is no change, as on GitHub.
//
// `moved` lists paths that have changed since a caller read them, so a proposal that
// expects any of them answers "stale". `autoMerge` is what a proposal that asks for
// auto-merge answers.
export function fakePublisher({ files = {}, moved = [], autoMerge: answer = "on" } = {}) {
  const proposals = [];

  async function propose({ repo, base, branch, title, body = "", message, parent, changes, expect, autoMerge }) {
    for (const [name, value] of Object.entries({ repo, branch, title })) {
      if (!value) throw new TypeError(`propose needs a ${name}`);
    }
    if (proposals.some((p) => p.repo === repo && p.branch === branch)) {
      throw new Error(`GitHub said 422: Reference already exists`);
    }
    const entries = changeEntries(changes);
    const stale = Object.keys(expect ?? {}).find((path) => moved.includes(path));
    if (stale) return { status: "stale", path: stale };
    const changed = entries.filter(([path, content]) => content !== (files[path] ?? null));
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
      expect,
      autoMerge,
      changes: Object.fromEntries(changed),
    });
    const opened = { status: "opened", url: `https://github.com/${repo}/pull/${number}`, number, branch, commit: `fake-commit-${number}` };
    return autoMerge ? { ...opened, autoMerge: answer } : opened;
  }

  return { propose, proposals };
}

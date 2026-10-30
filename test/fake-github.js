// The part of GitHub's REST API pubpr uses, in memory, behind a function that
// takes fetch's place, so the tests never reach the network. It refuses what
// GitHub refuses: no token, a deleted path that isn't there, a branch that
// exists. A tree here is an object from each path to its text.

import { createHash } from "node:crypto";

const sha = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function fakeGitHub({ repo = "o/r", defaultBranch = "main", files = {}, token = "secret" } = {}) {
  const trees = new Map();
  const commits = new Map();
  const refs = new Map();
  const pulls = [];
  const requests = [];

  function addTree(tree) {
    const name = sha(Object.entries(tree).sort());
    trees.set(name, tree);
    return name;
  }
  function addCommit(treeSha, parents, message) {
    const name = sha([treeSha, parents, message, commits.size]);
    commits.set(name, { sha: name, tree: { sha: treeSha }, parents, message });
    return name;
  }
  refs.set(defaultBranch, addCommit(addTree(files), [], "start"));

  const json = (status, value) =>
    new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  const refuse = (status, message) => json(status, { message });

  const found = (value) => (value === undefined ? refuse(404, "Not Found") : json(200, value));

  function readContents(path, ref, accept) {
    const tree = trees.get(commits.get(ref)?.tree.sha);
    if (!tree || !(path in tree)) return refuse(404, "Not Found");
    return accept.includes("raw") ? new Response(tree[path]) : json(200, { path });
  }

  function writeTree(body) {
    const tree = { ...trees.get(body.base_tree) };
    for (const entry of body.tree) {
      if (entry.sha === null && !(entry.path in tree)) return refuse(422, "GitRPC::BadObjectState");
      if (entry.sha === null) delete tree[entry.path];
      else tree[entry.path] = entry.content;
    }
    return json(201, { sha: addTree(tree) });
  }

  function writeCommit(body) {
    if (!trees.has(body.tree)) return refuse(422, "Tree SHA does not exist");
    return json(201, { sha: addCommit(body.tree, body.parents, body.message) });
  }

  function writeRef(body) {
    const name = body.ref.replace("refs/heads/", "");
    if (refs.has(name)) return refuse(422, "Reference already exists");
    refs.set(name, body.sha);
    return json(201, { ref: body.ref });
  }

  function writePull(body) {
    if (!refs.has(body.head) || !refs.has(body.base)) return refuse(422, "Validation Failed");
    const number = pulls.length + 1;
    const pull = { ...body, number, html_url: `https://github.com/${repo}/pull/${number}` };
    pulls.push(pull);
    return json(201, pull);
  }

  // Each route: its method, its path under the repository, and what answers.
  const routes = [
    ["GET", /^$/, () => json(200, { default_branch: defaultBranch, permissions: { push: true } })],
    ["GET", /^\/git\/ref\/heads\/(.+)$/, ({ match }) => found(refs.has(match) ? { object: { sha: refs.get(match) } } : undefined)],
    ["GET", /^\/git\/commits\/(.+)$/, ({ match }) => found(commits.get(match))],
    ["GET", /^\/contents\/(.+)$/, ({ match, url, accept }) => readContents(match, url.searchParams.get("ref"), accept)],
    ["POST", /^\/git\/trees$/, ({ body }) => writeTree(body)],
    ["POST", /^\/git\/commits$/, ({ body }) => writeCommit(body)],
    ["POST", /^\/git\/refs$/, ({ body }) => writeRef(body)],
    ["POST", /^\/pulls$/, ({ body }) => writePull(body)],
  ];

  function route(method, url, body, accept) {
    const prefix = `/repos/${repo}`;
    if (!url.pathname.startsWith(prefix)) return refuse(404, "Not Found");
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    for (const [verb, pattern, answer] of routes) {
      const match = verb === method && path.match(pattern);
      if (match) return answer({ match: match[1], url, body, accept });
    }
    return refuse(404, "Not Found");
  }

  async function request(input, init = {}) {
    const url = new URL(input);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ method, path: url.pathname + url.search, authorization: init.headers?.Authorization, body });
    if (url.origin !== "https://api.github.com") throw new Error(`The fake is not ${url.origin}`);
    if (init.headers?.Authorization !== `Bearer ${token}`) return refuse(401, "Bad credentials");
    return route(method, url, body, init.headers?.Accept ?? "");
  }

  return {
    fetch: request,
    requests,
    pulls,
    branch: (name) => refs.get(name),
    commit: (name) => commits.get(name),
    // The files on a branch or at a commit.
    files: (name) => trees.get(commits.get(refs.get(name) ?? name).tree.sha),
    // Someone else commits to a branch.
    push(branch, changes, message = "someone else") {
      const before = refs.get(branch);
      const tree = { ...trees.get(commits.get(before).tree.sha), ...changes };
      refs.set(branch, addCommit(addTree(tree), [before], message));
      return refs.get(branch);
    },
    written: () => requests.filter((r) => r.method !== "GET"),
  };
}

// Propose changes to a GitHub repository: one commit with all the changed files
// on a new branch, and a pull request for it. It runs as it is in a browser and
// in Node 20 or later, imports nothing, and keeps no token.

const API = "https://api.github.com";
const NOTHING = Object.freeze({ status: "nothing to change" });

// Send a request to GitHub's REST API, as api("/repos/o/r") or
// api("/repos/o/r/git/trees", { method: "POST", body }). It answers with the
// parsed JSON, or with the text of a file given { raw: true }, and throws an
// Error with the response's `status` when GitHub refuses. A token that is a
// function is asked for each request. `fetch` stands in for the global one.
export function github({ token, fetch: send = globalThis.fetch }) {
  return async function api(path, options = {}) {
    const response = await send(API + path, {
      method: options.method,
      headers: {
        Accept: options.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
        Authorization: `Bearer ${await resolve(token)}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const error = new Error(`GitHub said ${response.status}${detail.message ? `: ${detail.message}` : ""}`);
      error.status = response.status;
      throw error;
    }
    return options.raw ? response.text() : response.json();
  };
}

// Open a pull request on `repo` ("owner/name") from a new `branch`, with
// `changes`: an object from each file's path to its new text, or to null to
// delete it. The commit goes on the newest commit of `base` (by default the
// repository's default branch), or on `parent` where the caller read the files
// from a commit of its own: a change made to the same file since shows as a
// conflict, rather than being undone. `message` is the commit's, by default
// the title and the body.
//
// It answers { status: "opened", url, number, branch, commit }, or
// { status: "nothing to change" } when the repository already has every change,
// and then writes no commit, branch or pull request.
export async function propose({ repo, base, branch, title, body = "", message, parent, changes, token, fetch }) {
  for (const [name, value] of Object.entries({ repo, branch, title })) {
    if (!value) throw new TypeError(`propose needs a ${name}`);
  }
  const entries = changeEntries(changes);
  if (!entries.length) return NOTHING;

  const api = github({ token: await resolve(token), fetch });
  const at = `/repos/${repo}`;
  const target = base ?? (await api(at)).default_branch;
  const start = parent ?? (await api(`${at}/git/ref/heads/${encodePath(target)}`)).object.sha;
  const baseTree = (await api(`${at}/git/commits/${start}`)).tree.sha;

  // GitHub refuses to delete a file that isn't there.
  const missing = await Promise.all(
    entries.map(([path, content]) => content === null && isMissing(api, at, path, start)),
  );
  const tree = entries
    .filter((_, i) => !missing[i])
    .map(([path, content]) =>
      content === null ? { path, mode: "100644", type: "blob", sha: null } : { path, mode: "100644", type: "blob", content },
    );
  if (!tree.length) return NOTHING;

  // Git names a tree by its content, so the same name means the same files.
  const next = await api(`${at}/git/trees`, { method: "POST", body: { base_tree: baseTree, tree } });
  if (next.sha === baseTree) return NOTHING;

  const commit = await api(`${at}/git/commits`, {
    method: "POST",
    body: { message: message ?? (body ? `${title}\n\n${body}` : title), tree: next.sha, parents: [start] },
  });
  await api(`${at}/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha: commit.sha } });
  const pr = await api(`${at}/pulls`, { method: "POST", body: { title, head: branch, base: target, body } });
  return { status: "opened", url: pr.html_url, number: pr.number, branch, commit: commit.sha };
}

// The [path, content] pairs of `changes`, checked. fake.js takes the same.
export function changeEntries(changes) {
  if (changes === null || typeof changes !== "object" || Array.isArray(changes)) {
    throw new TypeError("changes is an object from each path to its new text, or to null to delete it");
  }
  const entries = Object.entries(changes);
  for (const [path, content] of entries) {
    if (!path) throw new TypeError("a change needs a path");
    if (content !== null && typeof content !== "string") {
      throw new TypeError(`The change to ${path} is neither text nor null`);
    }
  }
  return entries;
}

async function isMissing(api, at, path, ref) {
  try {
    await api(`${at}/contents/${encodePath(path)}?ref=${ref}`);
    return false;
  } catch (error) {
    if (error.status === 404) return true;
    throw error;
  }
}

async function resolve(token) {
  const value = typeof token === "function" ? await token() : token;
  if (!value) throw new Error("There is no GitHub token");
  return value;
}

const encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");

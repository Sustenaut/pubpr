# pubpr

Propose changes to a GitHub repository: one commit with all the changed files,
on a new branch, and a pull request for it. It is a single ES module with no
dependencies, and runs as it is in a browser and in Node 20 or later.

```js
import { propose } from "https://cdn.jsdelivr.net/gh/Sustenaut/pubpr@v0.1.0/lib/pubpr.js";

const result = await propose({
  repo: "owner/name",
  branch: "edit/new-opening-hours",
  title: "New opening hours",
  body: "Asked for by the shop.",
  changes: {
    "shops/coop/hours.json": '{ "monday": "9-18" }\n',
    "shops/coop/old-hours.txt": null,
  },
  token: () => sessionStorage.getItem("token"),
});
if (result.status === "opened") console.log(result.url);
```

In Node, install it from a release's tag and import `pubpr`:

```sh
npm install github:Sustenaut/pubpr#v0.1.0
```

Loading it from jsDelivr, pin the tag and give the file's hash, so a browser
runs only the file you reviewed:

```html
<script type="module" integrity="sha384-…" src="https://cdn.jsdelivr.net/gh/Sustenaut/pubpr@v0.1.0/lib/pubpr.js"></script>
```

## `propose`

`propose` finds the newest commit of the base, adds one commit on top of it
through GitHub's Git Data API, points a new branch at that commit, and opens a
pull request from it.

| Argument | |
|---|---|
| `repo` | `"owner/name"`. Required. |
| `branch` | The new branch. Required. A branch that exists already fails. |
| `title` | The pull request's title. Required. |
| `changes` | An object from each file's path to its new text, or to `null` to delete it. Required. |
| `token` | A string, or a function (it may be async) that returns one. Required. |
| `base` | The branch to propose to. By default, the repository's default branch. |
| `body` | The pull request's description. |
| `message` | The commit's message. By default, the title and the body. |
| `parent` | The commit to build on, instead of the newest one on `base`. |
| `expect` | An object from a path to the blob sha you read it at, or `null` if it was missing. Refuses if a file has moved. |
| `autoMerge` | `true` asks GitHub to merge the pull request once its required checks pass. |
| `fetch` | Stands in for the global `fetch`. |

It answers one of:

```js
{ status: "opened", url, number, branch, commit }
{ status: "opened", url, number, branch, commit, autoMerge }
{ status: "nothing to change" }
{ status: "stale", path }
```

`"nothing to change"` means the repository already has every change: each file
has that text, and each deleted file is gone. Then there is no commit, branch or
pull request. (GitHub does keep the tree object pubpr made to find that out. No
ref points at it.)

Anything GitHub refuses throws an `Error` with the response's `status` and a
message saying what GitHub said.

**`parent`.** If you read the files yourself and worked out the changes from
them, pass the commit you read. The commit then sits on what you read, so a
change someone else has since made to the same file shows up as a merge
conflict. Built on the newest commit instead, your older text would quietly undo
theirs.

**`expect`.** If what a person sees decides what they change, pass the blob sha
of the file they saw (the `sha` from GitHub's contents API). If the file has moved,
`propose` answers `"stale"` with its path and writes nothing, so they can look again.

**`autoMerge`.** The answer's `autoMerge` is `"on"`; `"merged"`, when GitHub has
nothing left to wait for; or GitHub's reason for refusing, since the pull request
exists either way. The repository must allow auto-merge. A token needs Contents and
Pull requests write, as it does for the rest.

**Limits.** Text only, since the changes go through the tree API's `content`.
Every written file is a regular file (mode `100644`), so a change to an
executable file drops its executable bit. A `null` is for a file, not a
directory.

## Tokens

pubpr keeps no token. It uses the one you pass for the length of the call, and
sends it only to `api.github.com`. Keeping it, refreshing it and asking the
person for it are the caller's job. A function is called once per `propose`.

A fine-grained token needs **Contents** and **Pull requests** set to read and
write on that repository. Because a token in a browser can be read by anything
running on that page, load this module (and everything else on the page) from
pinned, hashed addresses.

## `github`

The request function `propose` itself uses, for what you need to read first:

```js
import { github } from "pubpr";

const api = github({ token });
const repo = await api("/repos/owner/name");
const text = await api(`/repos/owner/name/contents/a.json?ref=${sha}`, { raw: true });
```

It answers the parsed JSON, or the text with `{ raw: true }`, and sends a `body`
as JSON. It throws the same `Error` as `propose`. A token that is a function is
called for each request, so a new sign-in counts from the next one.

## Testing what uses it

`pubpr/fake` has a publisher with the same `propose`, which writes the would-be
pull request to memory and never reaches the network:

```js
import { fakePublisher } from "pubpr/fake";

const publisher = fakePublisher({ files: { "a.txt": "old\n" } });
await publisher.propose({ repo: "o/r", branch: "b", title: "T", changes: { "a.txt": "new\n" } });
publisher.proposals[0].changes; // { "a.txt": "new\n" }
```

`files` is what the repository already has, so that `"nothing to change"` comes
back when it would from GitHub. It does not need a token.

## Developing

```sh
npm test
```

The tests run with `node --test` against the fake GitHub in
`test/fake-github.js`, and never reach the network. Pull requests that change
`lib/` record what they change with `pubrel add`; a release is cut with `pubrel
prepare` from a checkout whose `corpus/.publet` holds the release key, and merging
its pull request tags it. See [pubkit](https://github.com/Sustenaut/pubkit#readme)
for the shared setup.

## Licence

Apache-2.0: see [LICENSE](LICENSE).

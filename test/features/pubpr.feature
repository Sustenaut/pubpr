@pubpr
Feature: propose and github, against GitHub, recorded and replayed
  pubpr makes one commit and a pull request from a set of changes, and
  refuses before any request what it cannot send.

  Each scenario's calls replay its cassette, recorded with `pubtest record`
  against a repository of the GitHub test org that integrations' steps make
  for it: "o/r" here. A commit is named by its label: "start" for the one the
  repository's files are in, or the one someone else's push gave it. What
  GitHub refuses on purpose comes from a fault put on the calls, not from
  the recording.

  A proposal is to o/r, on the branch edit/one, titled "Edit things",
  changing a.txt to "new", with the recorder's token, unless a scenario says
  otherwise.

  Scenario: A proposal opens a pull request
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n", "b.txt": "keep\n", "dir/c.txt": "go\n"}
      """
    When I propose:
      """
      {"body": "Why.", "changes": {"a.txt": "new\n", "dir/d.txt": "added\n", "dir/c.txt": null}}
      """
    Then the result's "status" is "opened"
    And the result's "url" is "https://github.com/o/r/pull/1"
    And the result's "number" is "1"
    And the result's "branch" is "edit/one"

  Scenario: One commit holds every change, on the newest base
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n", "b.txt": "keep\n", "dir/c.txt": "go\n"}
      """
    When I propose:
      """
      {"body": "Why.", "changes": {"a.txt": "new\n", "dir/d.txt": "added\n", "dir/c.txt": null}}
      """
    And I read the commit it made
    Then the result's "heads" is '["edit/one"]'
    And the result's "parents" is '["start"]'

  Scenario: The branch holds every change, and main is untouched
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n", "b.txt": "keep\n", "dir/c.txt": "go\n"}
      """
    When I propose:
      """
      {"body": "Why.", "changes": {"a.txt": "new\n", "dir/d.txt": "added\n", "dir/c.txt": null}}
      """
    And I read the files on "edit/one"
    Then the result is:
      """
      {"a.txt": "new\n", "b.txt": "keep\n", "dir/d.txt": "added\n"}
      """

  Scenario: A proposal writes one commit, its branch and a pull request, and leaves main as it was
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n", "b.txt": "keep\n", "dir/c.txt": "go\n"}
      """
    When I propose:
      """
      {"body": "Why.", "changes": {"a.txt": "new\n", "dir/d.txt": "added\n", "dir/c.txt": null}}
      """
    And I read what GitHub holds
    Then the result's "main" is "start"
    And the result's "edit/one" is "the commit it made"
    And the result's "written" is '["POST /repos/o/r/git/trees", "POST /repos/o/r/git/commits", "POST /repos/o/r/git/refs", "POST /repos/o/r/pulls"]'

  Scenario: The pull request is titled, explained, and from the branch to the default one
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n", "b.txt": "keep\n", "dir/c.txt": "go\n"}
      """
    When I propose:
      """
      {"body": "Why.", "changes": {"a.txt": "new\n", "dir/d.txt": "added\n", "dir/c.txt": null}}
      """
    And I read the pull requests
    Then the result is:
      """
      [{"title": "Edit things", "body": "Why.", "head": "edit/one", "base": "main", "number": 1, "merged": false}]
      """

  Scenario: The commit goes on what the base is now, not what it was
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And I have proposed:
      """
      {}
      """
    And someone else pushes to "main" of "o/r" as commit "theirs":
      """
      {"b.txt": "theirs\n"}
      """
    When I propose:
      """
      {"branch": "edit/two", "changes": {"c.txt": "mine\n"}}
      """
    And I read the commit it made
    Then the result's "parents" is '["theirs"]'

  Scenario: The commit holds what the base holds now
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And I have proposed:
      """
      {}
      """
    And someone else pushes to "main" of "o/r" as commit "theirs":
      """
      {"b.txt": "theirs\n"}
      """
    When I propose:
      """
      {"branch": "edit/two", "changes": {"c.txt": "mine\n"}}
      """
    And I read the files on "edit/two"
    Then the result is:
      """
      {"a.txt": "old\n", "b.txt": "theirs\n", "c.txt": "mine\n"}
      """

  Scenario: A named base is used
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And someone else pushes to "stable" of "o/r":
      """
      {"s.txt": "s\n"}
      """
    When I propose:
      """
      {"base": "stable", "branch": "edit/two"}
      """
    And I read the pull requests
    Then the result's "0.base" is "stable"

  Scenario: A proposal on a named base holds what that base holds
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And someone else pushes to "stable" of "o/r":
      """
      {"s.txt": "s\n"}
      """
    When I propose:
      """
      {"base": "stable", "branch": "edit/two"}
      """
    And I read the files of the commit it made
    Then the result is:
      """
      {"a.txt": "new\n", "s.txt": "s\n"}
      """

  Scenario: With a named base, the default branch isn't looked up
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And someone else pushes to "stable" of "o/r":
      """
      {"s.txt": "s\n"}
      """
    When I propose:
      """
      {"base": "stable", "branch": "edit/two"}
      """
    And I list the requests the proposal sent to GitHub
    Then the result does not include "GET /repos/o/r"

  Scenario: A parent keeps the commit on what the caller read
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And someone else pushes to "main" of "o/r" as commit "theirs":
      """
      {"a.txt": "theirs\n"}
      """
    When I propose:
      """
      {"parent": "{commit start}"}
      """
    And I read the commit it made
    Then the result's "parents" is '["start"]'

  Scenario: A proposal with a parent still asks to merge into the default branch
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And someone else pushes to "main" of "o/r" as commit "theirs":
      """
      {"a.txt": "theirs\n"}
      """
    When I propose:
      """
      {"parent": "{commit start}"}
      """
    And I read the pull requests
    Then the result's "0.base" is "main"

  Scenario Outline: <name> is nothing to change
    Given the GitHub repository "o/r" holds:
      """
      <files>
      """
    When I propose:
      """
      {"changes": <changes>}
      """
    Then the result is:
      """
      {"status": "nothing to change"}
      """

    Examples:
      | name                                | files                | changes                                |
      | No changes                          | {"a.txt": "old\\n"}  | {}                                     |
      | A file that already has that text   | {"a.txt": "same\\n"} | {"a.txt": "same\\n"}                   |
      | A delete of a file that isn't there | {"a.txt": "old\\n"}  | {"gone.txt": null}                     |
      | Both                                | {"a.txt": "same\\n"} | {"a.txt": "same\\n", "gone.txt": null} |

  Scenario Outline: <name> writes nothing that shows
    Given the GitHub repository "o/r" holds:
      """
      <files>
      """
    When I propose:
      """
      {"changes": <changes>}
      """
    And I read what GitHub holds
    Then the result's "main" is "start"
    And the result's "edit/one" is "null"
    And the result's "pulls" is "0"
    And the result's "written" is '<written>'

    Examples:
      | name                                | files                | changes                                | written                       |
      | No changes                          | {"a.txt": "old\\n"}  | {}                                     | []                            |
      | A file that already has that text   | {"a.txt": "same\\n"} | {"a.txt": "same\\n"}                   | ["POST /repos/o/r/git/trees"] |
      | A delete of a file that isn't there | {"a.txt": "old\\n"}  | {"gone.txt": null}                     | []                            |
      | Both                                | {"a.txt": "same\\n"} | {"a.txt": "same\\n", "gone.txt": null} | ["POST /repos/o/r/git/trees"] |

  Scenario: A delete of a missing file doesn't stop the rest
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    When I propose:
      """
      {"changes": {"gone.txt": null, "a.txt": "new\n"}}
      """
    Then the result's "status" is "opened"

  Scenario: A delete of a missing file leaves the rest to change
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    When I propose:
      """
      {"changes": {"gone.txt": null, "a.txt": "new\n"}}
      """
    And I read the files on "edit/one"
    Then the result is:
      """
      {"a.txt": "new\n"}
      """

  Scenario: A missing file GitHub says is not found is not deleted, and the rest still changes
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n", "b.txt": "keep\n"}
      """
    And the "github" integration answers "GET /repos/*/contents/b.txt" with 404 and:
      """
      {"message": "Not Found"}
      """
    When I propose:
      """
      {"changes": {"b.txt": null, "a.txt": "new\n"}}
      """
    And I read the files on "edit/one"
    Then the result is:
      """
      {"a.txt": "new\n", "b.txt": "keep\n"}
      """

  Scenario: A path is encoded, whatever is in it
    Given the GitHub repository "o/r" holds:
      """
      {"a b/c#d?.txt": "old\n"}
      """
    When I propose:
      """
      {"changes": {"a b/c#d?.txt": null, "x.txt": "x\n"}}
      """
    And I read the files on "edit/one"
    Then the result is:
      """
      {"x.txt": "x\n"}
      """

  Scenario: The commit message is the title
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    When I propose the default change
    And I read the commit it made
    Then the result's "message" is "Edit things"

  Scenario: The commit message is the title and body
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    When I propose:
      """
      {"branch": "b", "body": "Why."}
      """
    And I read the commit it made
    Then the result's "message's lines" is '["Edit things", "", "Why."]'

  Scenario: The commit message is the one given, and the pull request keeps the body
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    When I propose:
      """
      {"branch": "c", "body": "Why.", "message": "Mine\n\n- one\n"}
      """
    And I read the commit it made
    Then the result's "message's lines" is '["Mine", "", "- one", ""]'

  Scenario: The pull request keeps the body when the message is given
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    When I propose:
      """
      {"branch": "c", "body": "Why.", "message": "Mine\n\n- one\n"}
      """
    And I read the pull requests
    Then the result's "0.body" is "Why."

  Scenario: A token may be an async function
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And my token is an async function
    When I propose the default change
    Then the result's "status" is "opened"

  Scenario: A token function is asked once per proposal
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And my token is an async function
    When I propose the default change
    And I count how often my token was asked for
    Then the result is "1"

  Scenario: Every request carries the token the function answers
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And my token is an async function
    When I propose the default change
    And I list the tokens the requests to GitHub carried
    Then the result is '["Bearer my token"]'

  Scenario Outline: A token that is <name> fails
    When I propose:
      """
      {"token": <token>}
      """
    Then it is refused, saying "no GitHub token"

    Examples:
      | name  | token         |
      | none  | "{undefined}" |
      | empty | ""            |

  Scenario Outline: A token that is <name> fails before any request
    When I propose:
      """
      {"token": <token>}
      """
    And I list the requests the proposal sent to GitHub
    Then the result is "[]"

    Examples:
      | name  | token         |
      | none  | "{undefined}" |
      | empty | ""            |

  Scenario: A token function that finds none fails
    Given my token is an async function that finds none
    When I propose the default change
    Then it is refused, saying "no GitHub token"

  Scenario: A token function that finds none fails before any request
    Given my token is an async function that finds none
    When I propose the default change
    And I list the requests the proposal sent to GitHub
    Then the result is "[]"

  Scenario: What GitHub refuses comes back with its status, and without the token
    Given the "github" integration answers "GET /repos/*" with 401 and:
      """
      {"message": "Bad credentials", "status": "401"}
      """
    When I propose:
      """
      {"token": "wrong-token"}
      """
    And I read the status of the refusal, and whether it holds "wrong-token"
    Then the result's "status" is "401"
    And the result's "message" is "GitHub said 401: Bad credentials"
    And the result's "holds" is "false"

  Scenario: A failure other than a missing file while checking a delete still fails
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And the "github" integration answers "GET /repos/*/contents/*" with 403 and:
      """
      {"message": "Resource not accessible by integration"}
      """
    When I propose:
      """
      {"changes": {"a.txt": null}}
      """
    And I read the status of the refusal, and whether it holds "ghs_"
    Then the result's "status" is "403"
    And the result's "holds" is "false"

  Scenario: A failure while checking a delete writes nothing
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And the "github" integration answers "GET /repos/*/contents/*" with 403 and:
      """
      {"message": "Resource not accessible by integration"}
      """
    When I propose:
      """
      {"changes": {"a.txt": null}}
      """
    And I read what GitHub holds
    Then the result's "written" is "[]"

  Scenario: A server error while checking a delete fails as the Caller says
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And the "github" integration answers "GET /repos/*/contents/*" with 500 and:
      """
      {"message": "Server Error"}
      """
    When I propose:
      """
      {"changes": {"a.txt": null}}
      """
    Then it is refused, saying "github.edit-pr open-pr: HTTP 500"

  Scenario: A branch that exists fails
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And the "github" integration answers "POST /repos/*/git/refs" with 422 and:
      """
      {"message": "Reference already exists"}
      """
    When I propose:
      """
      {"changes": {"b.txt": "b\n"}}
      """
    Then it is refused, saying "Reference already exists"

  Scenario: A branch that exists opens no pull request
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And the "github" integration answers "POST /repos/*/git/refs" with 422 and:
      """
      {"message": "Reference already exists"}
      """
    When I propose:
      """
      {"changes": {"b.txt": "b\n"}}
      """
    And I read what GitHub holds
    Then the result's "pulls" is "0"
    And the result's "written" is '["POST /repos/o/r/git/trees", "POST /repos/o/r/git/commits", "POST /repos/o/r/git/refs"]'

  Scenario Outline: Propose without a <missing> fails
    When I propose:
      """
      {"<missing>": "{undefined}"}
      """
    Then it is refused, saying "needs a <missing>"

    Examples:
      | missing |
      | repo    |
      | branch  |
      | title   |

  Scenario Outline: Propose without a <missing> fails before any request
    When I propose:
      """
      {"<missing>": "{undefined}"}
      """
    And I list the requests the proposal sent to GitHub
    Then the result is "[]"

    Examples:
      | missing |
      | repo    |
      | branch  |
      | title   |

  Scenario Outline: Changes that are <name> fail
    When I propose:
      """
      {"changes": <changes>}
      """
    Then it is refused, saying "<saying>"

    Examples:
      | name                  | changes                         | saying                         |
      | a list                | [{"path": "a", "content": "b"}] | changes is an object           |
      | null                  | null                            | changes is an object           |
      | undefined             | "{undefined}"                   | changes is an object           |
      | a number for content  | {"a.txt": 1}                    | a.txt is neither text nor null |
      | undefined for content | {"a.txt": "{undefined}"}        | a.txt is neither text nor null |
      | an empty path         | {"": "x"}                       | needs a path                   |

  Scenario Outline: Changes that are <name> fail before any request
    When I propose:
      """
      {"changes": <changes>}
      """
    And I list the requests the proposal sent to GitHub
    Then the result is "[]"

    Examples:
      | name                  | changes                         |
      | a list                | [{"path": "a", "content": "b"}] |
      | null                  | null                            |
      | undefined             | "{undefined}"                   |
      | a number for content  | {"a.txt": 1}                    |
      | undefined for content | {"a.txt": "{undefined}"}        |
      | an empty path         | {"": "x"}                       |

  Scenario: github answers JSON
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "text\n"}
      """
    When I ask github for "/repos/o/r"
    Then the result's "default_branch" is "main"

  Scenario: github answers a file's text when asked for it raw
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "text\n"}
      """
    When I ask github for "/repos/o/r/contents/a.txt" on main, raw
    Then the result is:
      """
      text

      """

  Scenario: github asks a token function each time, so a new sign-in counts
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And the "github" integration answers with 401, then as recorded
    When I ask github for "/repos/o/r" twice, with a token function that answers "wrong", then mine
    Then the result is:
      """
      {"answers": ["refused with 401", "main"], "tokens": ["Bearer wrong", "Bearer my token"]}
      """

  Scenario: An error without a message says the status alone
    When I ask github for "/x" of a server that answers 502 with "<html>"
    And I read the status of the refusal, and whether it holds "secret"
    Then the result's "message" is "GitHub said 502"
    And the result's "status" is "502"

  Scenario: github uses the global fetch unless told otherwise
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    When I ask github for "/repos/o/r" with no fetch given
    Then the result's "default_branch" is "main"

  Scenario: Expect lets a proposal through when each file is as read
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And I have read the blob sha of "a.txt"
    When I propose:
      """
      {"expect": {"a.txt": "{blob I read of a.txt}", "new.txt": null}, "changes": {"a.txt": "new\n", "new.txt": "n\n"}}
      """
    Then the result's "status" is "opened"

  Scenario Outline: Expect refuses <name>
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    When I propose:
      """
      {"expect": <expect>}
      """
    Then the result is '{"status": "stale", "path": "<path>"}'

    Examples:
      | name                     | expect                          | path     |
      | a file that has changed  | {"a.txt": "{blob of older\\n}"} | a.txt    |
      | a file that has gone     | {"gone.txt": "abc"}             | gone.txt |
      | a file that has appeared | {"a.txt": null}                 | a.txt    |

  Scenario Outline: Expect refusing <name> writes nothing
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    When I propose:
      """
      {"expect": <expect>}
      """
    And I read what GitHub holds
    Then the result's "written" is "[]"

    Examples:
      | name                     | expect                          |
      | a file that has changed  | {"a.txt": "{blob of older\\n}"} |
      | a file that has gone     | {"gone.txt": "abc"}             |
      | a file that has appeared | {"a.txt": null}                 |

  Scenario: Expect looks at the newest commit by default
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And I have read the blob sha of "a.txt"
    And someone else pushes to "main" of "o/r" as commit "theirs":
      """
      {"a.txt": "theirs\n"}
      """
    When I propose:
      """
      {"expect": {"a.txt": "{blob I read of a.txt}"}}
      """
    Then the result's "status" is "stale"

  Scenario: Expect looks at what the proposal builds on
    Given the GitHub repository "o/r" holds:
      """
      {"a.txt": "old\n"}
      """
    And I have read the blob sha of "a.txt"
    And someone else pushes to "main" of "o/r" as commit "theirs":
      """
      {"a.txt": "theirs\n"}
      """
    When I propose:
      """
      {"expect": {"a.txt": "{blob I read of a.txt}"}, "parent": "{commit start}"}
      """
    Then the result's "status" is "opened"

  Scenario: AutoMerge turns it on, and says so
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And the "github" integration answers "POST /graphql" with 200 and:
      """
      {"data": {"enablePullRequestAutoMerge": {"clientMutationId": null}}}
      """
    When I propose:
      """
      {"autoMerge": true}
      """
    Then the result's "autoMerge" is "on"

  Scenario: AutoMerge asks GitHub to merge the pull request once it may, and merges nothing now
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And the "github" integration answers "POST /graphql" with 200 and:
      """
      {"data": {"enablePullRequestAutoMerge": {"clientMutationId": null}}}
      """
    When I propose:
      """
      {"autoMerge": true}
      """
    And I read the auto-merges asked for and the merges made
    Then the result is '{"autoMerges": [1], "merged": []}'

  Scenario: Without autoMerge, the answer says nothing of it
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    When I propose the default change
    Then the result does not include "autoMerge"

  Scenario: Without autoMerge, nothing is asked
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    When I propose the default change
    And I read the auto-merges asked for and the merges made
    Then the result's "autoMerges" is "[]"

  Scenario: AutoMerge merges now when GitHub says there's nothing left to wait for
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And the "github" integration answers "POST /graphql" with 200 and:
      """
      {"data": null, "errors": [{"message": "Pull request Pull request is in clean status"}]}
      """
    When I propose:
      """
      {"autoMerge": true}
      """
    Then the result's "autoMerge" is "merged"

  Scenario: AutoMerge merging now merges the pull request
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And the "github" integration answers "POST /graphql" with 200 and:
      """
      {"data": null, "errors": [{"message": "Pull request Pull request is in clean status"}]}
      """
    When I propose:
      """
      {"autoMerge": true}
      """
    And I read the pull requests
    Then the result's "0.merged" is "true"

  Scenario: AutoMerge being refused is reported, and the pull request still stands
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And the "github" integration answers "POST /graphql" with 200 and:
      """
      {"data": null, "errors": [{"message": "Auto merge is not allowed for this repository"}]}
      """
    When I propose:
      """
      {"autoMerge": true}
      """
    Then the result's "status" is "opened"
    And the result's "url" is "https://github.com/o/r/pull/1"
    And the result's "autoMerge" is "Auto merge is not allowed for this repository"

  Scenario: AutoMerge failing outright is reported too
    Given the GitHub repository "o/r" holds:
      """
      {"README.md": "r\n"}
      """
    And the "github" integration answers "POST /graphql" with 502 and:
      """
      {"message": "Bad Gateway"}
      """
    When I propose:
      """
      {"autoMerge": true}
      """
    Then the result's "status" is "opened"
    And the result's "autoMerge" includes "HTTP 502"

  Scenario: The package needs nothing: no dependencies, no imports, nothing only Node has
    When I read the package
    Then the result is:
      """
      {"dependencies": null, "imports": false, "Node's own": []}
      """

@pubpr
Feature: propose and github, against the fake GitHub in test/fake-github.js
  pubpr makes one commit and a pull request from a set of changes, and
  refuses before any request what it cannot send.

  A proposal is to o/r, on the branch edit/one, titled "Edit things",
  changing a.txt to "new", with the token "secret", which the fake GitHub
  takes, unless a scenario says otherwise.

  Scenario: A proposal opens a pull request
    Given a GitHub repository o/r holding:
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
    Given a GitHub repository o/r holding:
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
    Given a GitHub repository o/r holding:
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
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n", "b.txt": "keep\n", "dir/c.txt": "go\n"}
      """
    When I propose:
      """
      {"body": "Why.", "changes": {"a.txt": "new\n", "dir/d.txt": "added\n", "dir/c.txt": null}}
      """
    And I read what GitHub holds
    Then the result's "main" is "start"
    And the result's "written" is '["POST /repos/o/r/git/trees", "POST /repos/o/r/git/commits", "POST /repos/o/r/git/refs", "POST /repos/o/r/pulls"]'

  Scenario: The pull request is titled, explained, and from the branch to the default one
    Given a GitHub repository o/r holding:
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
      [{"title": "Edit things", "body": "Why.", "head": "edit/one", "base": "main", "number": 1}]
      """

  Scenario: The commit goes on what the base is now, not what it was
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    And I have proposed:
      """
      {}
      """
    And someone else commits to "main", labelled "theirs":
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
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    And I have proposed:
      """
      {}
      """
    And someone else commits to "main", labelled "theirs":
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
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    And I have proposed:
      """
      {"branch": "stable", "changes": {"s.txt": "s\n"}}
      """
    When I propose:
      """
      {"base": "stable", "branch": "edit/two"}
      """
    And I read the pull requests
    Then the result's "1.base" is "stable"

  Scenario: A proposal on a named base holds what that base holds
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    And I have proposed:
      """
      {"branch": "stable", "changes": {"s.txt": "s\n"}}
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
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    And I have proposed:
      """
      {"branch": "stable", "changes": {"s.txt": "s\n"}}
      """
    When I propose:
      """
      {"base": "stable", "branch": "edit/two"}
      """
    And I list the requests the proposal sent to GitHub
    Then the result does not include "GET /repos/o/r"

  Scenario: A parent keeps the commit on what the caller read
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    And I read "main" as the commit "read"
    And someone else commits to "main", labelled "theirs":
      """
      {"a.txt": "theirs\n"}
      """
    When I propose:
      """
      {"parent": "{commit read}"}
      """
    And I read the commit it made
    Then the result's "parents" is '["read"]'

  Scenario: A proposal with a parent still asks to merge into the default branch
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    And I read "main" as the commit "read"
    And someone else commits to "main", labelled "theirs":
      """
      {"a.txt": "theirs\n"}
      """
    When I propose:
      """
      {"parent": "{commit read}"}
      """
    And I read the pull requests
    Then the result's "0.base" is "main"

  Scenario Outline: <name> is nothing to change
    Given a GitHub repository o/r holding:
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
    Given a GitHub repository o/r holding:
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
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    When I propose:
      """
      {"changes": {"gone.txt": null, "a.txt": "new\n"}}
      """
    Then the result's "status" is "opened"

  Scenario: A delete of a missing file leaves the rest to change
    Given a GitHub repository o/r holding:
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

  Scenario: A path is encoded, whatever is in it
    Given a GitHub repository o/r holding:
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
    Given a GitHub repository o/r with nothing in it
    When I propose the default change
    And I read the commit it made
    Then the result's "message" is "Edit things"

  Scenario: The commit message is the title and body
    Given a GitHub repository o/r with nothing in it
    When I propose:
      """
      {"branch": "b", "body": "Why."}
      """
    And I read the commit it made
    Then the result's "message's lines" is '["Edit things", "", "Why."]'

  Scenario: The commit message is the one given, and the pull request keeps the body
    Given a GitHub repository o/r with nothing in it
    When I propose:
      """
      {"branch": "c", "body": "Why.", "message": "Mine\n\n- one\n"}
      """
    And I read the commit it made
    Then the result's "message's lines" is '["Mine", "", "- one", ""]'

  Scenario: The pull request keeps the body when the message is given
    Given a GitHub repository o/r with nothing in it
    When I propose:
      """
      {"branch": "c", "body": "Why.", "message": "Mine\n\n- one\n"}
      """
    And I read the pull requests
    Then the result's "0.body" is "Why."

  Scenario: A token may be an async function
    Given a GitHub repository o/r with nothing in it
    And my token is an async function that answers "secret"
    When I propose the default change
    Then the result's "status" is "opened"

  Scenario: A token function is asked once per proposal
    Given a GitHub repository o/r with nothing in it
    And my token is an async function that answers "secret"
    When I propose the default change
    And I count how often my token was asked for
    Then the result is "1"

  Scenario: Every request carries the token the function answers
    Given a GitHub repository o/r with nothing in it
    And my token is an async function that answers "secret"
    When I propose the default change
    And I list the tokens the requests to GitHub carried
    Then the result is '["Bearer secret"]'

  Scenario Outline: A token that is <name> fails
    Given a GitHub repository o/r with nothing in it
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
    Given a GitHub repository o/r with nothing in it
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
    Given a GitHub repository o/r with nothing in it
    And my token is an async function that finds none
    When I propose the default change
    Then it is refused, saying "no GitHub token"

  Scenario: A token function that finds none fails before any request
    Given a GitHub repository o/r with nothing in it
    And my token is an async function that finds none
    When I propose the default change
    And I list the requests the proposal sent to GitHub
    Then the result is "[]"

  Scenario: What GitHub refuses comes back with its status, and without the token
    Given a GitHub repository o/r with nothing in it
    When I propose:
      """
      {"token": "wrong-token"}
      """
    And I read the status of the refusal, and whether it holds "wrong-token"
    Then the result's "status" is "401"
    And the result's "message" is "GitHub said 401: Bad credentials"
    And the result's "holds" is "false"

  Scenario: A failure other than a missing file while checking a delete still fails
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    And GitHub answers 500 when asked for a file's contents
    When I propose:
      """
      {"changes": {"a.txt": null}}
      """
    And I read the status of the refusal, and whether it holds "secret"
    Then the result's "status" is "500"

  Scenario: A failure while checking a delete writes nothing
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    And GitHub answers 500 when asked for a file's contents
    When I propose:
      """
      {"changes": {"a.txt": null}}
      """
    And I read what GitHub holds
    Then the result's "written" is "[]"

  Scenario: A branch that exists fails
    Given a GitHub repository o/r with nothing in it
    And I have proposed:
      """
      {}
      """
    When I propose:
      """
      {"changes": {"b.txt": "b\n"}}
      """
    Then it is refused, saying "Reference already exists"

  Scenario: A branch that exists opens no pull request
    Given a GitHub repository o/r with nothing in it
    And I have proposed:
      """
      {}
      """
    When I propose:
      """
      {"changes": {"b.txt": "b\n"}}
      """
    And I read what GitHub holds
    Then the result's "pulls" is "1"

  Scenario Outline: Propose without a <missing> fails
    Given a GitHub repository o/r with nothing in it
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
    Given a GitHub repository o/r with nothing in it
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
    Given a GitHub repository o/r with nothing in it
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
    Given a GitHub repository o/r with nothing in it
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
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "text\n"}
      """
    When I ask github for "/repos/o/r"
    Then the result's "default_branch" is "main"

  Scenario: github answers a file's text when asked for it raw
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "text\n"}
      """
    When I ask github for "/repos/o/r/contents/a.txt" on main, raw
    Then the result is:
      """
      text

      """

  Scenario: github asks a token function each time, so a new sign-in counts
    Given a GitHub repository o/r with nothing in it
    When I ask github for "/repos/o/r" with a token function that answers "wrong", then "secret"
    Then the result is '["refused with 401", "main"]'

  Scenario: An error without a message says the status alone
    When I ask github for "/x" of a server that answers 502 with "<html>"
    And I read the status of the refusal, and whether it holds "secret"
    Then the result's "message" is "GitHub said 502"
    And the result's "status" is "502"

  Scenario: github uses the global fetch unless told otherwise
    Given a GitHub repository o/r with nothing in it
    When I ask github for "/repos/o/r" with no fetch given
    Then the result's "default_branch" is "main"

  Scenario: Expect lets a proposal through when each file is as read
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    When I propose:
      """
      {"expect": {"a.txt": "{blob of old\\n}", "new.txt": null}, "changes": {"a.txt": "new\n", "new.txt": "n\n"}}
      """
    Then the result's "status" is "opened"

  Scenario Outline: Expect refuses <name>
    Given a GitHub repository o/r holding:
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
    Given a GitHub repository o/r holding:
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
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    And I read "main" as the commit "read"
    And someone else commits to "main", labelled "theirs":
      """
      {"a.txt": "theirs\n"}
      """
    When I propose:
      """
      {"expect": {"a.txt": "{blob of old\\n}"}}
      """
    Then the result's "status" is "stale"

  Scenario: Expect looks at what the proposal builds on
    Given a GitHub repository o/r holding:
      """
      {"a.txt": "old\n"}
      """
    And I read "main" as the commit "read"
    And someone else commits to "main", labelled "theirs":
      """
      {"a.txt": "theirs\n"}
      """
    When I propose:
      """
      {"expect": {"a.txt": "{blob of old\\n}"}, "parent": "{commit read}"}
      """
    Then the result's "status" is "opened"

  Scenario: AutoMerge turns it on, and says so
    Given a GitHub repository o/r with nothing in it
    When I propose:
      """
      {"autoMerge": true}
      """
    Then the result's "autoMerge" is "on"

  Scenario: AutoMerge asks GitHub to merge the pull request once it may, and merges nothing now
    Given a GitHub repository o/r with nothing in it
    When I propose:
      """
      {"autoMerge": true}
      """
    And I read the auto-merges asked for and the merges made
    Then the result is '{"autoMerges": ["PR_1"], "merged": []}'

  Scenario: Without autoMerge, the answer says nothing of it
    Given a GitHub repository o/r with nothing in it
    When I propose the default change
    Then the result does not include "autoMerge"

  Scenario: Without autoMerge, nothing is asked
    Given a GitHub repository o/r with nothing in it
    When I propose the default change
    And I read the auto-merges asked for and the merges made
    Then the result's "autoMerges" is "[]"

  Scenario: AutoMerge merges now when GitHub says there's nothing left to wait for
    Given a GitHub repository o/r with nothing in it
    And GitHub answers a request for auto-merge with the error "Pull request Pull request is in clean status"
    When I propose:
      """
      {"autoMerge": true}
      """
    Then the result's "autoMerge" is "merged"

  Scenario: AutoMerge merging now merges the pull request
    Given a GitHub repository o/r with nothing in it
    And GitHub answers a request for auto-merge with the error "Pull request Pull request is in clean status"
    When I propose:
      """
      {"autoMerge": true}
      """
    And I read the auto-merges asked for and the merges made
    Then the result's "merged" is "[1]"

  Scenario: AutoMerge being refused is reported, and the pull request still stands
    Given a GitHub repository o/r with nothing in it
    And GitHub answers a request for auto-merge with the error "Auto merge is not allowed for this repository"
    When I propose:
      """
      {"autoMerge": true}
      """
    Then the result's "status" is "opened"
    And the result's "url" is "https://github.com/o/r/pull/1"
    And the result's "autoMerge" is "Auto merge is not allowed for this repository"

  Scenario: AutoMerge failing outright is reported too
    Given a GitHub repository o/r with nothing in it
    And GitHub answers 502 when asked to auto-merge
    When I propose:
      """
      {"autoMerge": true}
      """
    Then the result's "status" is "opened"
    And the result's "autoMerge" is "GitHub said 502"

  Scenario: The package needs nothing: no dependencies, no imports, nothing only Node has
    When I read the package
    Then the result is:
      """
      {"dependencies": null, "imports": false, "Node's own": []}
      """

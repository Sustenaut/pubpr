@pubpr
Feature: propose and github, against the fake GitHub in test/fake-github.js
  pubpr makes one commit and a pull request from a set of changes, and
  refuses before any request what it cannot send.

  Scenario: One commit holds every change, on the newest base, and a pull request opens for it
    Then one commit holds every change, on the newest base, and a pull request opens for it

  Scenario: The commit goes on what the base is now, not what it was
    Then the commit goes on what the base is now, not what it was

  Scenario: A named base is used, and the default branch isn't looked up
    Then a named base is used, and the default branch isn't looked up

  Scenario: A parent keeps the commit on what the caller read
    Then a parent keeps the commit on what the caller read

  Scenario: <name> is nothing to change, and writes nothing that shows
    Then <name> is nothing to change, and writes nothing that shows

  Scenario: A delete of a missing file doesn't stop the rest
    Then a delete of a missing file doesn't stop the rest

  Scenario: A path is encoded, whatever is in it
    Then a path is encoded, whatever is in it

  Scenario: The commit message is the title and body, or the one given
    Then the commit message is the title and body, or the one given

  Scenario: A token may be an async function, asked once per proposal
    Then a token may be an async function, asked once per proposal

  Scenario: A token that is <name> fails before any request
    Then a token that is <name> fails before any request

  Scenario: What GitHub refuses comes back with its status, and without the token
    Then what GitHub refuses comes back with its status, and without the token

  Scenario: A failure other than a missing file while checking a delete still fails
    Then a failure other than a missing file while checking a delete still fails

  Scenario: A branch that exists fails, and opens no pull request
    Then a branch that exists fails, and opens no pull request

  Scenario: Propose without a <missing> fails before any request
    Then propose without a <missing> fails before any request

  Scenario: Changes that are <name> fail before any request
    Then changes that are <name> fail before any request

  Scenario: Github answers JSON, or a file's text when asked for it raw
    Then github answers JSON, or a file's text when asked for it raw

  Scenario: Github asks a token function each time, so a new sign-in counts
    Then github asks a token function each time, so a new sign-in counts

  Scenario: An error without a message says the status alone
    Then an error without a message says the status alone

  Scenario: Github uses the global fetch unless told otherwise
    Then github uses the global fetch unless told otherwise

  Scenario: Expect lets a proposal through when each file is as read
    Then expect lets a proposal through when each file is as read

  Scenario: Expect refuses <name>, and writes nothing
    Then expect refuses <name>, and writes nothing

  Scenario: Expect looks at what the proposal builds on, the newest commit by default
    Then expect looks at what the proposal builds on, the newest commit by default

  Scenario: AutoMerge turns it on, and says so
    Then autoMerge turns it on, and says so

  Scenario: Without autoMerge, nothing is asked
    Then without autoMerge, nothing is asked

  Scenario: AutoMerge merges now when GitHub says there's nothing left to wait for
    Then autoMerge merges now when GitHub says there's nothing left to wait for

  Scenario: AutoMerge being refused is reported, and the pull request still stands
    Then autoMerge being refused is reported, and the pull request still stands

  Scenario: AutoMerge failing outright is reported too
    Then autoMerge failing outright is reported too

  Scenario: The package needs nothing: no dependencies, no imports, nothing only Node has
    Then the package needs nothing: no dependencies, no imports, nothing only Node has

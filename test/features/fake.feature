@fake
Feature: The fake publisher a program's own tests use

  A proposal is to o/r, on the branch b, titled "T", changing a.txt to
  "new", unless a scenario says otherwise. What the fake keeps shows a field
  left out as "{undefined}".

  Scenario: The would-be pull request is answered as propose answers
    Given a fake publisher
    When I ask the fake publisher to propose:
      """
      {"base": "main", "body": "Why.", "changes": {"a.txt": "new\n", "b.txt": null}}
      """
    Then the result is:
      """
      {"status": "opened", "url": "https://github.com/o/r/pull/1", "number": 1, "branch": "b", "commit": "fake-commit-1"}
      """

  Scenario: The would-be pull request is written to memory
    Given a fake publisher
    And the fake publisher has been asked to propose:
      """
      {"base": "main", "body": "Why.", "changes": {"a.txt": "new\n", "b.txt": null}}
      """
    When I read what the fake publisher kept
    Then the result is:
      """
      [{"repo": "o/r", "base": "main", "branch": "b", "title": "T", "body": "Why.", "message": "T\n\nWhy.",
        "parent": "{undefined}", "expect": "{undefined}", "autoMerge": "{undefined}", "changes": {"a.txt": "new\n"}}]
      """

  Scenario: It keeps no token, and needs none
    Given a fake publisher
    And the fake publisher has been asked to propose:
      """
      {"token": "secret"}
      """
    When I read whether what the fake publisher kept holds "secret"
    Then the result is "false"

  Scenario: A message and a parent are kept as given
    Given a fake publisher
    And the fake publisher has been asked to propose:
      """
      {"message": "Mine", "parent": "abc"}
      """
    When I read what the fake publisher kept
    Then the result's "0.message" is "Mine"
    And the result's "0.parent" is "abc"

  Scenario Outline: What the repository already has is nothing to change
    Given a fake publisher with:
      """
      {"files": {"a.txt": "same\n"}}
      """
    When I ask the fake publisher to propose:
      """
      {"changes": <changes>}
      """
    Then the result is '{"status": "nothing to change"}'

    Examples:
      | changes                                |
      | {"a.txt": "same\\n", "gone.txt": null} |
      | {}                                     |

  Scenario: Nothing to change is kept as nothing
    Given a fake publisher with:
      """
      {"files": {"a.txt": "same\n"}}
      """
    And the fake publisher has been asked to propose:
      """
      {"changes": {"a.txt": "same\n", "gone.txt": null}}
      """
    And the fake publisher has been asked to propose:
      """
      {"changes": {}}
      """
    When I read what the fake publisher kept
    Then the result is "[]"

  Scenario: A delete of a file the repository has is a change
    Given a fake publisher with:
      """
      {"files": {"a.txt": "same\n"}}
      """
    And the fake publisher has been asked to propose:
      """
      {"changes": {"a.txt": null}}
      """
    When I read what the fake publisher kept
    Then the result's "0.changes" is '{"a.txt": null}'

  Scenario Outline: It refuses what propose refuses
    Given a fake publisher
    When I ask the fake publisher to propose:
      """
      <fields>
      """
    Then it is refused, saying "<saying>"

    Examples:
      | fields                    | saying                |
      | {"branch": "{undefined}"} | needs a branch        |
      | {"changes": {"a.txt": 1}} | neither text nor null |

  Scenario: It refuses a branch it already proposed
    Given a fake publisher
    And the fake publisher has been asked to propose:
      """
      {}
      """
    When I ask the fake publisher to propose:
      """
      {}
      """
    Then it is refused, saying "Reference already exists"

  Scenario: It answers that auto-merge is on, as propose does
    Given a fake publisher
    When I ask the fake publisher to propose:
      """
      {"expect": {"a.txt": "s"}, "autoMerge": true}
      """
    Then the result's "autoMerge" is "on"

  Scenario: It records expect and autoMerge
    Given a fake publisher
    And the fake publisher has been asked to propose:
      """
      {"expect": {"a.txt": "s"}, "autoMerge": true}
      """
    When I read what the fake publisher kept
    Then the result's "0.expect" is '{"a.txt": "s"}'
    And the result's "0.autoMerge" is "true"

  Scenario: Without autoMerge, its answer says nothing of it
    Given a fake publisher
    When I ask the fake publisher to propose:
      """
      {"branch": "b2"}
      """
    Then the result does not include "autoMerge"

  Scenario: It answers what it was told auto-merge answers
    Given a fake publisher with:
      """
      {"autoMerge": "not allowed"}
      """
    When I ask the fake publisher to propose:
      """
      {"autoMerge": true}
      """
    Then the result's "autoMerge" is "not allowed"

  Scenario: A moved file makes a proposal that expects it stale
    Given a fake publisher with:
      """
      {"moved": ["a.txt"]}
      """
    When I ask the fake publisher to propose:
      """
      {"expect": {"a.txt": "s"}}
      """
    Then the result is '{"status": "stale", "path": "a.txt"}'

  Scenario: A stale proposal is not kept
    Given a fake publisher with:
      """
      {"moved": ["a.txt"]}
      """
    And the fake publisher has been asked to propose:
      """
      {"expect": {"a.txt": "s"}}
      """
    When I read what the fake publisher kept
    Then the result is "[]"

  Scenario: A moved file stops only a proposal that expects it
    Given a fake publisher with:
      """
      {"moved": ["a.txt"]}
      """
    When I ask the fake publisher to propose:
      """
      {}
      """
    Then the result's "status" is "opened"

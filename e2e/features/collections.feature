Feature: Collection sections
  As a signed-in user I want private (encrypted) collections to be hidden
  in a collapsible section so they are not visible by default.

  Background:
    Given I am logged in as "e2e-admin" with password "e2e-secret"

  @private-section
  Scenario: Encrypted collections are hidden behind a collapsible section
    When I create a collection named "E2E Public"
    Then I see the collection card "E2E Public"
    When I create an encrypted collection named "E2E Secret" with passphrase "test123"
    Then I do not see the collection card "E2E Secret"
    And I see the private collections toggle showing 1
    When I expand the private collections section
    Then I see the collection card "E2E Secret"
    When I collapse the private collections section
    Then I do not see the collection card "E2E Secret"

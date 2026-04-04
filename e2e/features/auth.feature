Feature: Authentication and session
  As a user I want to sign in to Nodeo and sign out.

  Scenario: Login page is reachable
    Given I am on the login page
    Then I see the login page

  Scenario: Invalid credentials are rejected
    Given I am on the login page
    When I enter username "admin" and password "wrong-password"
    And I click the sign in button
    Then I see a login error message

  Scenario: Successful sign in and sign out
    Given I am on the login page
    When I enter username "e2e-admin" and password "e2e-secret"
    And I click the sign in button
    Then I see the collections list
    When I click the log out button
    Then I see the login page

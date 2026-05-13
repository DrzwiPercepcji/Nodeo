Feature: Settings page
  As a user I want to manage application settings like yt-dlp cookies.

  Background:
    Given I am logged in as "e2e-admin" with password "e2e-secret"

  Scenario: Navigate to settings page via gear icon
    When I click the settings button
    Then I see the settings page

  Scenario: Cookie field shows "Not configured" initially
    When I click the settings button
    Then I see the settings page
    And the cookie status shows "Not configured"

  Scenario: Upload cookie data and see masked value
    When I click the settings button
    Then I see the settings page
    When I click the upload cookie button
    And I enter cookie data "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tFALSE\t0\tSID\ttest123"
    And I save the cookie settings
    Then the cookie status shows masked value

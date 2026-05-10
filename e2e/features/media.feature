Feature: Collections and media upload
  As a signed-in user I want to create a collection and upload audio or video.

  Background:
    Given I am logged in as "e2e-admin" with password "e2e-secret"

  @audio
  Scenario: Upload a short audio file
    When I create a collection named "E2E Audio"
    Then I see the collection card "E2E Audio"
    When I open the collection "E2E Audio"
    Then the collection page shows title "E2E Audio"
    When I click the upload media button
    And I choose file "sample.mp3" with title "E2E test track"
    And I confirm the upload in the dialog
    Then the media "E2E test track" is ready

  @video
  Scenario: Upload a short video file
    When I create a collection named "E2E Video"
    Then I see the collection card "E2E Video"
    When I open the collection "E2E Video"
    Then the collection page shows title "E2E Video"
    When I click the upload media button
    And I choose file "sample.mp4" with title "E2E test clip"
    And I confirm the upload in the dialog
    Then the media "E2E test clip" is ready

  @delete
  Scenario: Deleting media requires confirmation
    When I create a collection named "E2E Delete"
    Then I see the collection card "E2E Delete"
    When I open the collection "E2E Delete"
    Then the collection page shows title "E2E Delete"
    When I click the upload media button
    And I choose file "sample.mp3" with title "E2E delete me"
    And I confirm the upload in the dialog
    Then the media "E2E delete me" is ready
    When I click the delete button on media "E2E delete me"
    Then I see the delete confirmation dialog
    When I cancel the delete dialog
    Then the media "E2E delete me" is visible
    When I click the delete button on media "E2E delete me"
    Then I see the delete confirmation dialog
    When I confirm the delete dialog
    Then the media "E2E delete me" is gone

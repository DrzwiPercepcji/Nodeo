Feature: Album cover art in playlist
  As a signed-in user I want to see album cover art fetched from external
  services when playing audio with proper artist/album metadata.

  Background:
    Given I am logged in as "e2e-admin" with password "e2e-secret"

  @cover-art
  Scenario: Playlist shows cover art for tagged audio tracks
    When I create a collection named "E2E Cover Art"
    Then I see the collection card "E2E Cover Art"
    When I open the collection "E2E Cover Art"
    Then the collection page shows title "E2E Cover Art"
    When I click the upload media button
    And I choose file "nirvana-teen-spirit.mp3" with title "Smells Like Teen Spirit"
    And I confirm the upload in the dialog
    Then the media "Smells Like Teen Spirit" is ready
    When I click the upload media button
    And I choose file "metallica-nothing-else.mp3" with title "Nothing Else Matters"
    And I confirm the upload in the dialog
    Then the media "Nothing Else Matters" is ready
    When I click the upload media button
    And I choose file "sabbath-heaven-hell.mp3" with title "Heaven and Hell"
    And I confirm the upload in the dialog
    Then the media "Heaven and Hell" is ready
    Given cover art requests are mocked
    When I open the audio playlist
    Then the now-playing artwork shows a cover image
    And each queue item shows a cover thumbnail

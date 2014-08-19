$(function() {
    window.MESSAGES = {
        "CONNECTION_LOST_HOST": $("<span/>").text("Attempting to re-establish a lobby..."),
        "CONNECTION_LOST":      $("<span/>").text("Connection to lobby lost."),
        "CONNECTION_LOST_AUTH": $("<span/>").text("Connection to authorization server lost: ")
    }
});

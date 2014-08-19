$(function() {
    window.MESSAGES = {
        "CONNECTION_LOST_HOST": $("<span/>").text("Attempting to re-establish a lobby..."),
        "CONNECTION_LOST_PEER": $("<span/>").addClass("error").text("Lobby lost."),
        "CONNECTION_LOST":      $("<span/>").addClass("error").text("Connection to lobby lost."),
        "CONNECTION_LOST_AUTH": $("<span/>").addClass("error").text("Connection to authorization server lost: ")
    }
});

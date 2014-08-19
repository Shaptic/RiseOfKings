$(document).ready(function() {
  var all = [
    $('#unit-knight'),
    $('#unit-spear'),
    $('#unit-archer')
  ];

  var unitCountValidator = function() {
    var sum = all.reduce(function(prev, curr, i, arr) {
      return prev + parseInt(curr.val());
    }, 0);

    if (parseInt($('#unit-max').val()) < sum) {
      $('#unit-max').val(sum).attr('min', sum);
    }
  };

  for (var i in all) {
    all[i].on('change', unitCountValidator);
  }
});

function hostGame(evt) {
  var name = "";
  var msg  = "";

  // Handle errors:

  // No server name.
  if ($("#name").val() === "") {
    name = "name";
    msg  = "server needs a name.";

  // No units allowed.
  } else if (parseInt($("#unit-max").val()) <= 0) {
    name = "unit-max";
    msg  = "match must have units";
  }

  if (name !== "") {
    $("#" + name).parents(".form-group").addClass("has-error");
    $("#status").text("Invalid server settings: " + msg).css("color", "red");
    evt.preventDefault();
    return;
  }

  $("#status").text("Creating socket...");

  var mm = new net.MatchMaker();

  var playerObject = {
    "name":     $("#name").val(),
    "nick":     $("#nick").val(),
    "pcount":   $("#pcount").val(),
    "id":       mm.peerID,
    "maxunit":  $("#unit-max").val(),
    "knights":  $("#unit-knight").val(),
    "spears":   $("#unit-spear").val(),
    "archers":  $("#unit-archer").val()
  }

  mm.sessionData.host = true;
  mm.sessionData.matchData = playerObject;
  mm.createSocket(function() {
    navigate("active-lobby");
    playerObject.id = mm.peerID;
    mm.createLobby(playerObject, $("#status"), $("#network-status"));
    $("#lobby-name").text(playerObject.name);
  });

  $("#player-list").empty()
                   .append("<h4>Player List</h4>")
                   .append(mm.insertPlayer({
      "nick": playerObject.nick,
      "color": "blue",
      "units": {
        "knights": playerObject.knights,
        "spears" : playerObject.spears,
        "archers": playerObject.archers,
      }
    })
  );

  evt.preventDefault();
}

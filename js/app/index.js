function navigate(where) {
  $("#browser").hide();
  $("#host").hide();
  $("#active-lobby").hide();
  $("#join-prompt");
  $("#game").hide();

  $("#" + where).show();
  $(".nav li").removeClass();
  $("a[href='#" + where + "']").parent().addClass("active");
}

function refreshBrowser() {
  net.helpers.ajax("GET", net.config.AUTH_URL + "/match/", {
    onReady: function(resp) {

      console.log(resp);

      var elem = document.getElementById("lobby")
                         .getElementsByTagName("tbody")[0];

      elem.innerHTML = elem.rows[0].innerHTML;

      var json = JSON.parse(resp);
      for (var i in json["matches"]) {
        var peer = json["matches"][i];

        var dom = $("<tr/>").on("click", function(evt) {
          if ($(this).hasClass("active-match")) {
            $("#lobby tr").removeClass("active-match");
            $("#join-btn").attr("disabled", true);
            $("#join-btn").off("click");

          } else {
            var row = $(this);

            $("#lobby tr").removeClass("active-match");
            row.addClass("active-match");
            $("#join-btn").attr("disabled", false);
            $("#join-btn").on("click", function(evt) {
              $("#join-prompt").show();
            });
          }
        }).html(
          "<td>" + peer.name + "</td>" +
          "<td class='host-id'>" + peer.host.id + "</td>" +
          "<td>" + peer.players.length + "/" + peer.playerCount + "</td>" +
          "<td>" + peer.maxUnits + "</td>"
        );
        $(elem).append(dom);
      }
    }
  });
}

function joinGame(evt) {
  var mm = new net.MatchMaker();
  mm.createSocket(function() {
    var pObj = {
      "id":      mm.peerID,
      "nick":    $("#loadout-nick").val(),
      "knights": $("#loadout-unit-knight").val(),
      "spears":  $("#loadout-unit-spear").val(),
      "archers": $("#loadout-unit-archer").val()
    };

    mm.joinLobby(pObj, $("#lobby .active-match .host-id").text(),
                 $("#network-status"));

    $("#join-prompt").hide();
  });

  evt.preventDefault();
}

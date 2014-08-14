function navigate(where) {
  $("#browser").hide();
  $("#host").hide();
  $("#active-lobby").hide();

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

          } else {
            $("#lobby tr").removeClass("active-match");
            $(this).addClass("active-match");
          }
        }).html(
          "<td>" + peer.name + "</td>" +
          "<td>" + peer.host.id + "</td>" +
          "<td>" + peer.players.length + "/" + peer.playerCount + "</td>" +
          "<td>" + peer.maxUnits + "</td>"
        );
        $(elem).append(dom);
      }
    }
  });
}

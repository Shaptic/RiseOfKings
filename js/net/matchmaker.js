var net     = net || {};
net.helpers = net.helpers || {};
net.config  = net.config  || {};

net.MatchMakerState = {
    NEW:        1,
    WAITING:    2,
    CONNECTING: 3,
    CONNECTED:  4
};

/*
 * Presents a simple interface for performing AJAX calls to the auth server.
 *  The `onReady` callback should accept a single parameter, namely the response
 *  object. On the other hand, the `onFail` callback should take 2 parameters;
 *  the first is the response object, and the second is the HTTP status code.
 *
 * @param   method  POST, GET, etc.
 * @param   URL     The URL to send the request to
 * @param   options An object containing a variety of possible options:
 *                  onReady -- Callback executed when a 200 reply is given
 *                  onFail  -- Callback executed when a non-200 reply is given
 *                  data    -- Data to send to the server on a POST request
 */
net.helpers.ajax = function(method, URL, options) {
    var onReady = options.onReady || function() {};
    var onFail  = options.onFail  || function() {};

    var http = new XMLHttpRequest();

    http.onreadystatechange = function() {
        if (http.readyState === 4) {
            if (http.status === 200) {
                onReady(http.responseText);
            } else {
                onFail(http.responseText, http.status);
            }
        }
    };

    http.open(method, URL, true);

    if (method === "POST") {
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    }

    if (zogl.debug) {
        console.log(method, "sending", options.data, "to", URL);
    }

    http.send(options.data);
}

/*
 * Sets up the initial connection to the auth server.
 *  This object is responsible for initial handshaking with the auth server,
 *  and presenting itself as a "lobby" for other peers to join.
 *
 *  Once peers join the game and the game begins, this object is no longer
 *  necessary (as of the current design). In the future, it may be maintained in
 *  order to preserve state and allow mid-game joins to occur.
 *
 *  The auth server expects pings to occur between the peer and the server. If
 *  a certain threshold is exceeded without a ping (several seconds or more),
 *  the peer is considered to be "lost," and must re-register. Hence, the .tick()
 *  method is called every 200ms to maintain an active connection.
 */
net.MatchMaker = function() {
    this.state  = net.MatchMakerState.NEW;
    this.sessionData = {
        initialArmy: {}
    };
    this.peerID = '';
};

net.GameConnection = function() {
};

net.MatchMaker.prototype.createSocket = function(callback) {
    var scope = this;

    callback = callback || function() {};

    this.socket = new Peer({
        key:    net.config.PEER_API_KEY,
        debug:  zogl.debug ? 4 : 0
    });

    this.socket.on("open", function(id) {
        if (id === null) {
            throw("Socket error.");
            return;
        }

        scope.onSocketOpen(id);
        callback();
    });
};


net.MatchMaker.prototype.tick = function(elapsed) {

};

net.GameConnection.prototype.connect = function(addr) {
    if (this.socket === undefined) {
        this.createSocket(this.connect.bind(this));
    } else {
        this.socket.on("connection", function(conn) {
            scope.onSocketConnection(conn);
        });
    }
};

net.MatchMaker.prototype.onSocketOpen = function(id) {
    var scope = this;

    this.peerID = id;
    this.state  = net.MatchMakerState.CONNECTING;/*

    net.helpers.ajax("POST", net.config.AUTH_URL + "/register/", {
        onReady: function(resp) {
            var json = JSON.parse(resp);

            scope.sessionData.color = json["color"];
            scope.sessionData.initialArmy.color = json["color"];
            scope.setInitialArmyPosition(resp);
            scope.tickHandle = setInterval(scope.tick.bind(scope), 200);

            console.log("Established initial connection as", json["color"]);
        },
        data: "id=" + id
    });*/
};

net.MatchMaker.prototype.setInitialArmyPosition = function(data) {

};

/*
 *
 */
net.MatchMaker.prototype.onSocketConnection = function(connection) {

};

/*
 * Updates the lobby.
 *  When a player is in a lobby, updates need to occur in order to update current
 *  match state, including things such as:
 *
 *      - existing players
 *      - chat messages
 *      - lobby rules       [peers only]
 *      - joining players   [hosts only]
 *
 *  In order to minimize server work, we do this updating by performing a GET
 *  request on the /match/ URL, just like the server browser function
 *  `refreshLobby()`. This gives all of the data we need.
 *
 *  After that, we determine which lobby is the one we're in, and use that data
 *  to display updated information.
 */
net.MatchMaker.prototype.lobbyTick = function() {
    var scope = this;

    net.helpers.ajax("GET", net.config.AUTH_URL + "/match/", {
        onReady: function(resp) {
            var json = JSON.parse(resp);
            var lobby = null;

            // find our lobby.
            for (var i in json.matches) {
                var match = json.matches[i];
                for (var j in match.players) {
                    if (match.players[j].id === scope.peerID) {
                        lobby = match;
                        break;
                    }
                }
            }

            if (!lobby) {
                throw("oh no :(");
            }

            var pl = $("#player-list");
            for (var i in match.players) {

                var a = $("<div/>").addClass("row player")
                                   .css("text-align", "left");
                var b = $("<div/>").addClass("col-sm-6").html(
                    match.players[i].nick +
                    '<span class="color" style="background-color: "' +
                    match.players[i].color + '"></span>'
                );
                var c = $("<div/>").addClass("col-sm-2").text(
                    match.players[i].units.knights + " knights"
                );
                var d = $("<div/>").addClass("col-sm-2").text(
                    match.players[i].units.spears + " spears"
                );
                var e = $("<div/>").addClass("col-sm-2").text(
                    match.players[i].units.archers + " archers"
                );

                a.append(b);
                a.append(c);
                a.append(d);
                a.append(e);

                pl.append(a);
            }
        }
    });
};



var net     = net || {};
net.helpers = net.helpers || {};
net.config  = net.config  || {};

net.MatchMakerState = {
    NEW:        1,
    WAITING:    2,
    CONNECTING: 3,
    CONNECTED:  4,
    LOST_LOBBY: 5
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

    if (method === "GET" && options.data) {
        URL += '?' + (options.data || '');
    }

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
        initialArmy: {},
        host: false,
        matchData: {}       // for hosting a lobby to re-establish a connection
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

        // Register ourselves with the chat input field, allowing for
        // sending messages and whatnot.
        $("#chat-input").on("keyup", function(evt) {
            if (evt.which === 13) {
                net.helpers.ajax("POST", net.config.AUTH_URL + "/command/", {
                    data: jQuery.param({
                        "from": scope.peerID,
                        "type": "CHAT",
                        "data": $("#chat-input").val()
                    })
                });
                $(this).val('');
            }
        });

        $("#leave-btn").on("click", function(evt) {
            net.helpers.ajax("POST", net.config.AUTH_URL + "/quit/", {
                data: "id=" + scope.peerID
            });
            navigate("lobby-browser");
        });
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
net.MatchMaker.prototype.lobbyTick = function(statusNode) {
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
                statusNode.append(
                    $("<span/>").css("color", "red").css("display", "block")
                                .text("Lost connection to server.")
                );

                // Let's try re-establishing a connection to the auth. server
                // and creating a lobby again, if we are the host.
                if (scope.sessionData.host) {
                    statusNode.append(
                        $("<span/>").css("display", "block").text(
                            "Attempting to re-establish a connection..."
                        )
                    );
                    scope.createLobby(scope.sessionData.matchData,
                                      $("#status"), statusNode);
                }

                scope.state = net.MatchMakerState.LOST_LOBBY;
                return;
            }

            var before = $("#player-list").length;

            var pl = $("#player-list").empty().append("<h4>Player List</h4>");
            for (var i in match.players) {
                pl.append(scope.insertPlayer(match.players[i]));
            }

            if ($("#player-list").length > before) {
                $("#network-status").append("Player joined.");
            } else if ($("#player-list").length < before) {
                $("#network-status").append("Player left.");
            }

            $("#lobby-name").text(lobby.name);
            var rl = $("#match-rules").empty().append("<h4>Rules</h4>");
            var row = $("<div/>").addClass("row");
            var col1= $("<div/>").addClass("col-sm-3").html("<b>Players</b>");
            var col2= $("<div/>").addClass("col-sm-3").text(lobby.playerCount);

            rl.append(row.append(col1, col2));
        }
    });
};

net.MatchMaker.prototype.createLobby = function(playerObject, statusNode,
                                                networkStatusNode) {
    var scope = this;
    this.state= net.MatchMakerState.CONNECTING;

    net.helpers.ajax("POST", net.config.AUTH_URL + "/match/", {
        onReady: function(resp) {
            var json = JSON.parse(resp);
            statusNode.text(statusNode.text() + resp["status"]);

            scope.state = net.MatchMakerState.CONNECTED;
            scope._setupTick(networkStatusNode);
        },
        data: jQuery.param(playerObject)
    });
};

net.MatchMaker.prototype.joinLobby = function(playerObject, hostObject,
                                              networkStatusNode) {
    var scope = this;
    this.state= net.MatchMakerState.CONNECTING;

    net.helpers.ajax("POST", net.config.AUTH_URL + "/join/", {
        onReady: function(resp) {
            navigate("active-lobby");
            scope.state = net.MatchMakerState.CONNECTED;
            scope._setupTick(networkStatusNode);
        },
        data: jQuery.param({
            "from": playerObject,
            "to": hostObject
        })
    });
};

net.MatchMaker.prototype.insertPlayer = function(obj) {
    var a = $("<div/>").addClass("row player")
                       .css("text-align", "left");
    var b = $("<div/>").addClass("col-sm-6").html(
        obj.nick + '<span class="color" style="background-color: ' +
        obj.color + '"></span>'
    );
    var c = $("<div/>").addClass("col-sm-2").text(
        obj.units.knights + " knights"
    );
    var d = $("<div/>").addClass("col-sm-2").text(
        obj.units.spears + " spears"
    );
    var e = $("<div/>").addClass("col-sm-2").text(
        obj.units.archers + " archers"
    );
    var f = $("<div/>").attr("id", obj.id).css("display", "none");

    return a.append(b, c, d, e, f);
};

net.MatchMaker.prototype._setupTick = function(statusNode) {
    var scope = this;

    var handle = setInterval(function() {
        net.helpers.ajax("POST", net.config.AUTH_URL + "/ping/", {
            data: "id=" + scope.peerID,
            onFail: function(resp, status) {
                statusNode.append(
                    $("<span/>").css("color", "red").css("display", "block")
                                .text("Connection to authorization server lost: " + resp)
                );
                clearInterval(handle);
            }
        });

        net.helpers.ajax("GET", net.config.AUTH_URL + "/command/", {
            onReady: function(resp) {
                var cmds = JSON.parse(resp).commands;
                for (var i in cmds) {
                    var cmd = cmds[i];
                    if (cmd.type === "CHAT") {
                        var row = $("<div/>").addClass("row")
                                             .css("text-align", "left");
                        var nickText = $("<span/>").css("color", cmd.from.color)
                                                   .text(cmd.from.nick);
                        var nick = $("<div/>").addClass("col-sm-3 chat-nick")
                                              .append(nickText);
                        var msg  = $("<div/>").addClass("col-sm-9 chat-text")
                                              .append($("<span/>").text(cmd.data));
                        row.append(nick, msg);

                        row.insertBefore($("#chat-inset").find('input'));
                    }
                }
            },
            data: jQuery.param({
                "from": scope.peerID
            })
        });

        scope.lobbyTick(statusNode);
        if (scope.state == net.MatchMakerState.LOST_LOBBY) {
            clearInterval(handle);
        }
    }, 1000);
};

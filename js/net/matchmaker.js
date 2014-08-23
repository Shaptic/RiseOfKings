net.MatchMakerState = {
    NEW:        1,
    WAITING:    2,
    CONNECTING: 3,
    CONNECTED:  4,
    LOST_LOBBY: 5
};

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
        attempts: 0,        // Attempts made to re-establish a lobby [host]
        matchData: {},      // All match info for re-establishing a lobby [host]
        playerObject: {}    // Player data like units, name, etc.
    };
    this.networkState = {
        'match': 0,
        'ping': 0,
        'command': 0
    };
    this.peerID = '';
};

/*
 * Establishes a connection to the PeerJS server and sets things up.
 *  Upon connecting to the server, this will do various tasks that require the
 *  PeerJS ID, such as set up chat, and the "Leave Lobby" button.
 *  It will also execute an optional callback (no parameters) after the initial
 *  setup (see `onSocketOpen()`).
 *
 * @param   callback    Function to be executed after a PeerJS ID is assigned
 */
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
            if (evt.which === 13 && $.trim($(this).val())) {
                net.helpers.ajax("POST", net.config.AUTH_URL + "/command/", {
                    data: jQuery.param({
                        "from": scope.peerID,
                        "type": "CHAT",
                        "data": $("#chat-input").val()
                    })
                });

                scope.addChatMessage(
                    scope.sessionData.playerObject,
                    $(this).val()
                ).appendTo($("#chat-content"));

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

/*
 * Establishes internal state to indicate that the peer is connecting.
 */
net.MatchMaker.prototype.onSocketOpen = function(id) {
    var scope = this;

    this.peerID = id;
    this.state  = net.MatchMakerState.CONNECTING;
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

    if (this.state == net.MatchMakerState.LOST_LOBBY) {
        return;
    }

    // If there have been >2 unanswered AJAX calls, let's not send any more
    // until we have a response.
    // The state is reset in `onReady()` in the call.
    if (this.networkState.match++ > 2) {
        return;
    }

    if (this.networkState.match > 1) {
        statusNode.append($("<span/>").text(
            this.networkState.match.toString() + " unanswered match requests.")
        );
    }

    net.helpers.ajax("GET", net.config.AUTH_URL + "/match/", {
        onReady: function(resp) {
            scope.networkState.match = 0;

            var json = JSON.parse(resp);
            var lobby = null;

            // find our lobby.
            for (var i in json.matches) {
                var match = json.matches[i];
                for (var j in match.players) {
                    if (match.players[j].id === scope.peerID) {
                        lobby = match;
                        scope.sessionData.playerObject = match.players[j];
                        break;
                    }
                }
            }

            if (!lobby) {
                statusNode.append(MESSAGES.CONNECTION_LOST_PEER);

                // Let's try re-establishing a connection to the auth. server
                // and creating a lobby again, if we are the host.
                if (scope.sessionData.host && scope.sessionData.attempts++ < 1) {
                    statusNode.append(MESSAGES.CONNECTION_LOST_HOST);
                    scope.createLobby(scope.sessionData.matchData,
                                      $("#status"), statusNode);
                } else {
                    statusNode.append(MESSAGES.CONNECTION_LOST);
                }

                scope.state = net.MatchMakerState.LOST_LOBBY;
                return;
            }

            scope.updateLobby(lobby, statusNode);
        }
    });
};

net.MatchMaker.prototype.createLobby = function(playerObject, statusNode, networkStatusNode, postOpHandler) {
    var scope = this;
    this.state= net.MatchMakerState.CONNECTING;
    this.sessionData.playerObject = playerObject;

    postOpHandler = postOpHandler || function() {};

    net.helpers.ajax("POST", net.config.AUTH_URL + "/match/", {
        onReady: function(resp) {
            var json = JSON.parse(resp);
            statusNode.text(statusNode.text() + resp["status"]);

            scope.state = net.MatchMakerState.CONNECTED;
            scope._setupTick(networkStatusNode);
            postOpHandler();
        },
        data: jQuery.param(playerObject)
    });
};

net.MatchMaker.prototype.joinLobby = function(playerObject, hostObject, networkStatusNode) {
    var scope = this;
    this.state= net.MatchMakerState.CONNECTING;
    this.sessionData.playerObject = playerObject;

    net.helpers.ajax("POST", net.config.AUTH_URL + "/join/", {
        onReady: function(resp) {
            navigate("active-lobby");
            scope.state = net.MatchMakerState.CONNECTED;
            scope._setupTick(networkStatusNode);
            scope.updateLobby(JSON.parse(resp).data, networkStatusNode);
        },
        data: jQuery.param({
            "from": playerObject.id,
            "knights": playerObject.knights || 0,
            "spears":  playerObject.spears  || 0,
            "archers": playerObject.archers || 0,
            "to": hostObject
        })
    });
};

net.MatchMaker.prototype.updateLobby = function(matchData, statusNode) {
    var before = parseInt($("#player-list").children().length);

    var pl = $("#player-list").empty().append("<h4>Player List</h4>");
    for (var i in matchData.players) {
        pl.append(this.insertPlayer(matchData.players[i]));
    }

    var after = pl.children().length;

    if (after > before) {
        statusNode.append("<span>Player joined.</span>");
    } else if (after < before) {
        statusNode.append("<span>Player left.</span>");
    }

    $("#lobby-name").text(matchData.name);
    var rl = $("#match-rules").empty().append("<h4>Rules</h4>");
    var row = $("<div/>").addClass("row");
    var col1= $("<div/>").addClass("col-sm-5").html("<b>Players</b>");
    var col2= $("<div/>").addClass("col-sm-7").text(matchData.playerCount);

    row.append(col1, col2);

    var row2 = $("<div/>").addClass("row");
    var col1= $("<div/>").addClass("col-sm-5").html("<b>Max Units</b>");
    var col2= $("<div/>").addClass("col-sm-7").text(matchData.maxUnits);

    rl.append(row, row2.append(col1, col2));
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

net.MatchMaker.prototype.addChatMessage = function(from, msg) {
    var row = $("<div/>").addClass("row").css("text-align", "left");
    var nickText = $("<span/>").css("color", from.color).text(from.nick);
    var nick = $("<div/>").addClass("col-sm-3 chat-nick").append(nickText);
    var chat = $("<div/>").addClass("col-sm-9 chat-text")
                          .append($("<span/>").text(msg));

    var row = row.append(nick, chat);

    var elem = $("#chat-content");
    if (!elem.data("scrolling") ||
         elem.scrollTop === elem.height()) {

        elem.animate({
            scrollTop: elem.height()
        }).data("scrolling", false);
    }

    return row;
};

net.MatchMaker.prototype._setupTick = function(statusNode) {
    var scope = this;

    var handle = setInterval(function() {
        if (scope.networkState.ping++ <= 2) {

            net.helpers.ajax("POST", net.config.AUTH_URL + "/ping/", {
                onReady: function() {
                    scope.networkState.ping = 0;
                },
                onFail: function(resp, status) {
                    scope.networkState.ping = 0;
                    var node = MESSAGES.CONNECTION_LOST_AUTH;
                    node.text(node.text() + resp);
                    statusNode.append(node);
                    scope.state = net.MatchMakerState.LOST_LOBBY;
                    clearInterval(handle);
                },
                data: jQuery.param({
                    "id": scope.peerID
                })
            });
        }

        if (scope.networkState.command++ <= 2) {
            net.helpers.ajax("GET", net.config.AUTH_URL + "/command/", {
                onReady: function(resp) {
                    scope.networkState.command = 0;

                    var cmds = JSON.parse(resp).commands;
                    for (var i in cmds) {
                        var cmd = cmds[i];

                        // Skip chat messages that match our ID because we already
                        // posted that message when ENTER was pressed.
                        if (cmd.type === "CHAT" && cmd.from.id !== scope.peerID) {
                            scope.addChatMessage(cmd.from, cmd.data)
                                 .appendTo($("#chat-content"));
                        }
                    }
                },
                onFail: function() {
                    scope.networkState.command = 0;
                },
                data: jQuery.param({
                    "from": scope.peerID
                })
            });
        }

        scope.lobbyTick(statusNode);
        if (scope.state == net.MatchMakerState.LOST_LOBBY) {
            clearInterval(handle);
        }
    }, 1000);
};

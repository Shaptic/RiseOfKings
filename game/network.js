var RTS_CONFIG = {
    "PEER_API_KEY": "liwkv44lmew89f6r",
    "AUTH_SERVER": "http://localhost:5000",
    "NETWORK_TICKRATE": 200
};

function AJAX(requestType, requestURL, callback) {
    callback = callback || function() {};

    var ajax = new XMLHttpRequest();
    ajax.onreadystatechange = function() {
        callback(ajax);
    };
    ajax.open(requestType, requestURL, true);
    ajax.send();
}

/*
 * Creates a p2p socket connection.
 *
 * @param   army    Initial army of the player associated with this connection
 */
function rConnection(army) {
    var that = this;

    this.color = null; // Our player color, TBD when registered.

    this.socket = new Peer({
        key: RTS_CONFIG.PEER_API_KEY,
        debug: zogl.debug ? 4 : 0
    });

    this.socket.on("open", function(id) {
        that.peerid = id;
        that.attribs.open = true;
        AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/register/" + id, function(ajax) {
            if (ajax.readyState == 4 && ajax.status == 200) {
                var obj = JSON.parse(ajax.responseText);

                that.color = obj["color"];
                army.color = that.color;
                for (var i in army.units) {
                    army.units[i].position = {
                        'x': Math.floor(Math.random() * (WINDOW_SIZE.w - 100)),
                        'y': Math.floor(Math.random() * (WINDOW_SIZE.h - 100)),
                    };
                }

                that.recvQueue.addPlayer(that.color);
                that.turnArchive.addPlayer(that.color);
                that.armyComposition[that.color] = army.units;

                console.log("We are", that.color);
            }
        });
    });

    this.attribs = {
        "host": false,
        "open": false,
        "connected": false,
        "singleplayer": false
    };

    // Contains the army composition for every connected player.
    // This is used to start the initial game state.
    this.armyComposition = {};
    this.initialArmyComp = army.units || [];

    // List of messages for client to execute
    // For the host, this contains turn data for all players.
    this.recvQueue  = new rCommandQueue();
    this.turnArchive= new rCommandQueue();

    this.peers      = [];   // A list of all clients in this game
    this.authQueue  = [];   // List of messages from the authorization server
    this.sendTick   = 1;    // The current network tick. It represents the exact
                            // tick that we are currently issuing commands for
                            // (player input).
    this.skippedTurn= 0;    // Latency control indicating how many iterations
                            // have been skipped for this turn.

    this.onTick     = function() {};

    this.sendDelay  = 2;    // Delay (in ticks) to set commands to.

    this.peerid     = null; // Internal peer.js identifier.
    this.host       = null; // A connection object to the host.

    // The initial delay between every tick, dynamically calculated based on
    // network latency throughout the match.
    this.iterDelay  = RTS_CONFIG.NETWORK_TICKRATE;

    // A handle on the current tick loop, which is adjusted post-connection
    // to match a consistent network tick-rate.
    this.intervalHandle = setInterval(function() {
        that.update();
    }, 1000);

    // When a connection is opened to the socket (e.g. we are hosting),
    // execute the callback.
    this.socket.on("connection", function(c) {
        that._onConnection(c);
    });
}

rConnection.prototype.update = function() {
    var that = this;

    // Connected means we are currently in-game, so we should process
    // network messages accordingly.
    if (this.attribs.connected) {

        /*
         * When hosting, we need to wait for all peers to have sent in their
         * commands before broadcasting the turn data to everyone.
         */
        if (this.attribs.host) {

            // First, let's handle the "sending" of our own data.
            var done = {
                "color": this.color,
                "turn": this.sendTick,
                "type": MessageType.DONE
            }

            var latency = {
                "color": this.color,
                "turn": this.sendTick,
                "type": MessageType.PING,
                "ping": this.iterDelay
            }

            this.sendMessage(latency);
            this.sendMessage(done);

            /*
             * Handle misc. messages from clients. Army composition
             * broadcasts fall into this category. If we have such a
             * broadcast pending, build our own composition and tell
             * everyone else about it.
             */
            for (var i in this.recvQueue.queue["misc"]) {
                var msg = this.recvQueue.queue["misc"][i];

                if (msg.type === MessageType.ARMY_COMPOSITION) {
                    this.armyComposition[msg.color] = msg.misc || [];
                    this.sendMessage({
                        "type": MessageType.ARMY_COMPOSITION,
                        "color": this.color,
                        "turn": this.sendTick,
                        "misc": this.armyComposition
                    });
                }
            }

            this.recvQueue.queue["misc"] = [];
            this._calculateLatency();

        } else {

            // Process misc. messages, if any.
            for (var i in this.recvQueue.queue["misc"]) {
                var msg = this.recvQueue.queue["misc"][i];

                if (this.host.color !== undefined &&
                    this.host.color !== msg.color) {
                    throw('bad color');
                }

                // We only get synchronization info from the host,
                // so make sure we can identify the host as such.
                this.host.color = msg.color;

                if (msg.type === MessageType.ARMY_COMPOSITION) {
                    console.log('client grok army comp', msg.misc);

                    this.armyComposition = msg.misc;
                    this.recvQueue.queue["misc"].splice(i, 1);

                // Calculate new turn latency.
                } else if (msg.type === MessageType.PING) {
                    this.iterDelay = msg.ping;
                }
            }

            clearInterval(this.intervalHandle);
            this.intervalHandle = setInterval(function() {
                that.update();
            }, this.iterDelay);

            this.recvQueue.queue["misc"] = [];

            // We're done with this turn.
            this.sendMessage({
                "color": this.color,
                "type": MessageType.DONE,
                "turn": this.sendTick,
                "ping": this.roundtrip
            });
        }

        // Check if the turn is done. If it isn't, mark it as such. Once a
        // certain number of these marks happens for a turn, we need to DC from
        // the client who is holding us up.
        var waiter = this.turnReady(this.sendTick);
        if (waiter !== undefined && waiter !== true) {
            console.log("Turn isn't ready; waiting on", waiter,
                        " --- ", this.skippedTurn, "/", parseInt(
                            10000 / this.iterDelay
                        ));
            this.skippedTurn++;

            if (this.skippedTurn >= 10000 / this.iterDelay) {
                console.log("We should DC.");
            }
        }

    /*
     * Open means we are connected to the master server and awaiting
     * either for someone to join us or for the user to choose another socket
     * to join.
     *
     * When this is true, we need to continue pinging the server to let him
     * know we're alive.
     */
    } else if (this.attribs.open) {
        this.ping();
    }
};

rConnection.prototype.onRecv = function(data) {
    if (zogl.debug) {
        console.log('[' + this.peerid + "] RECV: '", data, "'");
    }

    // We've received a message, so let's add it to the internal queue.
    this.recvQueue.pushMessage(data);
    this.turnArchive.pushMessage(data);

    // If we're the host, it's our responsibility to broadcast the message
    // to the other clients. Unless it is a synchronization packet, because
    // those require extra processing.
    if (this.attribs.host && data.type !== MessageType.ARMY_COMPOSITION) {
        if (data.color !== this.color) {
            this.sendMessage(data);
        } else {
            this.recvQueue.pushMessage(data);
            this.turnArchive.pushMessage(data);
        }
    }

    // Peers do round-trip time calculation when they receive echoes for
    // messages from the host
    if (data.color === this.color && this.sendTick === data.turn) {
        var now = window.performance.now();
        this.roundtrip = now - data.timestamp;
    }

    // Determine whether or not we can now increase the current network turn.
    if (data.turn === this.sendTick && data.type === MessageType.DONE &&
        this.turnReady(this.sendTick) === true) {

        this.skippedTurn = 0;
        this.onTick(this.sendTick++);

        console.log("Next turn:", this.sendTick, this.iterDelay);
    }
};

rConnection.prototype.sendMessage = function(obj, peer) {
    var msg = validateMessage(obj);
    if (msg !== false) {

        // Only attach timestamp when the message being sent is our own.
        if (obj.color === this.color) {
            obj.timestamp = window.performance.now();
            obj.ping = this.roundtrip;
        }

        if (zogl.debug) {
            console.log('[' + this.peerid + "] SEND: '", obj, "'");
        }

        // If we are the host and are sending a message about ourselves,
        // we don't actually send it. Rather, we store it internally
        // immediately.
        if (this.attribs.host && obj.color === this.color) {
            this.onRecv(obj);
        }

        // If peer arg isn't provided, send to all.
        if (!peer) {
            for (var i in this.peers) {
                this.peers[i].send(obj);
            }
        } else {
            peer.send(obj);
        }

    } else {
        throw('bad msg');
    }
};

rConnection.prototype._calculateLatency = function() {
    var that = this;
    var latency = 0;
    var msgs = this.recvQueue.queue[this.sendTick - 1] || {};
    for (var color in msgs) {

        // We don't want to include our own pings because they will reflect
        // the last turn, hence never adjusting.
        if (color === this.color) continue;

        for (var i in msgs[color]) {
            latency = Math.max(latency, msgs[color][i].ping);
        }
    }

    if (latency > 500) {
        this.lagProblem = this.lagProblem + 1 || 1;
    }

    // Cap in the range [100, 500]ms. If this is the case, we have a srs problem.
    this.roundtrip = Math.max(50, Math.min(latency, 450));
    this.iterDelay = this.roundtrip + 50;

    clearInterval(this.intervalHandle);
    this.intervalHandle = setInterval(function() {
        that.update();
    }, this.iterDelay);
};

rConnection.prototype._setupPeer = function(conn) {
    var that = this;

    this.peers.push(conn);

    this.attribs.open = false;
    this.attribs.connected = true;
    this._calculateLatency();

    conn.on("data", function(d) {
        that.onRecv(d);
    });
};

rConnection.prototype.addOrders = function(orders) {
    if (orders instanceof Array) {
        for (var i in orders) {
            this.addOrders(orders[i]);
        }

        return;
    }

    orders.turn += this.sendDelay;

    if (this.attribs.host) {
        this.sendMessage(orders);
    } else {
        this.sendMessage(orders, this.host);
    }
};

rConnection.prototype.getMessages = function(tick, color) {
    if (!(tick in this.recvQueue.queue)) {
        return [];
    }

    if (color === null || color === undefined) {
        return this.recvQueue.queue[tick];
    }

    return this.recvQueue.queue[tick][color] || [];
};

rConnection.prototype.turnReady = function(tick) {
    var done = false;

    var msgs = this.getMessages(tick);
    var count = 0;
    for (var color in msgs) {
        done = false;

        if (msgs[color].length) count++;
        for (var i in msgs[color]) {
            var msg = msgs[color][i];

            if (msg.type === MessageType.DONE) {
                done = true;
                break;
            }
        }

        if (!done) break;
    }

    var ready = (done && count === this.peers.length + 1);
    return ready ? ready : color;
};

/*
 * Functions for communicating with auth server.
 */

rConnection.prototype._onConnection = function(conn) {
    var that = this;

    // We immediately establish a connection, but first we check the command
    // queue on the server to see if this is a valid requested connection.
    conn.on("open", function() {

        // After commands are retrieved, process them.
        that.getCommands(function() {

            for (var i = that.authQueue.length - 1; i >= 0; --i) {
                var cmd = that.authQueue[i];

                // Someone officially really does want to connect to us, so
                // we can check for an ID match and accept the connection.
                if (cmd.type === "connect" && !that.attribs.connected) {
                    console.log('expecting a connection from', cmd.from);
                    AJAX("DELETE", RTS_CONFIG.AUTH_SERVER + "/commands/" +
                                   that.peerid);
                    that.authQueue.splice(i, 1);

                    if (conn.peer !== cmd.from) {
                        conn.close();

                        if (zogl.debug) {
                            throw("Expected '" + that.attribs.expecting +
                                  "' got '" + conn.peer + "'.");
                        }

                        return;
                    }

                    that._setupPeer(conn);

                    // Host specific settings.
                    that.attribs.host = true;
                    that.recvQueue.addPlayer(conn.metadata.color);
                    that.turnArchive.addPlayer(conn.metadata.color);
                }
            }
        });
    });
};

rConnection.prototype.ping = function() {
    AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/ping/" + this.peerid);
};

rConnection.prototype.getCommands = function(onready) {
    var that = this;
    AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/commands/" + this.peerid, function(ajax) {
        if (ajax.readyState == 4 && ajax.status == 200) {
            var obj = JSON.parse(ajax.responseText);

            that.authQueue = that.authQueue.concat(obj.commands);
            onready();
        }
    });
};

rConnection.prototype.connectTo = function(id, color) {
    var that = this;
    if (this.attribs.open) {
        AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/connect/" +
                    this.peerid + '/' + id, function(ajax) {
            if (ajax.readyState == 4 && ajax.status == 200) {
                that.attribs.host = false;

                // Connect to the peer host after waiting a second.
                setTimeout(function() {
                    var conn = that.socket.connect(id, {
                        "metadata": {
                            "color": color
                        }
                    });

                    conn.on("open", function() {
                        console.log('we are connected');
                        that._setupPeer(conn);
                        that.recvQueue.addPlayer(color);
                        that.turnArchive.addPlayer(color);
                        that.attribs.host = false;
                        that.host = conn;
                    });
                }, 1000);
            }
        });

        this.color = color;
    }
};

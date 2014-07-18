// host didnt execute own command
var RTS_CONFIG = {
    "PEER_API_KEY": "liwkv44lmew89f6r",
    "AUTH_SERVER": "http://localhost:5000",
    "NETWORK_FPS": 5
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

function rConnection(army) {
    var that = this;

    this.color = null; // Our player color.

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
                that.armyComposition.push(army);

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
    this.armyComposition = [];

    // List of messages for client to execute
    // For the host, this contains turn data for all players.
    this.recvQueue  = new rCommandQueue();

    this.peers      = [];   // A list of connected clients in the game
    this.authQueue  = [];   // List of messages from the authorization server
    this.sendTick   = 1;    // The current network tick. It represents the exact
                            // tick that we are currently issuing commands for
                            // (player input) and we are executing commands 2
                            // ticks behind this one.
                            //
                            // Hence when sendTick == 1000, we are sending
                            // messages for tick 1000, but executing ticks from
                            // 998.

    this.peerid     = null; // Internal peer.js identifier.

    this.host       = null; // A connection object to the host.
    this.lag_comp   = 3;

    // A handle on the current tick loop, which is adjusted post-connection
    // to match a consistent network tick-rate.
    this.intervalHandle = null;

    this.socket.on("connection", function(conn) {
        if (!that.attribs.open) throw('wat');

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
                    }
                }
            });
        });
    });
}

rConnection.prototype.update = function() {
    /*
     * Connected means we are currently in-game, so we should process
     * network messages accordingly.
     */
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
                "misc": "complete"
            };

            this.recvQueue.pushMessage(done);

            // Process the current buffers to see if everyone has sent their
            // data for this turn.
            var msgs = this.recvQueue.queue[this.sendTick] || [];
            var noop = false;

            if (msgs.length === 0 && !("army_comp" in this.recvQueue.queue["misc"]))
                noop = true;

            for (var i in msgs) {
                if (msgs[i].length === 0) {
                    console.log('[HOST] Turn', this.sendTick,
                                'not ready, waiting on', i);
                    noop = true;
                }
            }

            // We're good. Let's send turn data to all clients.
            if (noop === false) {
                console.log(this.sendTick, 'is ready, broadcasting', msgs);
                for (var j in msgs) {           // For every color
                    for (var k in msgs[j]) {    // For every message

                        // Calculate ping to client
                        if (msgs[j][k].ping !== 0) {
                            this.roundtrip = msgs[j][k].ping;
                        }

                        //
                        // Validation here.
                        //
                    }
                }

                // Handle misc. messages from clients. Army composition
                // broadcasts fall into this category. If we have such a
                // broadcast pending, build our own composition and tell
                // everyone else about it.
                for (var type in this.recvQueue.queue["misc"]) {

                    if (type === "army_comp") {
                        this.armyComposition.push(
                            this.recvQueue.queue["misc"][type].misc
                        );

                        this.sendMessage({
                            "color": type,
                            "turn": this.sendTick,
                            "misc": this.armyComposition
                        });

                        delete this.recvQueue.queue["misc"][type];
                    }
                }

                this.sendMessage(done);
                this.sendTick++;
            }

        } else {

            // We have to send all turn data accumulated during this time.

            // Process everything that the server has sent us for this turn.
            for (var tick in this.recvQueue.queue) {
                for (var color in this.recvQueue.queue[tick]) {
                    var msgs = this.recvQueue.queue[tick][color];

                    for (var i in msgs) {

                        // Do things with messages here.
                    }
                }
            }

            // Process misc. messages, if any.
            for (var type in this.recvQueue.queue["misc"]) {
                var msg = this.recvQueue.queue["misc"][type];

                if (type === "army_comp") {
                    console.log('client grok army comp', msg.misc);

                    this.armyComposition = msg.misc;
                    delete this.recvQueue.queue["misc"][type];

                    break;
                }
            }

            // Validate that we've received "complete"s for every player.
            var complete = true;
            if (!(this.sendTick in this.recvQueue.queue)) {
                console.log('queue is empty for', this.sendTick);
                complete = false;
            }

            var msgs = this.recvQueue.queue[this.sendTick] || [];
            for (var i in msgs) {
                if (msgs[i].length === 0) {
                    console.log('[PEER] Turn', this.sendTick,
                                'not ready, waiting on', i);
                    complete = false;
                }
            }

            if (complete) {
                console.log(this.sendTick, "done");
                this.sendTick++;
            }

            // We're done with this turn.
            this.sendMessage({
                "color": this.color,
                "turn": this.sendTick,
                "misc": "complete",
                "ping": this.roundtrip
            });
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
                        that.attribs.host = false;
                        that.host = conn;

                        // Send him our army composition data.
                        setTimeout(function() {
                            that.sendMessage({
                                "color": "army_comp",
                                "turn": that.sendTick,
                                "misc": that.armyComposition[0]
                            }, that.host)
                        }, 1000);
                    });
                }, 1000);
            }
        });

        this.color = color;
    }
};

rConnection.prototype.peerRecv = function(data) {
    if (zogl.debug) {
        console.log('[' + this.peerid + "] RECV: '", data, "'");
    }

    this.recvQueue.pushMessage(data);

    if (this.attribs.host) {
        this.sendMessage(data);

    // Peers do roundtrip time calculation.
    } else if (data.color === this.color &&
               this.sendTick === data.turn) {

        var now = window.performance.now();
        this.roundtrip = now - data.timestamp;
    }
};

rConnection.prototype.sendMessage = function(obj, peer) {
    var msg = new rMessage(obj);
    if (msg.isValid()) {

        // Only attach timestamp when the message being sent is our own.
        if (obj.color === this.color) {
            obj.timestamp = window.performance.now();
        }

        if (zogl.debug) {
            console.log('[' + this.peerid + "] SEND: '", obj, "'");
        }

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

rConnection.prototype._setupPeer = function(conn) {
    var that = this;

    this.peers.push(conn);

    this.attribs.open = false;
    this.attribs.connected = true;

    clearInterval(this.intervalHandle);
    this.intervalHandle = setInterval(function() {
        that.update();
    }, 1000 / RTS_CONFIG.NETWORK_FPS);

    conn.on("data", function(d) {
        that.peerRecv(d);
    });
};

rConnection.prototype.addOrders = function(orders) {
    if (orders instanceof Array) {
        for (var i in orders) {
            this.addOrders(orders[i]);
        }

        return;
    }

    orders.turn += this.lag_comp;

    if (this.attribs.host) {
        this.recvQueue.pushMessage(orders);
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

var RTS_CONFIG = {
    "PEER_API_KEY": "lwjd5qra8257b9",
    "AUTH_SERVER": "http://localhost:5000",
    "NETWORK_FPS": 30
};

var available_colors = [
    "blue", "red", "yellow"
]

function AJAX(requestType, requestURL, callback) {
    callback = callback || function() {};

    var ajax = new XMLHttpRequest();
    ajax.onreadystatechange = function() {
        callback(ajax);
    };
    ajax.open(requestType, requestURL, true);
    ajax.send();
}

function rConnection(color) {
    var that = this;

    this.color = color; // Our player color.

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
                that.hostQueue.addPlayer(that.color);

                console.log("We are", that.color);
            }
        });
    });

    this.attribs = {
        "host": false,
        "open": false,
        "connected": false
    };

    this.recvQueue  = [];   // List of messages for client to execute
    this.sendQueue  = [];   // List of messages to send to the host for broadcast

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

    // A handle on the current tick loop, which is adjusted post-connection
    // to match a consistent network tick-rate.
    this.intervalHandle = null;

    // HOST ONLY

    // Contains turn data for all players.
    this.hostTick   = 1;
    this.hostQueue  = new rCommandQueue();
    this.peers      = [];   // A list of connected clients in the game

    this.socket.on("connection", function(conn) {
        if (!that.attribs.open) throw('wat');

        // We immediately establish a connection, but first we check the command
        // queue on the server to see if this is a valid requested connection.
        conn.on("open", function() {

            // After commands are retrieved, process them.
            that.getCommands(function() {

                for (var i = that.recvQueue.length - 1; i >= 0; --i) {
                    var cmd = that.recvQueue[i];

                    // Someone officially really does want to connect to us, so
                    // we can check for an ID match and accept the connection.
                    if (cmd.type === "connect" && !that.attribs.connected) {
                        console.log('expecting a connection from', cmd.from);
                        AJAX("DELETE", RTS_CONFIG.AUTH_SERVER + "/commands/" + that.peerid);
                        that.recvQueue.splice(i, 1);

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
                        that.hostQueue.addPlayer(conn.metadata.color);
                        that.attribs.host = true;
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
            if (this.sendQueue.length === 0) {
                this.hostQueue.pushMessage({
                    "color": this.color,
                    "turn": this.sendTick,
                    "misc": "complete"
                })
            } else {
                for (var i in this.sendQueue) {
                    this.hostQueue.pushMessage(this.sendQueue[i]);
                }
            }

            // Process the current buffers to see if everyone has sent their
            // data for this turn.
            var msgs = this.hostQueue.queue[this.hostTick] || [];
            var noop = false;

            if (msgs.length === 0) noop = true;
            for (var i in msgs) {
                if (msgs[i].length === 0) {
                    console.log('Turn', this.hostTick, 'not ready, waiting on', i);
                    noop = true;
                }
            }

            // We're good. Let's send turn data to all clients.
            if (noop === false) {
                console.log('broadcasting', msgs);
                for (var j in msgs) {
                    for (var k in msgs[j]) {
                        for (var i in this.peers) {
                            this.sendMessage(msgs[j][k], this.peers[i]);
                        }
                    }

                    msgs[j] = [];
                }

                this.hostTick++;
                this.sendTick++;
            } else {
                console.log('[HOST] -- Clients are not ready.');
            }
        } else {

            // We have to send all turn data accumulated during this time.

            // Process everything that the server has sent us for this turn.
            for (var i in this.recvQueue) {
                // TODO
            }
            if (this.recvQueue.length !== 0) this.sendTick++;
            this.recvQueue = [];

            // Send everything that the player has done during this turn.

            // Tell the host there is no data for this turn from us.
            if (this.sendQueue.length === 0) {
                console.log("Sending empty message.");
                this.sendMessage({
                    "color": this.color,
                    "turn": this.sendTick,
                    "misc": "complete"
                });

            } else {
                for (var i in this.sendQueue) {
                    this.sendMessage(this.sendQueue[i], this.host);
                }
            }

            this.sendQueue = [];
        }

    /*
     * Open means we are connected to the master server and awaiting
     * either for someone to join us or for the user to choose another socket
     * to join.
     *
     * When this is true, we need to continue pinging the server to let him
     * know we're alive. And request commands, to ask if anyone wants to
     * connect.
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

            that.recvQueue = that.recvQueue.concat(obj.commands);
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
                        that.attribs.host = false;
                        that.host = conn;
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

    // If we're the host, we need to add this data to the messaging queue.
    // Otherwise, just to the recieving queue.
    if (!this.attribs.host) this.recvQueue.push(data);
    else                    this.hostQueue.pushMessage(data);
};

rConnection.prototype.sendMessage = function(obj, peer) {
    var msg = new rMessage(obj);
    if (msg.isValid()) {

        if (zogl.debug) {
            console.log('[' + this.peerid + "] SEND: '", obj, "'");
        }

        if (peer === null || peer === undefined || peer === "all") {
            for (var i in this.peers) {
                this.peers[i].send(obj);
            }
        } else {
            peer.send(obj);
        }
    } else {
        throw('bad msg')
    }
};

rConnection.prototype._setupPeer = function(conn) {
    var that = this;

    // Hosts only.
    this.peers.push(conn);

    this.attribs.open = false;
    this.attribs.connected = true;

    clearInterval(this.intervalHandle);
    this.intervalHandle = setInterval(function() {
        that.update();
    }, 1000 / .333);//RTS_CONFIG.NETWORK_FPS);

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

    if (this.attribs.host) {
        this.hostQueue.addMessage(orders);
    } else {
        this.sendMessage(orders, this.host);
    }
};

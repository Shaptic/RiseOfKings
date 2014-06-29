var MESSAGE_SUFFIX = "\r\n";
var RTS_CONFIG = {
    "PEER_API_KEY": "lwjd5qra8257b9",
    "AUTH_SERVER": "http://localhost:5000",
    "NETWORK_FPS": 30
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

function rConnection() {
    var that = this;

    this.socket = new Peer({
        key: RTS_CONFIG.PEER_API_KEY,
        debug: zogl.debug ? 4 : 0
    });

    this.socket.on("open", function(id) {
        that.peerid = id;
        that.attribs.open = true;
        AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/register/" + id);
    });

    this.attribs = {
        "host": false,
        "open": false,
        "connected": false
    };

    this.commandQueue = [];
    this.peerQueues = [];
    this.ticks  = 0;
    this.turn   = 0;
    this.peerid = null;
    this.peers  = []
    this.intervalHandle = null;

    this.socket.on("connection", function(conn) {
        if (!that.attribs.open) throw('wat');

        conn.on("open", function() {
            that._setupPeer(conn);
            that.attribs.host = true;
        });
    });
}

rConnection.prototype.update = function() {
    this.ticks++;

    /*
     * Connected means we are currently in-game, so we should process
     * network messages accordingly.
     *
     * TODO
     */
    if (this.attribs.connected) {
        this.turn++;

        /*
         * When hosting, we need to wait for all peers to have sent in their 
         * commands before broadcasting the turn data to everyone.
         */
        if (this.attribs.host) {
            
            // Put every message in the message queue into its respective 
            // bucket associated with reciepient.
            var msg = this.messageQueue.popMessage();
            while (msg !== undefined) {
                for (var i in this.peerQueues) {
                    if (this.peerQueues[i].color === msg.color) {
                        this.peerQueues[i].addMessage(msg);
                        break;
                    }
                }

                msg = this.messageQueue.popMessage();
            }

            for (var i in this.peerQueues) {
                var pq = this.peerQueues[i].getMessages();

                // We have yet to receive turn data for this particular peer.
                // Hence, we must wait another tick.
                if (pq.length === 0) {
                    return;
                }
            }

            // This turn is ready to be broadcast.
            for (var i in this.peers) {
                this.peers[i].sendTurn(this.peerQueues);
            }
        }

        this.sendMessage('dicks' + (this.attribs.host ? ' from host' : ' from peer'));
    
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
        if (this.ticks % 2 === 0) {
            this.getCommands();
            this.processCommands();
        }
    }    
};

rConnection.prototype.ping = function() {
    AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/ping/" + this.peerid);
};

rConnection.prototype.getCommands = function() {
    var this = this;
    AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/commands/" + this.peerid, function(ajax) {
        if (ajax.readyState == 4 && ajax.status == 200) {
            var obj = JSON.parse(ajax.responseText);

            this.commandQueue = this.commandQueue.concat(obj.commands);
        }
    });
};

rConnection.prototype.processCommands = function() {
    for (var i = this.commandQueue.length - 1; i >= 0; --i) {
        var cmd = this.commandQueue[i];

        // Someone wants to connect to us; open a connection.
        if (cmd.type === "connect" && !this.attribs.connected) {
            console.log('awaiting a connection');
            AJAX("DELETE", RTS_CONFIG.AUTH_SERVER + "/commands/" + this.peerid);
            this.commandQueue.splice(i, 1);
        }
    }
};

rConnection.prototype.connectTo = function(id) {
    var that = this;
    if (this.attribs.open) {
        AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/connect/" +
                    this.peerid + '/' + id, function(ajax) {
            if (ajax.readyState == 4 && ajax.status == 200) {
                that.attribs.host = false;

                // Connect to the peer host.
                that.peer = that.socket.connect(id);

                console.log('we are connecting');
                that.peer.on("open", function() {
                    console.log('we are connected');
                    that._setupPeer(that.peer);
                    that.attribs.host = false;
                });
            }
        });
    }
};

rConnection.prototype.peerRecv = function(data) {
    if (zogl.debug) {
        console.log('[' + this.peerid + "] RECV: '" + data + "'");
    }

    this.commandQueue.pushMessage(data);
};

rConnection.prototype.sendMessage = function(msg) {
    this.peer.send(this.turn + '|' + msg + MESSAGE_SUFFIX);
};

rConnection.prototype._setupPeer = function(conn) {
    var that = this;

    this.peers.push(conn);
    this.attribs.open = false;
    this.attribs.connected = true;
    this.attribs.open = false;
    this.commandQueue = new rCommandQueue();

    clearInterval(this.intervalHandle);
    
    this.intervalHandle = setInterval(function() {
        that.update();
    }, 1000 / RTS_CONFIG.NETWORK_FPS);

    conn.on("data", function(data) {
        that.peerRecv(data);
    });
};

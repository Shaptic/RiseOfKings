var RTS_CONFIG = {
    "PEER_API_KEY": "lwjd5qra8257b9",
    "AUTH_SERVER": "http://localhost:5000"
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
    this.ticks = 0;
    this.peerid = null;

    this.socket.on("connection", function(conn) {
        if (!that.attribs.open) throw('wat');

        conn.on("open", function() {
            that.peer = conn;
            that.attribs.connected = true;
            that.attribs.host = true;
            that.attribs.open = false;

            that.peer.on("data", function(data) {
                that.peerRecv(data);
            });
        });
    });
}

rConnection.prototype.update = function() {
    this.ticks++;

    /*
     * Open means we are connected to the master server and awaiting
     * either for someone to join us or for the user to choose another socket
     * to join.
     *
     * When this is true, we need to continue pinging the server to let him
     * know we're alive. And request commands, to ask if anyone wants to
     * connect.
     */
    if (this.attribs.open) {
        this.ping();
        if (this.ticks % 2 === 0) {
            this.getCommands();
            this.processCommands();
        }

    /*
     * Connected means we are currently in-game, so we should process
     * network messages accordingly.
     *
     * TODO
     */
    } else if (this.attribs.connected) {
        this.peer.send('dicks' + (this.attribs.host ? ' from host' : ' from peer'));
    }
};

rConnection.prototype.ping = function() {
    AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/ping/" + this.peerid);
};

rConnection.prototype.getCommands = function() {
    var that = this;
    AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/commands/" + this.peerid, function(ajax) {
        if (ajax.readyState == 4 && ajax.status == 200) {
            var obj = JSON.parse(ajax.responseText);

            that.commandQueue = that.commandQueue.concat(obj.commands);
        }
    });
};

rConnection.prototype.processCommands = function() {
    var that = this;

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
                that.peer = that.socket.connect(id)
                console.log('we are connecting');
                that.peer.on("open", function() {
                    console.log('we are connected');
                    that.attribs.connected = true;
                    that.attribs.open = false;
                    that.attribs.network = false;
                });

                that.peer.on("data", function(data) {
                    that.peerRecv(data);
                });
            }
        });
    }
};

rConnection.prototype.peerRecv = function(data) {
    if (zogl.debug) {
        console.log('[' + this.peerid + "] RECV: '" + data + "'");
    }

    this.commandQueue.push(data);
};

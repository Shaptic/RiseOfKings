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
        if (this.ticks % 30 === 0) {
            this.ping();
        }

        if (this.ticks % 60 === 0) {
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

    }
};

rConnection.prototype.ping = function() {
    AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/ping/" + this.peerid);
};

rConnection.prototype.getCommands = function() {
    var that = this;
    AJAX("GET", RTS_CONFIG.AUTH_SERVER + "/getcommands/" + this.peerid, function(ajax) {
        if (ajax.readyState == 4 && ajax.status == 200) {
            var obj = JSON.parse(ajax.responseText);

            that.commandQueue = that.commandQueue.concat(obj.commands);
        }
    });
};

rConnection.prototype.processCommands = function() {
    var that = this;

    for (var i in this.commandQueue) {
        var cmd = this.commandQueue[i];

        if (cmd.type === "connect" && !this.attribs.connected) {
            this.socket.on("connection", function(conn) {
                conn.on("open", function() {
                    that.peer = conn;
                    that.attribs.connection = true;
                    that.attribs.host = true;
                });
            });
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
                that.peer = that.socket.connect(id)
                that.peer.on("open", function() {
                    that.attribs.connected = true;
                    that.attribs.open = false;
                });
            }
        });
    }
};

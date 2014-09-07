net.P2PState = {

};

net.p2p = function(socket, attribs) {
    this.socket = socket;
    this.connections = [];
    this.attribs = attribs || {};

    this.socket.on("connection", function(connectionID) {
        console.log("received connection from", connectionID);
    });
}

net.p2p.prototype.addConnection = function(peerID) {
    this.socket.connect(peerID);
};
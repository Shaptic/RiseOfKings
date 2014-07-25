function rCommandQueue(colors) {
    this.colors = colors || [];
    this.queue = {
        "misc": []
    };
}

rCommandQueue.prototype.addPlayer = function(color) {
    for (var i in this.colors) {
        if (this.colors[i] === color)
            return;
    }

    this.colors.push(color);
    for (var tick in this.queue) {
        if (tick === "misc") continue;
        this.queue[tick][color] = [];
    }
};

rCommandQueue.prototype.pushMessage = function(msg) {
    var obj = validateMessage(msg);

    // Sort messages by turn, then by color.
    if (obj !== false) {

        if (msg.type === MessageType.INPUT) {
            console.log("received order", msg.misc.type, "for", msg.color,
                        "on", msg.turn);
        }

        // Not a player message
        if (msg.type !== MessageType.INPUT &&
            msg.type !== MessageType.DONE) {
            this.queue["misc"].push(msg);

        // Brand new turn?
        } else if (!(msg.turn in this.queue)) {
            this.queue[msg.turn] = {};

            for (var i in this.colors) {
                this.queue[msg.turn][this.colors[i]] = [];
            }

            this.queue[msg.turn][msg.color] = [msg];

        // Existing turn but new color.
        } else if (!(msg.color in this.queue[msg.turn])) {
            this.addPlayer(msg.color);
            this.queue[msg.turn][msg.color].push(msg);

        // Existing turn.
        } else {
            this.queue[msg.turn][msg.color].push(msg);
        }

    } else {
        throw("bad msg");
    }
};

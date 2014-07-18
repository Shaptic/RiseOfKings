/*
 * Message format:
 *
 * Messages are JSON-encoded objects containing data about the game state
 * for this particular player. Since the only messages transmitted contain
 * state based on player input, messages are essentially just orders.
 *
 * Hence, the message specification is as follows:
 *
 * var Message = {
 *  "tick": INTEGER,    // Some value indicating which turn this message is for.
 *
 *  "color": STRING,    // The player color that this message is for (sender ID).
 *
 *  "units": [],        // A list of integers representing unique unit IDs for
 *                      // a certain player which this message applies for. This
 *                      // is usually just determined by a map query client-side.
 *
 *  "orders": [],       // A list of orders (which are JSON objects as well)
 *                      // that apply to the above units.
 *
 *  "misc": STRING      // Miscallaneous data assoc. with this message.
 * };
 *
 */

function rMessage(obj) {
    this.valid = true;

    this.valid = (
        obj.color !== undefined &&
        !!obj.turn
    );

    obj.units  = obj.units || [];
    obj.orders = obj.orders || [];
    obj.misc   = obj.misc || "";

    if (this.valid) {
        this.color = obj.color;
        this.units = obj.units;
        this.orders = obj.orders;
        this.turn = obj.turn;
        this.misc = obj.misc;
    }
}

rMessage.prototype.isValid = function() {
    return this.valid;
};

function rCommandQueue(colors) {
    this.colors = colors || [];
    this.queue = {
        "misc": {}
    };
}

rCommandQueue.prototype.addPlayer = function(color) {
    this.colors.push(color);
    for (var tick in this.queue) {
        this.queue[tick][color] = [];
    }
};

rCommandQueue.prototype.pushMessage = function(msg) {
    var obj = new rMessage(msg);

    // Sort messages by turn, then by color.
    if (obj.isValid()) {

        if (msg.misc !== "complete" && msg.color in COLORS) {
            console.log("received order", msg.orders[0].type, "for", msg.color,
                        "on", msg.turn);
        }

        // Not a player message
        if (!(msg.color in COLORS)) {
            this.queue['misc'][msg.color] = msg;

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

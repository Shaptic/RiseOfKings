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
 *  "orders": []        // A list of orders (which are JSON objects as well)
 *                      // that apply to the above units.
 * };
 *
 */

function rMessage(str) {
    this.color = "";
    this.units = [];
    this.orders = [];
    this.turn = 0;

    var parts = str.split('|');
    this.turn = parseInt(parts[0]);

    if (parts[1].indexOf(';') !== -1) {
        var units = parts[1].split(';');
        for (var i in units) {
            
        }
    } else {

    }
}

function rCommandQueue() {
    this.queue = [];
    this.tmp = "";
}

rCommandQueue.prototype.pushMessage = function(msg) {
    this.tmp += msg;
    this._process();
};

rCommandQueue.prototype.popMessage = function() {
    return this.queue.shift();
};

rCommandQueue.prototype._process = function() {
    var idx = this.tmp.indexOf(MESSAGE_SUFFIX);
    if (idx == -1) return;

    var msg = this.tmp.substring(0, idx + MESSAGE_SUFFIX.length);

    if (zogl.debug) {
        console.log("Processed message: '" + msg + "'");
    }

    this.queue.push(msg);
    this.tmp.replace(msg, '');
};

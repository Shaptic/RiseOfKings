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

    //if (zogl.debug) {
    var MessageType = {
        "DONE":     "done",
        "INPUT":    "input",
        "PING":     "ping",
        "ARMY_COMPOSITION": "army_comp"
    };
    /*} else {
        MessageType = {
            "DONE":     1,
            "INPUT":    2,
            "PING":     3,
            "ARMY_COMPOSITION": 4
        };
    }
}*/

function validateMessage(obj) {
    var valid = true;

    valid = (
        obj.color !== undefined &&
        !!obj.turn
    );

    if (valid) {
        for (var i in MessageType) {
            if (MessageType[i] === obj.type) {
                valid = true;
                break;
            }

            valid = false;
        }
    }

    obj.units  = obj.units || [];
    obj.orders = obj.orders || [];
    obj.misc   = obj.misc || "";
    obj.ping   = obj.ping || 0;

    return valid ? obj : false;
}

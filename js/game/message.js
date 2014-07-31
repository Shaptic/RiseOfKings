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
 *  "type": MessageType,// The type of message being sent.
 *  "tick": INTEGER,    // Some value indicating which turn this message is for.
 *  "color": STRING,    // The player color that this message is for (sender ID).
 *  "ping": FLOAT,      // A number indicating the current round-trip time.
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

    obj.misc   = obj.misc || "";
    obj.ping   = obj.ping || 0;

    return valid ? obj : false;
}

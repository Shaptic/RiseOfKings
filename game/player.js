COLOR_SHADER = [
    'precision mediump float;',

    'varying vec2 vs_texc;',
    'varying vec4 vs_color;',

    'uniform sampler2D texture;',

    'void main(void) {',
        'vec4 texel = texture2D(texture, vs_texc);',
        'gl_FragColor = texel + %(COLOR);',
    '}'
].join('\n');

function rPlayer(map, color, socket) {
    this.groups = [];
    this.units  = [];
    this.map    = map;
    this.socket = socket;

    this.selection = [];
    this.stopSelecting();

    this.setColor(color || "blue");
}

rPlayer.prototype.setUnits = function(units) {
    this.units = units;
    for (var i in this.units) {
        this.units[i].flags.blend = true;
        this.units[i].scene = this.map.scene;
        this.units[i].color = this.color;
        this.units[i].addPass(this.shader);
        this.map.units.push(this.units[i]);
    }
};

rPlayer.prototype.handleEvent = function(evt) {
    var position = zogl.getMousePosition(evt);
        position = new vector(position.x, position.y);

    var order = {
        "type":     MessageType.INPUT,
        "color":    this.color,
        "ping":     this.socket.roundtrip,
        "turn":     this.socket.sendTick,
        "misc":     {
            "type":     evt.type,
            "button":   evt.button,
            "position": {
                "x": position.x,
                "y": position.y
            }
        }
    };

    // LMB was pressed. Hence we are either (a) selecting a single unit,
    // (b) deselecting units or (c) doing nothing.
    if (evt.type == "mousedown" && evt.button == 0) {

        // Existing selection, cancel it.
        if (this.selectionBox !== null) {
            this.stopSelecting();
        }

        // Try selecting here.
        this.selectionBox = new zogl.rect(position.x, position.y, 1, 1);

        /*
         * The map has a reference to the entire game: all units and terrain.
         * It also contains a quad-tree for easy lookup. Therefore it'd be
         * likely faster to just query the map for units than to iterate
         * through every guy we've got to ourselves.
         */
        this.selection = [];
        var tmp = this.map.query(this.selectionBox, rUnit);
        for (var i in tmp) {
            if (tmp[i].color == this.color) {
                this.selection.push(tmp[i]);
            }
        }

        // If this was a double click on a unit, select all units of that type
        // within the map area.
        if (this.just_lmb && this.selection.length === 1) {
            var unit = this.selection[0];
            var results = this.map.query(
                new zogl.rect(0, 0, WINDOW_SIZE.w, WINDOW_SIZE.h),
                rUnit
            );

            this.selection = [];
            for (var i in results) {
                if (results[i].type  === unit.type &&
                    results[i].color === unit.color) {
                    this.selection.push(results[i]);
                }
            }

            this.just_lmb = false;

            // Re-mark the order as a double-click.
            order.misc.type += " double";

        // Otherwise, mark that we clicked LMB so that we can detect a double
        // click the next time around if it is within some threshold of time.
        } else {
            this.just_lmb = true;
            var that = this;
            setTimeout(function() { that.just_lmb = false; }, 300);
        }

        this.socket.addOrders(order);

    // Mouse is moving. Hence we are either (a) adjusting the selection, (b)
    // panning the map or (c) both.
    } else if (evt.type == "mousemove") {

        // We have a selection? Adjust it.
        if (this.selectionBox !== null) {

            this.selectionBox.w = position.x;
            this.selectionBox.h = position.y;

            var left  = Math.min(this.selectionBox.x, this.selectionBox.w);
            var top   = Math.min(this.selectionBox.y, this.selectionBox.h);
            var right = Math.max(this.selectionBox.x, this.selectionBox.w);
            var bottom= Math.max(this.selectionBox.y, this.selectionBox.h);

            this.selectionQuad = new zogl.rect(left, top, right - left, bottom - top);

            this.selection = [];
            var tmp = this.map.query(this.selectionQuad, rUnit);
            for (var i in tmp) {
                if (tmp[i].color === this.color) {
                    this.selection.push(tmp[i]);
                }
            }

        // TODO: Panning
        } else if (false) {

        }

    // Mouse button was released. Hence we are either (a) issuing orders,
    // (b) finishing a selection, or (c) doing nothing.
    } else if (evt.type == "mouseup") {

        // Stop selecting.
        if (evt.button == 0 && this.selectionBox !== null) {
            this.stopSelecting();

        // Issue orders.
        } else if (evt.button == 2 && this.selection !== []) {

            // Play sounds, animation, etc.
            // No real orders yet.

        }

        this.socket.addOrders(order);
    }
};

rPlayer.prototype.handleSocketEvent = function(evt) {
    if (evt instanceof Array) {
        for (var i in evt) {
            this.handleSocketEvent(evt[i]);
        }
        return;
    }

    var position = evt.position;

    // TODO: Process LMB up/down events that do validation on the current
    // selection. And additionally actually do selection for non-local players.
    // At the moment, only local orders will be executed because that's the only
    // way that there will be a selection.

    // Issue orders.
    if (evt.button == 2 && this.selection !== []) {

        // We don't want to recreate a group for the currently selected
        // units every time an order is issued (if no deselection between
        // orders), so we need to check for that.
        if (!this.selectionGroup) {
            var group = new rSquad(this.map);
            group.assignUnits(this.selection);
            this.groups.push(group);
            this.selectionGroup = group;

        } else {
            group = this.selectionGroup;
        }

        // If there is anyone at that position, it's an attack order.
        var units = this.map.query(new zogl.rect(position.x, position.y,
                                                 5, 5), rUnit);
        var is_attack = false;

        for (var i in units) {
            if (units[i].color !== this.color) {
                is_attack = true;
                break;
            }
        }

        // Add orders if CTRL is being held down, otherwise clear them.
        // TODO: Adding.
        group.clearOrders();

        // Attack order
        if (is_attack) {
            group.giveOrders({
                "type": "attack",
                "position": position,
                "target": units[i]
            });

        // Move order
        } else {
            group.giveOrders({
                "type": "move",
                "position": position
            });
        }
    }
};

rPlayer.prototype.update = function() {
    for (var i in this.units) {
        this.units[i].hideHealth();
        this.units[i].update();
    }

    for (var i in this.selection) {
        this.selection[i].showHealth();
    }

    for (var i = this.groups.length - 1; i >= 0; --i) {
        if (this.groups[i].units.length == 0) {
            this.groups.splice(i, 1);
        }
    }
};

rPlayer.prototype.stopSelecting = function() {
    this.selectionBox  = null;
    this.selectionRect = null;
    this.selectionGroup= null;
};

rPlayer.prototype.setColor = function(col) {
    this.color = col;

    var str = COLOR_SHADER.replace('%(COLOR)', 'vec4' + COLORS[this.color]);
    this.shader = new zogl.zShader();
    this.shader.loadFromString(zogl.SHADERS.defaultvs, str);

    if (this.shader.errorstr) {
        throw('Error with color shaders.');
    }
};

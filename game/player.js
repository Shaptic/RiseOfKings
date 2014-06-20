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

function rGroup(map) {
    this.units = [];
    this.astar = new rPathfinder(map);
    this.mode  = "aggro";
}

rGroup.prototype.giveOrders = function(order) {
    if (this.units.length === 0) return;

    if (order instanceof Array) {
        for (var i in order) {
            this.giveOrders(order[i]);
        }

        return;
    }

    // Perform pathfinding a single time on the group.
    this.astar.findPath(new vector(this.units[0].getX(), this.units[0].getY()),
                        order.position);

    // Positions for formation.
    var positions = createGrid(this.units, order.position);

    // We add movement orders for the entire path, and then add the order
    // we were given, with adjusted position, as the last order.
    for (var i = this.astar.path.length - 2; i > 0; --i) {
        for (var j in this.units) {
            this.units[j].addOrder({
                "position": this.astar.path[i],
                "type": "move"
            });
        }
    }

    // Add the last order (non-pathfinding), with formation positions.
    for (var i in this.units) {
        this.units[i].addOrder({
            "type": order.type,
            "position": positions[i],
            "target": order.target
        });
    }
};

rGroup.prototype.clearOrders = function() {
    for (var i in this.units) {
        this.units[i].orders = [];
    }
};

rGroup.prototype.assignUnits = function(units) {
    this.units = units;
    for (var i in this.units) {
        this.units[i].group = this;
    }
};

function rPlayer(map, color) {
    var color = color || 'vec4(0.0, 0.0, 1.0, 1.0)';

    this.groups = [];
    this.units  = [];
    this.map    = map;

    this.selection = [];
    this.selectionBox = null;   // not selecting

    var str = COLOR_SHADER.replace('%(COLOR)', color);
    this.shader = new zogl.zShader();
    this.shader.loadFromString(zogl.SHADERS.defaultvs, str);

    log('errorstr: ', this.shader.errorstr);
}

rPlayer.prototype.setUnits = function(units) {
    this.units = units;
    for (var i in this.units) {
        this.units[i].scene = this.map.scene;
        this.units[i].addPass(this.shader);
        this.map.units.push(this.units[i]);
    }
};

rPlayer.prototype.handleEvent = function(evt) {
    var position = zogl.getMousePosition(evt);
        position = new vector(position.x, position.y);

    // LMB was pressed. Hence we are either (a) selecting a single unit,
    // (b) deselecting units or (c) doing nothing.
    if (evt.type == "mousedown" && evt.button == 0) {

        // Existing selection, cancel it.
        if (this.selectionBox !== null) {
            this.selectionBox = null;

        } else {
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
        }

    // Mouse is moving. Hence we are either (a) adjusting the selection, (b)
    // panning the map or (c) both.
    } else if (evt.type == "mousemove") {

        // We have a selection? Adjust it.
        if (this.selectionBox !== null) {

            var end = position;

            var left  = Math.min(position.x, this.selectionBox.x);
            var top   = Math.min(position.y, this.selectionBox.y);
            var right = Math.max(position.x, this.selectionBox.x);
            var bottom= Math.max(position.y, this.selectionBox.y);

            this.selectionBox = new zogl.rect(left, top, right - left, bottom - top);

            this.selection = [];
            var tmp = this.map.query(this.selectionBox, rUnit);
            for (var i in tmp) {
                if (tmp[i].color == this.color) {
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
            this.selectionBox = null;

        // Issue orders.
        } else if (evt.button == 2 && this.selection !== []) {

            var group = new rGroup(this.map);
            group.assignUnits(this.selection);
            this.groups.push(group);

            // If there is anyone at that position, it's an attack order.
            var units = this.map.query(new zogl.rect(position.x, position.y, 5, 5), rUnit);
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
};

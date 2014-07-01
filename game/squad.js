function rSquad(map) {
    this.units = [];
    this.astar = new rPathfinder(map);
    this.mode  = "aggro";
}

rSquad.prototype.giveOrders = function(order) {
    if (this.units.length === 0) return;

    if (order instanceof Array) {
        for (var i in order) {
            this.giveOrders(order[i]);
        }

        return;
    }

    // Perform pathfinding a single time on the group.
    var exclusion = this.units.concat(order.target === undefined ? [] : [ order.target ]);
    if (!this.astar.findPath(new vector(this.units[0].getX(), this.units[0].getY()),
                             order.position, exclusion)) {
        throw('no path found');
    }

    var positions = [];

    // For attack orders, we want to set the final order such that the units can
    // surround the target.
    if (order.type == "attack" && this.units.length > 1) {
        positions = createGrid(this.units, order.position);

        var w = Math.abs(positions[0].x - positions[positions.length - 1].x),
            h = Math.abs(positions[0].y - positions[positions.length - 1].y);

        for (var i in positions) {

            // Pop the order that is on the target to the
            // next position in the formation.
            if (positions[i].x == order.position.x &&
                positions[i].y == order.position.y) {

                log('adjusting target position');

                positions[positions.length - 1].x = positions[0].x;
                positions[positions.length - 1].y += this.units[
                    (i == 0) ? positions.length - 1 : i - 1
                ].rect.h;
            }

            positions[i].x -= Math.floor(w / 2);
            positions[i].y -= Math.floor(h / 2);
        }
    }

    // Positions for formation.
    else {
        positions = createGrid(this.units, order.position);
    }

    // TODO?
    // Our first order sends the groups to their center of mass before heading
    // towards our target.



    // We add movement orders for the entire path, and then add the order
    // we were given, with adjusted position, as the last order.
    for (var j in this.units) {
        for (var i = this.astar.path.length - 2; i > 0; --i) {

            // We stop ordering movement commands for the unit once we are
            // within range of the target (if we have one and are attacking).
            if (order.target) {
                var dist = Math.pow(this.astar.path[i].x - order.target.getX(), 2) +
                           Math.pow(this.astar.path[i].y - order.target.getY(), 2);
                if (dist < Math.pow(this.units[j].attribs.range, 2)) {
                    break;
                }

            // If we don't have a target, just stop once we are within a tile
            // of our final formation position (from the `positions` array).
            } else {
                var dist = Math.pow(this.astar.path[i].x - positions[j].x, 2) +
                           Math.pow(this.astar.path[i].y - positions[j].y, 2);
                if (dist < Math.pow(TILE_SIZE, 2)) {
                    break;
                }
            }

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

    // Post-attack, we want to set up in formation nearby.
    if (order.type == "attack") {
        var w = (this.units.length <= 4) ?
                 this.units.length :
                 Math.ceil(Math.sqrt(this.units.length));
        var h = this.units.length / w;

        positions = createGrid(this.units, new vector(
            order.position.x - (w / 2 * TILE_SIZE),
            order.position.y - (h / 2 * TILE_SIZE)
        ));

        for (var i in this.units) {
            this.units[i].addOrder({
                "type": "move",
                "position": new vector(positions[i].x + TILE_SIZE,
                                       positions[i].y + TILE_SIZE)
            });
        }
    }
};

rSquad.prototype.clearOrders = function() {
    for (var i in this.units) {
        this.units[i].orders = [];
    }
};

rSquad.prototype.assignUnits = function(units) {
    this.units = units;

    if (units.length == 0) {
        this.rect = new zogl.rect();
        return;
    }

    this.rect  = new zogl.rect(units[0].getX(), units[0].getY(),
                               units[0].rect.w, units[0].rect.h);

    for (var i = 1; i < this.units.length; ++i) {
        this.units[i].group = this;

        this.rect.x = Math.min(this.rect.x, this.units[i].getX());
        this.rect.y = Math.min(this.rect.y, this.units[i].getY());
        this.rect.w = Math.max(this.rect.w, this.units[i].rect.w);
        this.rect.h = Math.max(this.rect.h, this.units[i].rect.h);
    }
};

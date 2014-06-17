var rUnitManager = function(color) {
    this.assignments = [];
};

rUnitManager.prototype.orderUnits = function(obj, position, order) {
    if (obj instanceof Array) {
        for (var i in obj) {
            this.orderUnit(obj[i]);
        }

        return;
    }

    this.assignments.push({
        "object": obj,
        "ai": new rPathfinder()
    });

    var latest = this.assignments[this.assignments.length - 1];
    var then = new zogl.zSprite();
    then.move(position.x, position.y);
    latest.ai.findPath(obj, then);

    log(latest.ai.path);

    for (var i = 0; i < latest.ai.path.length - 1; ++i) {
        obj.addOrder({
            "position": {
                'x': latest.path[i].getX(),
                'y': latest.path[i].getY(),
            }
        });
    }

    obj.addOrder(order);
};
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
        "ai": new rPathfinder(this.map)
    });

    var latest = this.assignments[this.assignments.length - 1];
    latest.ai.findPath({
        'x': obj.getX(),
        'y': obj.getY()
    }, position);

    obj.orders = [];
    for (var i = latest.ai.path.length - 2; i > 0; --i) {
        obj.addOrder({
            "position": {
                'x': latest.ai.path[i].x,
                'y': latest.ai.path[i].y,
            },
            "type": "move"
        });
    }

    obj.addOrder(order);
};

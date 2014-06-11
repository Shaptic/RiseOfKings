/*
 * Sample order format:
 *  {
 *      "position":     [100, 100],     // destination for unit, adjusted for grid
 *      "type":         "move",         // one of ["move", "attack", "guard"]
 *  }
 */

var UNIT_OBJECTS = {
    "tank": new zogl.zQuad(32, 32)
}

rUnit = function(type) {
    if (!UNIT_OBJECTS.tank.loaded) {
        var tx = new zogl.zTexture();
        tx.loadFromFile("tank.png");
        UNIT_OBJECTS.tank.attachTexture(tx);
        UNIT_OBJECTS.tank.create();
        UNIT_OBJECTS.tank.loaded = true;
    }

    zogl.zSprite.call(this);

    if (type instanceof Array) {
        type = type[0];
    }

    if (type == "tank") {
        var tx = new zogl.zTexture();
        tx.loadFromFile("tank.png");

        var q = new zogl.zQuad(32, 32);
        q.attachTexture(tx);
        q.create();

        this.addObject(q);
    } else {
        throw("bad type: " + type);
    }

    this.orders = [];
    this.attribs = {
        "speed": 2
    }
}
rUnit.prototype = new zogl.zSprite();
rUnit.prototype.constructor = rUnit;

rUnit.prototype.setOrder = function(order) {
    this.orders = [];
    this.addOrder(order);
}

rUnit.prototype.addOrder = function(order) {
    this.orders.push(order);
};

rUnit.prototype.update = function() {
    if (this.orders.length) {
        this.adjust(
            this.orders[0].position.x > this.getX() ? this.attribs.speed : -this.attribs.speed,
            this.orders[0].position.y > this.getY() ? this.attribs.speed : -this.attribs.speed
        );

        if (this.collides(this.orders[0].position.x, this.orders[0].position.y)) {
            this.orders.splice(0, 1);
        }
    }
}

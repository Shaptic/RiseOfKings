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
    this.health = 100;
    this.attribs = {
        "speed": 2,
        "damage": 1,
        "range": 36
    };
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
    if (this.health <= 0) {
        this.disable();
        return;
    }

    if (this.orders.length) {
        if (this.orders[0].type == "attack" && 
            this.orders[0].target.health == 0) {
            this.orders.splice(0, 1);

        } else if (this.orders[0].type == "move") {
            if (!this.collides(this.orders[0].position.x,
                               this.orders[0].position.y)) {
                this.adjust(
                    this.orders[0].position.x > this.getX() ? this.attribs.speed : -this.attribs.speed,
                    this.orders[0].position.y > this.getY() ? this.attribs.speed : -this.attribs.speed
                );
            } else {
                this.orders.splice(0, 1);
            }

        } else if (this.orders[0].type == "attack") {
            var enemy = this.orders[0].target;

            // If w/in range, do damage.
            // Find center points.
            if (Math.sqrt(Math.pow(enemy.getX() - this.getX(), 2) + 
                          Math.pow(enemy.getY() - this.getY(), 2)
                ) <= this.attribs.range) {
                enemy.doDamage(this);

            // Otherwise, move towards the target.
            } else {
                var order = this.orders[0];
                this.setOrder({
                    "position": {
                        'x': enemy.getX(),
                        'y': enemy.getY()
                    },
                    "type": "move"
                });

                this.addOrder({
                    "target": enemy,
                    "type": "attack"
                });
            }
        }
    }
}

rUnit.prototype.doDamage = function(obj) {
    this.health -= obj.attribs.damage;

    // if we are not currently attacking this unit, make it an order
    // to do so soon.
    for (var i in this.orders) {
        if (this.orders.type == "attack" && 
            this.orders.target == obj) {
            return;
        }
    }

    this.addOrder({
        "position": {
            'x': obj.getX(),
            'y': obj.getY()
        }, 
        "target": obj,
        "type": "attack"
    });
};
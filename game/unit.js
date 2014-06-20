/*
 * Sample order format:
 *  {
 *      "position":     [100, 100],     // destination for unit, adjusted for grid
 *      "type":         "move",         // one of ["move", "attack", "guard"]
 *  }
 */

var UNIT_ATTRIBUTES = {
    "tank": {
        "speed": 2,
        "range": 1,
        "minrange": 0,
        "damage": 1,
        "delay": 10
    },

    "archer": {
        "speed": 4,
        "range": 3,
        "minrange": 1,
        "damage": 1,
        "delay": 5
    }
};

var UNIT_OBJECTS = {
    "tank": new zogl.zQuad(TILE_SIZE, TILE_SIZE)
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

    if (type == "tank" || type == "archer") {
        var tx = new zogl.zTexture();
        tx.loadFromFile("tank.png");

        var q = new zogl.zQuad(TILE_SIZE, TILE_SIZE);
        q.attachTexture(tx);
        q.create();
        this.addObject(q);
    } else {
        throw("bad type: " + type);
    }

    this.orders = [];
    this.health = 100;
    this.attribs = UNIT_ATTRIBUTES[type];
    this.ai = new rPathfinder();
    this.speed = {
        'dx': 0,
        'dy': 0
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
        var target = {
                'x': this.orders[0].position.x + TILE_SIZE / 2,
                'y': this.orders[0].position.y + TILE_SIZE / 2
            };

        var current = {
            'x': this.getX() + this.rect.w / 2,
            'y': this.getY() + this.rect.h / 2
        };

        var ready = (in_range(current.x, target.x - Math.max(5, this.speed.dx),
                              target.x + Math.max(5, this.speed.dx)) &&
                     in_range(current.y, target.y - Math.max(5, this.speed.dy),
                              target.y + Math.max(5, this.speed.dx)));

        var tx = this.orders[0].position.x - this.getX(),
            ty = this.orders[0].position.y - this.getY();
        var dist = Math.sqrt(tx*tx + ty*ty);

        this.speed = {
            'dx': (tx / dist) * this.attribs.speed,
            'dy': (ty / dist) * this.attribs.speed
        };

        if (this.orders[0].type == "attack" &&
            this.orders[0].target.health == 0) {
            this.orders.splice(0, 1);

        } else if (this.orders[0].type == "move") {

            if (!ready) {
                this.adjust(this.speed.dx, this.speed.dy);
            } else {
                this.move(this.orders[0].position.x,
                          this.orders[0].position.y);
                this.orders.splice(0, 1);
            }

        } else if (this.orders[0].type == "attack") {
            var enemy = this.orders[0].target;

            // If w/in range, do damage.
            // Find center points.

            var dist = Math.pow(enemy.getX() - this.getX(), 2) +
                       Math.pow(enemy.getY() - this.getY(), 2);

            if (dist <= Math.pow(this.attribs.range * TILE_SIZE, 2) &&
                dist >= Math.pow(this.attribs.minrange || 0, 2)) {
                enemy.doDamage(this);

            // Otherwise, move towards the target.
            } else {
                this.adjust(this.speed.dx, this.speed.dy);
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

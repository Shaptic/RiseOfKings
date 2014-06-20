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

function rUnit(scene, type) {
    zogl.zSprite.call(this);

    // Handle any args passed in as an Array (via zogl.zScene).
    if (scene instanceof Array) {
        type  = scene[1];
        scene = scene[0];
    }

    // Create our sprites.
    var tx = new zogl.zTexture();
    tx.loadFromFile(type + ".png");

    var that = this;
    var q = new zogl.zQuad(TILE_SIZE, TILE_SIZE);
    tx.setOnload(function() {
        q.attachTexture(tx);
        q.create();
        that.addObject(q);
    });

    var hBar = scene.addObject();
    var healthBar = new zogl.zQuad(TILE_SIZE, 2);
    healthBar.setColor("#00FF00");
    healthBar.create();
    hBar.addObject(healthBar);

    this.healthBar = hBar;
    this.healthBar.move(this.getX(), this.getY() - 3);
    this.healthBar.disable();

    delete healthBar;

    this.orders = [];
    this.health = 100;
    this.attribs = UNIT_ATTRIBUTES[type];
    this.speed = new vector();
    this.group = null;
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
        var target = new vector(
            this.orders[0].position.x + TILE_SIZE / 2,
            this.orders[0].position.y + TILE_SIZE / 2
        );

        var current = new vector(
            this.getX() + this.rect.w / 2,
            this.getY() + this.rect.h / 2
        );

        var ready = (in_range(current.x, target.x - Math.max(5, this.speed.x),
                              target.x + Math.max(5, this.speed.x)) &&
                     in_range(current.y, target.y - Math.max(5, this.speed.y),
                              target.y + Math.max(5, this.speed.y)));

        var tx = this.orders[0].position.x - this.getX(),
            ty = this.orders[0].position.y - this.getY();
        var dist = Math.sqrt(tx*tx + ty*ty);

        this.speed.x = (tx / dist) * this.attribs.speed;
        this.speed.y = (ty / dist) * this.attribs.speed;

        if (this.orders[0].type == "attack" &&
            this.orders[0].target.health == 0) {
            this.orders.splice(0, 1);

        } else if (this.orders[0].type == "move") {

            if (!ready) {
                this.adjust(this.speed.x, this.speed.y);
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
                this.adjust(this.speed.x, this.speed.y);
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
        "position": new vector(obj.getX(), obj.getY()),
        "target": obj,
        "type": "attack"
    });
};

rUnit.prototype.draw = function(ready) {
    this.healthBar.move(this.getX(), this.getY() - 3);

    zogl.zSprite.prototype.draw.call(this, ready);
    this.healthBar.draw(ready);
};

rUnit.prototype.showHealth = function() {
    this.healthBar.enable();
};

rUnit.prototype.hideHealth = function() {
    this.healthBar.disable();
};

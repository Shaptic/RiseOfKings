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
    var q = new zogl.zQuad();
    tx.setOnload(function() {
        q.resize(tx.size.w, tx.size.h);
        q.attachTexture(tx);
        q.create();
        that.addObject(q);
    });

    this.healthBar = new zogl.zQuad(TILE_SIZE, 2);
    this.healthBar.setColor("#00FF00");
    this.healthBar.create();
    this.healthBar.move(this.getX(), this.getY() - 3);
    this.healthBar.enabled = false;

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
        var order = this.orders[0];

        var target = new vector(
            order.position.x + TILE_SIZE / 2,
            order.position.y + TILE_SIZE / 2
        );

        var current = new vector(
            this.getX() + this.rect.w / 2,
            this.getY() + this.rect.h / 2
        );

        var ready = (in_range(current.x, target.x - Math.max(5, this.speed.x),
                              target.x + Math.max(5, this.speed.x)) &&
                     in_range(current.y, target.y - Math.max(5, this.speed.y),
                              target.y + Math.max(5, this.speed.y)));

        var tx = order.position.x - this.getX(),
            ty = order.position.y - this.getY();
        var mag = Math.sqrt(tx*tx + ty*ty);

        this.speed.x = (tx / mag) * this.attribs.speed;
        this.speed.y = (ty / mag) * this.attribs.speed;

        if (order.type == "attack" &&
            order.target.health == 0) {
            this.orders.splice(0, 1);

        } else if (order.type == "move") {

            if (!ready) {
                this.adjust(this.speed.x, this.speed.y);
            } else {
                this.move(order.position.x,
                          order.position.y);
                this.orders.splice(0, 1);
            }

        } else if (order.type == "attack") {
            var enemy = order.target;

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

    // Update the health bar.
    this.healthBar = new zogl.zQuad(this.healthBar.size.w * (this.health / 100), 2);
    this.healthBar.setColor("#00FF00");
    this.healthBar.create();
    this.healthBar.move(this.getX(), this.getY() - 3);
    this.healthBar.enabled = false;

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
};

rUnit.prototype.drawHealthBar = function() {
    if (this.healthBar.enabled) {
        //this.healthBar.draw();
    }
};

rUnit.prototype.showHealth = function() {
    this.healthBar.enabled = true;
};

rUnit.prototype.hideHealth = function() {
    this.healthBar.enabled = false;
};

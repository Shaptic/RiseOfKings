/*
 * Sample order format:
 *  {
 *      "position":     [100, 100],     // destination for unit, adjusted for grid
 *      "type":         "move",         // one of ["move", "attack", "guard"]
 *  }
 */

var UNIT_ATTRIBUTES = {
    "tank": {
        "health": 60,
        "speed": 2,
        "range": 1 * TILE_SIZE,
        "minrange": 0,
        "damage": 1,
        "rateOfFire": 10,
        "type": "melee"
    },

    "archer": {
        "health": 30,
        "speed": 4,
        "range": 3 * TILE_SIZE,
        "minrange": 1 * TILE_SIZE,
        "damage": 1,
        "type": "ranged",
        "rateOfFire": 20
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
    console.log('Loading unit of type', type);
    var tx = new zogl.zTexture();
    tx.loadFromFile(type + ".png");

    var that = this;
    var q = new zogl.zQuad();
    tx.setOnload(function() {
        q.resize(tx.size.w, tx.size.h);
        q.attachTexture(tx);
        q.create();
        that.addObject(q);

        that.healthBar = new zogl.zQuad(tx.size.w, 2);
        that.healthBar.setColor("#00FF00");
        that.healthBar.create();
        that.healthBar.move(that.getX(), that.getY() - 3);
        that.healthBar.enabled = false;
    });

    this.orders = [];
    this.projectiles = [];
    this.attribs = UNIT_ATTRIBUTES[type];
    this.health = this.attribs.health;
    this.speed = new vector();
    this.group = null;

    this.fireDelay = 0;
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

rUnit.prototype.addOrderToFront = function(order) {
    this.orders.unshift(order);
};

rUnit.prototype.update = function() {
    if (this.health <= 0) {
        this.disable();
        return;
    }

    for (var i in this.projectiles) {
        this.projectiles[i].update();
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

        if (parseInt(mag) == 0) {
            this.speed = new vector();
            this.orders.splice(0, 1);
            return;

        } else {
            this.speed.x = (tx / mag) * this.attribs.speed;
            this.speed.y = (ty / mag) * this.attribs.speed;
        }

        if (order.type == "attack" &&
            order.target.health <= 0) {
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

            var dist = Math.pow(enemy.getX() - this.getX(), 2) +
                       Math.pow(enemy.getY() - this.getY(), 2);

            // If w/in range, do action (fight, shoot, etc.)
            var too_close = (dist < Math.pow(this.attribs.minrange || 0, 2));
            if (dist <= Math.pow(this.attribs.range, 2) && !too_close) {

                if (this.attribs.type == "ranged") {

                    if (this.readyToFire()) {
                        var target_center = new vector(
                            enemy.getX() + enemy.rect.w / 2,
                            enemy.getY() + enemy.rect.h / 2
                        );

                        var local_center = new vector(
                            this.getX() + this.rect.w / 2,
                            this.getY() + this.rect.h / 2
                        );

                        var shot = new rProjectile(null, "arrow");
                        shot.move(local_center.x, local_center.y);
                        shot.fire(order.target);
                        shot.rotate(Math.atan2(target_center.y - local_center.y,
                                               target_center.x - local_center.x));
                        shot.unit = this;
                        this.projectiles.push(shot);
                    }

                } else if (this.attribs.type == "melee") {

                    if (this.readyToFire()) {
                        enemy.doDamage(this);
                    }
                }

            // Too close to attack, flee.
            } else if (too_close === true) {
                log('fleeing');


                var order = this.orders[0];

                // Which direction should we flee in?
                var flee_dir = new vector(-1, -1);

                if (this.getX() > order.target.getX()) {
                    flee_dir.x *= -1;
                }

                if (this.getY() > order.target.getY()) {
                    flee_dir.y *= -1;
                }

                // Calculate a position distance `range` away from the current
                // location in the fleeing direction so that we can attack again.
                this.addOrderToFront({
                    "type": "move",
                    "position": new vector(
                        this.getX() + (flee_dir.x * this.attribs.range + 1),
                        this.getY() + (flee_dir.y * this.attribs.range + 1)
                    )
                });

            // Otherwise, move towards the target.
            } else {

                // If we are within a certain range of the target, let's "see"
                // if it's moved from the original order position. If it is,
                // update accordingly.

                var dist = Math.pow(order.position.x - this.getX(), 2) +
                           Math.pow(order.position.y - this.getY(), 2);

                if (dist <= Math.pow(this.attribs.range, 2)) {
                    order.position.x = enemy.getX();
                    order.position.y = enemy.getY();

                } else {
                    this.adjust(this.speed.x, this.speed.y);
                }
            }
        }
    }
}

rUnit.prototype.doDamage = function(obj) {
    this.health -= obj.attribs.damage;

    // Update the health bar.

    // What percentage of health is remaining?
    var fraction = this.health / this.attribs.health;

    this.healthBar = new zogl.zQuad(this.rect.w * fraction, 2);
    this.healthBar.setColor("#00FF00");
    this.healthBar.create();
    this.healthBar.move(this.getX(), this.getY() - 3);
    this.healthBar.enabled = false;

    // if we are not currently attacking someone, make it an order
    // to do so soon.
    for (var i in this.orders) {
        if (this.orders.type == "attack") {
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
    if (this.isAlive() && this.healthBar.enabled) {
        this.healthBar.draw();
    }
};

rUnit.prototype.showHealth = function() {
    this.healthBar.enabled = true;
};

rUnit.prototype.hideHealth = function() {
    this.healthBar.enabled = false;
};

rUnit.prototype.readyToFire = function() {
    if (this.fireDelay <= 0) {
        this.fireDelay = this.attribs.rateOfFire;
        return true;
    }

    --this.fireDelay;
    return false;
};

rUnit.prototype.isAlive = function() {
    return this.health > 0;
};

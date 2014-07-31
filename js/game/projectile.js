function rProjectile(scene, type) {
    zogl.zSprite.call(this);

    // Handle any args passed in as an Array (via zogl.zScene).
    if (scene instanceof Array) {
        type  = scene[1];
        scene = scene[0];
    }

    // Create our sprites.
    var tx = new zogl.zTexture();
    var that = this;
    var q = new zogl.zQuad();
    tx.setOnload(function() {
        q.resize(tx.size.w, tx.size.h);
        q.attachTexture(tx);
        q.create();
        that.addObject(q);
    });

    tx.loadFromFile(type + ".png");

    this.flags.blend = true;

    this.target = null;
    this.speed  = new vector(0, 0);
    this.unit   = null;
}
rProjectile.prototype = new zogl.zSprite();
rProjectile.prototype.constructor = rProjectile;

rProjectile.prototype.fire = function(target) {
    this.start = new vector(
        this.getX(),
        this.getY()
    );
    this.target = target;

    var tx = target.getX() - this.getX(),
        ty = target.getY() - this.getY();
    var mag = Math.sqrt(tx*tx + ty*ty);

    this.speed.x = (tx / mag) * 5;
    this.speed.y = (ty / mag) * 5;
};

rProjectile.prototype.update = function() {
    var dist = Math.pow(this.getX() - this.start.x, 2) +
               Math.pow(this.getY() - this.start.y, 2);

    if (dist <= Math.pow(this.unit.attribs.range, 2)) {
        this.adjust(this.speed.x, this.speed.y);
    }
};

function rProjectile(scene, type) {
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

    this.flags.blend = true;

    this.target = null;
    this.speed  = new vector(0, 0);
    this.unit   = null
}
rProjectile.prototype = new zogl.zSprite();
rProjectile.prototype.constructor = rProjectile;

rProjectile.prototype.fire = function(target) {
    this.target = target;

    var tx = target.getX() - this.getX(),
        ty = target.getY() - this.getY();
    var mag = Math.sqrt(tx*tx + ty*ty);

    this.speed.x = (tx / mag) * 5;
    this.speed.y = (ty / mag) * 5;
};

rProjectile.prototype.update = function() {
    this.adjust(this.speed.x, this.speed.y);
};

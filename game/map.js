function rMap(scene) {
    this.grid   = {};
    this.units  = [];
    this.goodTerrain = [];
    this.badTerrain = [];
    this.scene = scene;
};

rMap.prototype.create = function() {
    var grass = this.scene.addObject();
    var q = new zogl.zQuad(WINDOW_SIZE.w, WINDOW_SIZE.h);
    var tx = new zogl.zTexture();
    var that = this;

    tx.loadFromFile("grass.png");
    tx.setOnload(function() {
        q.attachTexture(tx);
        q.attribs.repeat = true;
        q.create();

        grass.addObject(q);
        that.goodTerrain.push(grass);
    });

    for (var x = 0; x < grass.rect.w; x += TILE_SIZE) {
        this.grid[x] = {};

        for (var y = 0; y < grass.rect.h; y += TILE_SIZE) {
            this.grid[x][y] = grass;
        }
    }
};

rMap.prototype.getTileAt = function(x, y) {
    var pos = getAlignedPos(new vector(x, y));

    if (pos.x in this.grid) {
        if (pos.y in this.grid[pos.x]) {
            return this.grid[pos.x][pos.y]
        }

        return null;
    }

    return null;
};

rMap.prototype.isCollideableAt = function(x, y) {
    var pos = getAlignedPos(new vector(x, y));

    // Check if there is a unit at this position.
    for (var i in this.units) {
        var unit_pos = getAlignedPos(new vector(this.units[i].getX(),
                                                this.units[i].getY()));

        if (parseInt(unit_pos.x) == parseInt(x) &&
            parseInt(unit_pos.y) == parseInt(y)) {
            return pos;
        }
    }

    // Now, check if this terrain is passable.
    var tile = this.getTileAt(x, y);
    for (var i in this.badTerrain) {
        if (tile === this.badTerrain[i]) {
            return tile;
        }
    }

    return null;
};

rMap.prototype.query = function(rect, type) {
    var result = [];

    if (type == rUnit || type.constructor == rUnit) {
        for (var i in this.units) {
            if (this.units[i].collides(rect)) {
                result.push(this.units[i]);
            }
        }

    } else {
        for (var i in this.units) {
            if (this.units[i].collides(rect)) {
                result.push(this.units[i]);
            }
        }

        for (var i in this.goodTerrain) {
            if (this.goodTerrain[i].collides(rect)) {
                result.push(this.goodTerrain[i]);
            }
        }

        for (var i in this.badTerrain) {
            if (this.badTerrain[i].collides(rect)) {
                result.push(this.badTerrain[i]);
            }
        }
    }

    return result;
};

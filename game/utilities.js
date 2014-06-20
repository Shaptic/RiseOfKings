var TILE_SIZE = 32;
var WINDOW_SIZE = {
    'w': 800,
    'h': 600
};

function createGrid(units, position) {
    var w = (units.length <= 4) ? units.length : Math.ceil(Math.sqrt(units.length));
    var h = units.length / w;

    var result = [];
    var x = 0, y = 0;

    for (var i = 0; i < units.length; i++) {
        result.push({
            'x': x + position.x,
            'y': y + position.y
        });

        x += TILE_SIZE;
        if (x >= w * TILE_SIZE) {
            x = 0;
            y += TILE_SIZE;
        }
    };

    return result;
}

function vector(x, y) {
    this.x = x || 0;
    this.y = y || 0;
}

function in_range(val, min, max) {
    return val >= min && val <= max;
}

function getAlignedPos(pos) {
    off = new vector(pos.x % TILE_SIZE,
                     pos.y % TILE_SIZE);

    return new vector(
        pos.x + (off.x < TILE_SIZE ? -off.x : off.x),
        pos.y + (off.y < TILE_SIZE ? -off.y : off.y)
    );
}

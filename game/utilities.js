var TILE_SIZE = 32;
var WINDOW_SIZE = {
    'w': 300,
    'h': 250
};

var COLORS = {
    "red":      '(1.0, 0.0, 0.0, 0.0)',
    "blue":     '(0.0, 0.0, 1.0, 0.0)',
    "green":    '(0.0, 1.0, 0.0, 0.0)'
};

function createGrid(units, position) {
    var w = (units.length <= 4) ? units.length : Math.ceil(Math.sqrt(units.length));
    var h = units.length / w;

    var result = [];
    var x = 0, y = 0;

    for (var i = 0; i < units.length; i++) {
        result.push(new vector(x + position.x, y + position.y));

        x += units[i].rect.w;
        if (x >= w * units[i].rect.w) {
            x = 0;
            y += units[i].rect.h;
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

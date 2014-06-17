map = {};

function vector(x, y) {
    this.x = x || 0;
    this.y = y || 0;
}

function rMap() {
    this.units = [];
    this.tiles = [];
}

rMap.prototype.getTileAt = function(x, y) {
    var pos = getAlignedPos({
        'x': x,
        'y': y
    });

    log('at', pos);

    if (pos.x < 0 || pos.x >= 800 ||
        pos.y < 0 || pos.y >= 600) return null;

    return map[pos.x][pos.y];
};

rMap.prototype.isCollideableAt = function(x, y) {
    var pos = getAlignedPos({
        'x': x,
        'y': y
    });

    for (var i in this.units) {
        if (parseInt(this.units[i].getX()) == parseInt(x) &&
            parseInt(this.units[i].getY()) == parseInt(y)) {
            log('rect', this.units[i].rect, 'pos', pos);
            return pos;
        }
    }

    return null;
};

var Node = function() {
    this.parent = null;
    this.tile = null;
    this.cost = 0;
    this.move_count = 0;
    this.heuristic = 0;
};

var rPathfinder = function(map) {
    this.path = [];
    this.map = map;
}

rPathfinder.prototype.findPath = function(start, end) {
    this.path = [];

    var openList = [];
    var closedList = [];

    var node = new Node();
    node.tile = start;
    openList.push(node);

    while (openList.length) {
        var idx = 0;
        var min_cost = openList[idx].cost;

        for (var i in openList) {
            if (min_cost > openList[i].cost) {
                min_cost = openList[i].cost;
                idx = i;
            }
        }

        var currentNode = openList[idx];

        for (var i = openList.length - 1; i >= 0; --i) {
            if (currentNode === openList[i]) {
                openList.splice(i, 1);
                break;
            }
        }

        closedList.push(currentNode);

        if (currentNode.tile.x == end.x &&
            currentNode.tile.y == end.y)
            break;

        for (var x = -1; x <= 1; ++x) {
            for (var y = -1; y <= 1; ++y) {
                // todo
                var tile = this.map.getTileAt(currentNode.tile.x + (32 * x),
                                              currentNode.tile.y + (32 * y));

                log('tile', tile);

                if (tile == null) continue;

                var rect = currentNode.tile;
                //log(this.map.isCollideableAt(rect.x, rect.y));
                if (this.map.isCollideableAt(tile.x, tile.y) !== null) {
                    continue;
                }

                var closed = false;
                for (var i in closedList) {
                    if (tile === closedList[i].tile) {
                        closed = true;
                    }
                }

                if (closed) continue;

                var h = Math.abs(end.x - tile.x) / 32 +
                        Math.abs(end.y - tile.y) / 32;

                var open = false;
                for (var i in openList) {
                    if (openList[i].tile == tile) {
                        if (openList[i].cost < h + openList[i].parent.move_count + 1) {
                            openList[i].parent = currentNode;
                            openList[i].move_count = openList[i].parent.move_count + 1;
                            openList[i].heuristic = h;
                            openList[i].cost = h + openList[i].move_count;
                        }

                        open = true;
                        break;
                    }
                }

                if (!open) {
                    var node = new Node();
                    node.parent = currentNode;
                    node.tile = tile;
                    node.heuristic = h;
                    node.move_count = node.parent.move_count + 1;
                    node.cost = h + node.move_count;

                    openList.push(node);
                }
            }
        }
    }

    log('closed list', closedList, 'open list', openList);

    this.current = 0;
    if (openList.length == 0) {
        return false;
    }

    for (var i = closedList.length - 1; i >= 0; --i) {
        this.path.push(closedList[i].tile);
    }

    return true;
};

rPathfinder.prototype.showPath = function() {
    for (var i in this.path) {
        var q = new zogl.zQuad(32, 32);
        q.move(this.path[i].x, this.path[i].y);
        q.create();
        q.draw();
    }
}

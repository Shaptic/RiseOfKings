var map = [];
var q = new zogl.zQuad(32, 32);
q.create();

for (var i = 0; i < 800; i += 32) {
    map[i] = [];
    for (var j = 0; j < 600; j += 32) {
        map[i][j] = new zogl.zSprite();
        map[i][j].addObject(q);
        map[i][j].move(i, j);
    }
}

function getTileAt(x, y) {
    var pos = getAlignedPos({
        'x': x,
        'y': y
    });
    return map[pos.x][pos.y];
}

var Node = function() {
    this.parent = null;
    this.tile = null;
    this.cost = 0;
    this.move_count = 0;
    this.heuristic = 0;
};

var rPathfinder = function() {
    this.path = [];
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

        if (currentNode.tile === end) 
            break;

        for (var x = -1; x <= 1; ++x) {
            for (var y = -1; y <= 1; ++y) {
                // todo
                var tile = getTileAt(currentNode.tile.getX(), 
                                     currentNode.tile.getY());

                log('tile', tile);

                if (tile == null) continue;

                /*
                var rect = currentNode.tile.rect;
                rect.w = 34; rect.h = 34;
                rect.x -= 1; rect.y -= 1;
                if (isCollideableAt(rect.x, rect.y)) {
                    continue;
                }
                */

                var closed = false;
                for (var i in closedList) {
                    if (tile == closedList[i].tile) {
                        closed = true;
                    }
                }

                if (closed) continue;

                var h = Math.abs(end.getX() - tile.getX()) / 32 + 
                        Math.abs(end.getY() - tile.getY()) / 32;

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

    log('closed list', closedList);

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
        var q = new zogl.zQuad();
        q.resize(this.path[i].size.w, 
                 this.path[i].size.h);
        q.move(this.path[i].getX(), this.path[i].getY());
        q.create();
        q.draw();
    }
}
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
                var tile = this.map.getTileAt(currentNode.tile.x + (TILE_SIZE * x),
                                              currentNode.tile.y + (TILE_SIZE * y));

                if (tile == null) continue;

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

                var h = Math.abs(end.x - tile.x) / TILE_SIZE +
                        Math.abs(end.y - tile.y) / TILE_SIZE;

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

    this.current = 0;
    if (openList.length == 0) {
        return false;
    }

    for (var node = closedList[closedList.length - 1];
             node != null;
             node = node.parent) {
        this.path.push(node.tile);
    }

    return true;
};

rPathfinder.prototype.showPath = function() {
    for (var i in this.path) {
        var q = new zogl.zQuad(TILE_SIZE, TILE_SIZE);
        q.move(this.path[i].x, this.path[i].y);
        q.create();
        q.draw();
    }
}

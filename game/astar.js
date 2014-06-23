var Node = function() {
    this.parent = null;     // Node
    this.tile = null;       // vector
    this.cost = 0;          // heuristic + move_count
    this.move_count = 0;    // int
    this.heuristic = 0;     // double [distance]
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

        // Find the node w/ the lowest cost.
        var idx = 0;
        var min_cost = openList[idx].cost;
        for (var i in openList) {
            if (min_cost > openList[i].cost) {
                min_cost = openList[i].cost;
                idx = i;
            }
        }

        // This node is good, so we add it to the closed list.
        // (remove from open first)
        var currentNode = openList[idx];
        for (var i = openList.length - 1; i >= 0; --i) {
            if (currentNode === openList[i]) {
                openList.splice(i, 1);
                break;
            }
        }
        closedList.push(currentNode);

        // Have we reached the end of our search?
        if (currentNode.tile.x == end.x &&
            currentNode.tile.y == end.y)
            break;

        // Let's check adjacent nodes for cost-effectiveness.
        for (var x = -1; x <= 1; ++x) {
            for (var y = -1; y <= 1; ++y) {

                // Skip self
                if (x == 0 && y == 0) continue;

                var adjpos = new vector(
                    currentNode.tile.x + (TILE_SIZE * x),
                    currentNode.tile.y + (TILE_SIZE * y)
                );

                // Grab the adjacent tile vector from the map.
                var tile = this.map.getTileAt(adjpos.x, adjpos.y);

                // Nothing here? Not a valid path.
                if (tile === null) continue;

                // Would there be a collision if we came here?
                if (this.map.isCollideableAt(adjpos.x, adjpos.y) !== null) {
                    continue;
                }

                // Is this tile already in the closed (potential path) list?
                var closed = false;
                for (var i in closedList) {

                    // We check the references because the .tile attribute
                    // will be a direct reference to the map object so comparing
                    // them will work.
                    if (tile === closedList[i].tile || (
                        closedList[i].tile.x == tile.x &&
                        closedList[i].tile.y == tile.y)) {
                        closed = true;
                    }
                }
                if (closed) continue;

                // Calculate distance, sorta.
                var h = Math.abs(end.x - tile.x) / TILE_SIZE +
                        Math.abs(end.y - tile.y) / TILE_SIZE;

                // Is it in the open list? Meaning, are we revisiting the tile
                // again for another check?
                var open = false;
                for (var i in openList) {

                    // It is.
                    if (openList[i].tile === tile || (
                        openList[i].tile.x == tile.x &&
                        openList[i].tile.y == tile.y)) {

                        // Now, is it an improvement over the existing node?
                        if (openList[i].heuristic < h) {
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
                    var node        = new Node();
                    node.parent     = currentNode;
                    node.tile       = tile;
                    node.heuristic  = h;
                    node.move_count = node.parent.move_count + 1;
                    node.cost       = h + node.move_count;

                    openList.push(node);
                }
            }
        }
    }

    this.current = 0;
    if (closedList.length == 0) {
        log(closedList);
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

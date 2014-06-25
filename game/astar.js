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

/**
 * @param   start       vector  Position to start at
 * @param   start       vector  Position to end at
 * @param   exclude     list    List of objects to exclude (must have .getX() and .getY())
 * @param   stop_dist   float   Distance from `end` with which to stop searching.
 **/
rPathfinder.prototype.findPath = function(start, end, exclude, stop_dist) {
    log(exclude);
    end = getAlignedPos(end);
    stop_dist = stop_dist || 0;

    this.path = [];

    var openList = [];
    var closedList = [];

    var node = new Node();
    node.tile = start;
    openList.push(node);

    var that = this;
    function getNeighbors(node) {
        var n = [];

        n.push(that.map.getTileAt(node.x - TILE_SIZE, node.y - TILE_SIZE));
        n.push(that.map.getTileAt(node.x, node.y - TILE_SIZE));
        n.push(that.map.getTileAt(node.x + TILE_SIZE, node.y - TILE_SIZE));

        n.push(that.map.getTileAt(node.x - TILE_SIZE, node.y));
        n.push(that.map.getTileAt(node.x + TILE_SIZE, node.y));

        n.push(that.map.getTileAt(node.x - TILE_SIZE, node.y + TILE_SIZE));
        n.push(that.map.getTileAt(node.x, node.y + TILE_SIZE));
        n.push(that.map.getTileAt(node.x + TILE_SIZE, node.y + TILE_SIZE));

        return n.filter(function(e) { return e !== null; });
    }

    function cmp(a, b) {
        return parseInt(a.x) == parseInt(b.x) &&
               parseInt(a.y) == parseInt(b.y);
    }

    while (openList.length) {
        // Find the node w/ the lowest cost.
        var idx = 0;
        for (var i in openList) {
            if (openList[i].cost <= openList[idx].cost) {
                idx = i;
            }
        }

        // This node is good, so we add it to the closed list.
        // (remove from open first)
        var currentNode = openList[idx];
        closedList.push(currentNode);
        openList.splice(idx, 1);

        // Have we reached the end of our search?
        if ((stop_dist && (Math.pow(currentNode.tile.x - end.x, 2) +
             Math.pow(currentNode.tile.x - end.x, 2) <= Math.pow(stop_dist, 2))) ||
            cmp(currentNode.tile, end)) {
            break;
        }

        // Let's check adjacent nodes for cost-effectiveness.
        var neighbors = getNeighbors(currentNode.tile);
        for (var i in neighbors) {
            var tile = neighbors[i];

            // Would there be a collision if we came here?
            var hit = this.map.isCollideableAt(tile.x, tile.y);
            if (hit && exclude) {
                for (var i in exclude) {
                    if (exclude[i].getX() == hit.x &&
                        exclude[i].getY() == hit.y) {
                        hit = false;
                        break;
                    }
                }
            }
            if (hit) continue;

            // Distance from last tile.
            var g = 100;
            if (currentNode.tile.x != tile.x ||
                currentNode.tile.y != tile.y) {
                g = 140;
            }
            g += currentNode.move_count;

            // Is this tile already in the closed (potential path) list?
            var closed = null;
            for (var i in closedList) {

                // We check the references because the .tile attribute
                // will be a direct reference to the map object so comparing
                // them will work.
                if (cmp(closedList[i].tile, tile)) {
                    closed = closedList[i];
                    break;
                }
            }

            if (closed !== null && g >= closed.move_count) {
                continue;
            }

            // Manhattan heuristic.
            var h = Math.abs(end.x - tile.x) +
                    Math.abs(end.y - tile.y);

            // Is it in the open list? Meaning, are we revisiting the tile
            // again for another check?
            var open = false;
            for (var i in openList) {

                // It is.
                if (cmp(openList[i].tile, tile)) {

                    // Now, is it an improvement over the existing node?
                    if (openList[i].move_count > g) {
                        openList[i].parent = currentNode;
                        openList[i].heuristic = h;
                        openList[i].move_count = g;
                        openList[i].cost = h + g;
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
                node.move_count = g;
                node.cost       = h + g;

                openList.push(node);
            }
        }
    }

    this.current = 0;
    if (openList.length == 0) {
        alert('no path');
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

/*
 * TODO:
 *
 * [*] Smoother movement.
 * [ ] Make pathfinding occur only once for groups.
 * [ ] Fix the freeze that occurs when attacking (pathfinding related?).
 * [ ] Map panning.
 * [*] Utility file.
 * [ ] Refactor into armies / players.
 * [ ] Automatic attacking when w/in range.
 * [ ] Minimum attack range.
 * [ ] Frame-rate independent move speed.
 * [ ] Single unit selection w/o dragging.
 */

function init() {
    var w = new zogl.zWindow(WINDOW_SIZE.w, WINDOW_SIZE.h);
    w.init();

    var scene   = new zogl.zScene();
    var gameMap = new rMap(scene);
    var player  = new rPlayer(gameMap);
    var enemy   = new rPlayer(gameMap, 'vec4(1.0, 0, 0, 1.0)');

    gameMap.create();

    var UNIT_COUNT = 10;
    var units = new Array(UNIT_COUNT);
    for (var i = 0; i < UNIT_COUNT; ++i) {
        var pos = getAlignedPos(new vector(TILE_SIZE * 2 * i, 100));

        units[i] = scene.addObject(rUnit, [
            scene,
            (i > UNIT_COUNT / 2) ? "tank" : "archer"
        ]);
        units[i].move(pos.x, pos.y);
    }

    player.setUnits(units.slice(0, 5));
    enemy.setUnits(units.slice(5));

    var playerEventHandler = function(evt) {
        player.handleEvent(evt);
        enemy.handleEvent(evt);
    }

    glGlobals.canvas.addEventListener("mousedown", playerEventHandler, false);
    glGlobals.canvas.addEventListener("mouseup",   playerEventHandler, false);
    glGlobals.canvas.addEventListener("mousemove", playerEventHandler, false);
    glGlobals.canvas.addEventListener("mouseout",  playerEventHandler, false);

    var selectionQuad = new zogl.zQuad();

    var game = function() {
        w.clear('#000000');

        if (player.selectionBox !== null) {
            if (selectionQuad.size.w !== player.selectionBox.w ||
                selectionQuad.size.h !== player.selectionBox.h) {
                selectionQuad = new zogl.zQuad(player.selectionBox.w,
                                               player.selectionBox.h);
                selectionQuad.setColor(new zogl.color4([1.0, 1.0, 1.0, 0.5]));
                selectionQuad.create();
                selectionQuad.move(player.selectionBox.x, player.selectionBox.y);
            }

            if (selectionQuad.x !== player.selectionBox.x ||
                selectionQuad.y !== player.selectionBox.y) {
                selectionQuad.move(player.selectionBox.x, player.selectionBox.y);
            }
        }

        player.update();
        enemy.update();

        scene.draw();

        if (player.selectionBox !== null) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            selectionQuad.draw();
            gl.disable(gl.BLEND);
        }

        requestAnimationFrame(game);
    };

    requestAnimationFrame(game);
}

window.onload = function() {
    zogl.debug = true;
    zogl.init(document.getElementById('webgl-canvas'));
    init();
};

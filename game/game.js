/*
 * TODO:
 *
 * [*] Smoother movement.
 * [*] Make pathfinding occur only once for groups.
 * [*] Fix the freeze that occurs when attacking (pathfinding related?).
 * [ ] Map panning.
 * [*] Utility file.
 * [*] Refactor into armies / players.
 * [ ] Automatic attacking when w/in range.
 * [ ] Minimum attack range.
 * [ ] Frame-rate independent move speed.
 * [*] Single unit selection w/o dragging.
 * [*] Get into formation after attacking.
 * [*] Fix non-standard selection.
 * [*] Make double-click on unit select all in range.
 * [ ] Implement the quad-tree into the map.
 */

function init() {
    var w = new zogl.zWindow(WINDOW_SIZE.w, WINDOW_SIZE.h);
    w.init();

    var scene   = new zogl.zScene();
    var gameMap = new rMap(scene);
    var player  = new rPlayer(gameMap);
    var enemy   = new rPlayer(gameMap, "red");

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
        //enemy.handleEvent(evt);
    }

    glGlobals.canvas.addEventListener("mousedown", playerEventHandler, false);
    glGlobals.canvas.addEventListener("mouseup",   playerEventHandler, false);
    glGlobals.canvas.addEventListener("mousemove", function(evt) {
        playerEventHandler(evt);

        if (player.selectionBox !== null) {
            selectionQuad = new zogl.zQuad(player.selectionQuad.w,
                                           player.selectionQuad.h);
            selectionQuad.setColor(new zogl.color4([1, 1, 1, 0.5]));
            selectionQuad.create();
            selectionQuad.move(player.selectionQuad.x, player.selectionQuad.y);
            
        } else {
            selectionQuad = new zogl.zQuad(1, 1);
            selectionQuad.create();
        }

    }, false);
    glGlobals.canvas.addEventListener("mouseout",  playerEventHandler, false);

    var selectionQuad = new zogl.zQuad();

    var game = function() {
        w.clear('#000000');

        player.update();
        enemy.update();

        scene.draw();

        for (var i in player.units) {
            player.units[i].drawHealthBar();

            for (var j = player.units[i].projectiles.length - 1;
                     j >= 0; --j) {
                player.units[i].projectiles[j].draw();

                for (var k in enemy.units) {
                    if (enemy.units[k].isAlive() &&
                        enemy.units[k].collides(player.units[i].projectiles[j].rect)) {
                        enemy.units[k].doDamage(player.units[i]);
                        player.units[i].projectiles.splice(j, 1);
                        break;
                    }
                }
            }
        }

        for (var i in enemy.units) {
            enemy.units[i].drawHealthBar();

            for (var j = enemy.units[i].projectiles.length - 1;
                     j >= 0; --j) {
                enemy.units[i].projectiles[j].draw();

                for (var k in player.units) {
                    if (player.units[k].isAlive() &&
                        player.units[k].collides(enemy.units[i].projectiles[j].rect)) {
                        player.units[k].doDamage(enemy.units[i]);
                        enemy.units[i].projectiles.splice(j, 1);
                        break;
                    }
                }
            }
        }

        if (player.selectionBox !== null) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            selectionQuad.draw();
            gl.disable(gl.BLEND);
        }

        /*for (var i in player.groups) {
            player.groups[i].astar.showPath();
        }*/

        requestAnimationFrame(game, glGlobals.canvas);
    };

    requestAnimationFrame(game, glGlobals.canvas);
}

window.onload = function() {
    zogl.debug = true;
    zogl.init(document.getElementById('webgl-canvas'));
    init();
};

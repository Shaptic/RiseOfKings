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

    var texture = new zogl.zTexture();
    texture.loadFromFile("tank.png");

    var scene = new zogl.zScene(0, 0, { "lighting": false });

    var units = [];
    var unitMgr = new rUnitManager();
    var q = new zogl.zQuad(TILE_SIZE, TILE_SIZE);
    q.attachTexture(texture);
    q.create();

    var playerColors = [];
    for (var i = 0; i < 2; ++i) {
        playerColors[i] = new zogl.zShader();
    }

    var tx = new zogl.zTexture();
    tx.loadFromFile("grass.png");

    var spriteQ = new zogl.zQuad(WINDOW_SIZE.w, WINDOW_SIZE.h);
    spriteQ.attachTexture(tx);
    mapSprite = scene.addObject();

    tx.setOnload(function() {
        spriteQ.attribs.repeat = true;
        spriteQ.create();
        mapSprite.addObject(spriteQ);
    });

    for (var i = 0; i < WINDOW_SIZE.w; i += TILE_SIZE) {
        map[i] = {};
        for (var j = 0; j < WINDOW_SIZE.h; j += TILE_SIZE) {
            map[i][j] = new vector(i, j);
        }
    }

    playerColors[0].loadFromString(zogl.SHADERS.defaultvs, [
        'precision mediump float;',

        'varying vec2 vs_texc;',
        'varying vec4 vs_color;',

        'uniform sampler2D texture;',

        'void main(void) {',
            'gl_FragColor = vec4(1.0, 0, 0, 1.0) + texture2D(texture, vs_texc);',
        '}'
    ].join('\n'));

    playerColors[1].loadFromString(zogl.SHADERS.defaultvs, [
        'precision mediump float;',

        'varying vec2 vs_texc;',
        'varying vec4 vs_color;',

        'uniform sampler2D texture;',

        'void main(void) {',
            'gl_FragColor = vec4(0.0, 0, 1.0, 1.0) + texture2D(texture, vs_texc);',
        '}'
    ].join('\n'));

    var UNIT_COUNT = 10;
    for (var i = 0; i < UNIT_COUNT; ++i) {
        var pos = getAlignedPos(new vector(TILE_SIZE * 2 * i, 100));

        units.push(scene.addObject(rUnit, [i > UNIT_COUNT / 2 ? "tank" : "archer"]));
        units[i].move(pos.x, pos.y);

        if (i >= UNIT_COUNT / 2) {
            units[i].addPass(playerColors[0]);
            units[i].color = "red";
        } else {
            units[i].addPass(playerColors[1]);
            units[i].color = "blue";
        }
    }

    var gameMap = new rMap();
    gameMap.tiles = map;
    gameMap.units = units;
    unitMgr.map = gameMap;

    var selecting = false;
    var selectionRect = {
        'start': new vector(0, 0),
        'end': new vector(0, 0)
    };

    glGlobals.canvas.addEventListener("mousedown", function(evt) {
        if (evt.button != 0) return;

        selected = [];
        selecting = true;
        selectionRect.start = zogl.getMousePosition(evt);
    }, false);

    var selected = [];

    glGlobals.canvas.addEventListener("mousemove", function(evt) {
        if (!selecting) return;

        selectionRect.end = zogl.getMousePosition(evt);

        var left  = Math.min(selectionRect.end.x, selectionRect.start.x);
        var top   = Math.min(selectionRect.end.y, selectionRect.start.y);
        var right = Math.max(selectionRect.end.x, selectionRect.start.x);
        var bottom= Math.max(selectionRect.end.y, selectionRect.start.y);

        var newsize = new zogl.rect(
            left, top,
            right - left,
            bottom - top
        );

        q = new zogl.zQuad(newsize.w, newsize.h);
        q.setColor(1.0, 1.0, 1.0, 0.5);
        q.create();
        q.move(newsize.x, newsize.y);

        selected = [];
        for (var i = 0; i < units.length; ++i) {
            if (units[i].collides(newsize)) {
                var h = new zogl.zQuad();
                h.resize(TILE_SIZE, 2);
                h.setColor("#00FF00");
                h.create();
                h.move(units[i].getX(), units[i].getY() - 3);
                selected.push({
                    "unit": units[i],
                    "bar": h
                });
            }
        }
    }, false);

    glGlobals.canvas.addEventListener("mouseup", function(evt) {
        var pos = zogl.getMousePosition(evt);

        selecting = false;
        q = new zogl.zQuad(1, 1);
        q.setColor(1.0, 1.0, 1.0, 0.0);
        q.create();

        if (evt.button == 2 && selected.length) {  // RMB
            positions = createGrid(selected, getAlignedPos(pos));

            order = {
                "position": pos,
                "type": "move"
            };

            var target = null;
            for (var j in units) {
                if (units[j].color == selected[0].unit.color) {
                    continue;
                } else if (units[j].collides(pos.x, pos.y)) {
                    target = units[j];
                    break;
                }
            }

            for (var i in selected) {
                var order = {
                    "position": target != null ?
                                { 'x': target.getX(), 'y': target.getY() } :
                                positions[i],
                    "type": target != null ? "attack" : "move"
                };

                if (target != null) {
                    order.target = target;
                }

                unitMgr.orderUnits(
                    selected[i].unit,
                    order.position,
                    order
                );
            }
        }
    }, false);

    glGlobals.canvas.addEventListener("mouseout", function(evt) {
        selecting = false;
        q = new zogl.zQuad(1, 1);
        q.setColor(1.0, 1.0, 1.0, 0.0);
        q.create();
    }, false);

    var game = function() {
        w.clear('#000000');

        for (var i in units) {
            units[i].update();
        }

        scene.draw();

        if (selecting) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            q.draw();
            gl.disable(gl.BLEND);
        }

        for (var i in selected) {
            if (selected[i].bar.size.w != Math.floor(TILE_SIZE * (selected[i].unit.health / 100.0)) &&
                selected[i].unit.health > 0) {
                selected[i].bar = new zogl.zQuad();
                selected[i].bar.resize(Math.floor(TILE_SIZE * (selected[i].unit.health / 100.0)), 2);
                selected[i].bar.setColor("#00FF00");
                selected[i].bar.create();
            }

            if (selected[i].unit.health > 0) {
                selected[i].bar.move(selected[i].unit.getX(),
                                     selected[i].unit.getY() - 3);
                selected[i].bar.draw();
            }
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

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

        x += 32;
        if (x >= w * 32) {
            x = 0;
            y += 32;
        }
    };

    return result;
}

function init() {
    var w = new zogl.zWindow(800, 600);
    w.init();

    var texture = new zogl.zTexture();
    texture.loadFromFile("tank.png");

    var scene = new zogl.zScene(0, 0, { "lighting": false });

    var units = [];
    var unitMgr = new rUnitManager();
    var q = new zogl.zQuad(32, 32);
    q.attachTexture(texture);
    q.create();

    var playerColors = [];
    for (var i = 0; i < 2; ++i) {
        playerColors[i] = new zogl.zShader();
    }

    var tx = new zogl.zTexture();
    tx.loadFromFile("grass.png");

    var spriteQ = new zogl.zQuad(800, 600);
    spriteQ.attachTexture(tx);
    spriteQ.create();

    mapSprite = scene.addObject();
    mapSprite.addObject(spriteQ);

    for (var i = 0; i < 800; i += 32) {
        map[i] = {};
        for (var j = 0; j < 600; j += 32) {
            map[i][j] = {
                'x': i,
                'y': j
            };
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
        var pos = getAlignedPos({
            'x': 32 * 2 * i,
            'y': 100
        });

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
        'start': {
            'x': 0,
            'y': 0
        },
        'end': {
            'x': 0,
            'y': 0
        }
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
                h.resize(32, 2);
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
            if (selected[i].bar.size.w != Math.floor(32 * (selected[i].unit.health / 100.0)) &&
                selected[i].unit.health > 0) {
                selected[i].bar = new zogl.zQuad();
                selected[i].bar.resize(Math.floor(32 * (selected[i].unit.health / 100.0)), 2);
                selected[i].bar.setColor("#00FF00");
                selected[i].bar.create();
            }

            if (selected[i].unit.health > 0) {
                selected[i].bar.move(selected[i].unit.getX(),
                                     selected[i].unit.getY() - 3);
                selected[i].bar.draw();
            }
        }

        for (var i in unitMgr.assignments) {
            //unitMgr.assignments[i].ai.showPath();
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

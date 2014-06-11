function getAlignedPos(pos) {
    off = {
        x: pos.x % 32,
        y: pos.y % 32
    };

    return {
        'x': pos.x + (off.x < 32 ? -off.x : off.x),
        'y': pos.y + (off.y < 32 ? -off.y : off.y)
    };
}

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

    log(result);

    return result;
}

function init() {
    var w = new zogl.zWindow(800, 600);
    w.init();

    var texture = new zogl.zTexture();
    texture.loadFromFile("tank.png");

    var scene = new zogl.zScene(0, 0, { "lighting": false });

    var units = []
    var q = new zogl.zQuad(32, 32);
    q.attachTexture(texture);
    q.create();

    for (var i = 0; i < 10; ++i) {
        units.push(scene.addObject(rUnit, ["tank"]));
        units[i].move(32*2*i, 100);
    }

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
        selecting = false;
        q = new zogl.zQuad(1, 1);
        q.setColor(1.0, 1.0, 1.0, 0.0);
        q.create();

        if (evt.button == 2) {  // RMB
            positions = createGrid(selected, getAlignedPos(zogl.getMousePosition(evt)));
            for (var i in selected) {
                selected[i].unit.setOrder({
                    "type": "move",
                    "position": positions[i]
                });
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
            selected[i].bar.move(selected[i].unit.getX(),
                                 selected[i].unit.getY() - 3);
            selected[i].bar.draw();
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

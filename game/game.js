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
        units.push(scene.addObject());
        units[i].addObject(q);
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
    var orders = [];

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

            // remove units from existing orders
            for (var i in orders) {
                for (var j in selected) {
                    var unit = selected[j].unit;

                    var len = orders[i].units.length;
                    for (var k = len - 1; k >= 0; --k) {
                        if (orders[i].units[k] == unit) {
                            orders[i].units.slice(k, 1);
                        } 
                    }
                }
            }

            orders.push({
                "selection": selected,
                "position": getAlignedPos(zogl.getMousePosition(evt))
            });
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
        scene.draw();

        var len = orders.length - 1;
        for (var j = len; j >= 0; --j) {
            var order = orders[j];
            var done = true;

            for (var i in order.selection) {
                var un  = order.selection[i].unit;
                var sel = order.selection[i].bar;
                un.adjust(
                    un.getX() < order.position.x ? +2 : -2,
                    un.getY() < order.position.y ? +2 : -2
                );
                sel.move(un.getX(), un.getY() - 3);

                if (!un.collides(new zogl.rect(order.position.x,
                                               order.position.y, 10, 10))) {
                    done = false;
                }   
            }

            if (done) orders.splice(j, 1);
        }

        if (selecting) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            q.draw();
            gl.disable(gl.BLEND);
        }

        for (var i in selected) {
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

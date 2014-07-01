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
 * [*] Minimum attack range.
 * [ ] Frame-rate independent move speed.
 * [*] Single unit selection w/o dragging.
 * [-] Get into formation after attacking based on the current position.
 * [*] Fix non-standard selection.
 * [*] Make double-click on unit select all in range.
 * [ ] Implement the quad-tree into the map.
 * [ ] Make fleeing take account map boundaries.
 */

var sock = null;

var GameState = {
    WAITING_FOR_PEERS: 1,
    WAITING_FOR_ARMY: 2,
    READY: 3,
    PLAYING: 4
};

function Game() {
    var that = this;

    this.state = GameState.WAITING_FOR_PEERS;
    this.socket = new rConnection({
        "units": [{
            "type": "archer"
        }]
    });

    this.window = new zogl.zWindow(WINDOW_SIZE.w, WINDOW_SIZE.h);
    this.window.init();

    this.gameScene = new zogl.zScene();
    this.map = new rMap(this.gameScene);
    this.player = new rPlayer();
    this.otherPlayers = [];

    this.armyComposition = [];

    this.execTick = 0;

    this.intervalHandle = setInterval(function() {
        that.gameLoop();
    }, 500);

    var sockHandle = setInterval(function() {
        that.socket.update();
    }, 1000);
    this.socket.intervalHandle = sockHandle;

    sock = this.socket;
}

Game.prototype.gameLoop = function() {
    console.log("in loop", this.state);

    switch(this.state) {

    case GameState.WAITING_FOR_PEERS:
        if (this.socket.peers.length > 1 ||
            this.socket.host !== null) {
            this.state = GameState.WAITING_FOR_ARMY;
        }
        break;

    case GameState.WAITING_FOR_ARMY:
        console.log("Composition isn't ready.");
        if (this.socket.armyComposition.length === this.socket.peers.length) {
            console.log("Composition is ready.");
            this.armyComposition = this.socket.armyComposition;
            this.state = GameState.READY;
        }
        break;

    case GameState.READY:
        this.state = GameState.PLAYING;
        clearInterval(this.intervalHandle);
        requestAnimationFrame(this.gameLoop, glGlobals.canvas);
        this.gameLoop();
        break;

    case GameState.PLAYING:
        console.log("playing game");

        this.state = GameState.PLAYING;
        this.window.clear('#000000');
        this.gameScene.draw();
        requestAnimationFrame(this.gameLoop, glGlobals.canvas);

        break;
    }
};

function refreshLobby() {
    var e = document.getElementById("hosts");
    AJAX("GET", RTS_CONFIG.AUTH_SERVER+ "/getpeers/", function(ajax) {
        if (ajax.readyState == 4 && ajax.status == 200) {
            var text = JSON.parse(ajax.responseText);

            console.log(text);

            e.innerHTML = '<ul>';
            for (var i in text.peers) {
                if (text.peers[i].id === sock.peerid) continue;

                e.innerHTML += '<li>' + '<a href="#" onclick="sock.connectTo(\'' +
                                text.peers[i].id + '\', \'' + sock.color + '\')">' +
                                text.peers[i].name + '</a>' + '</li>';
            }
            e.innerHTML += '</ul>';
        }
    });
}

function initializeGame(army, socket) {
    var w = new zogl.zWindow(WINDOW_SIZE.w, WINDOW_SIZE.h);
    w.init();

    var scene   = new zogl.zScene();
    var gameMap = new rMap(scene);
    var player  = new rPlayer(gameMap, sock.color, sock);
    var enemies = new Array(sock.peers.length - 1);
    var execTick= sock.sendTick - 3;

    var units = new Array(army_composition.length);
    for (var i in army_composition[sock.color]) {
        var u = new rUnit(scene, army_composition[i].type);
        units.push(u);
    }
    player.setUnits(units);

    sock.setOnUpdate(function(commands) {
        for (var color in commands) {
            var cmds = commands[color];
            for (var i in cmds.orders) {
                var order = cmds.orders[i];

                if (order.type === "create") {
                    if (color === enemy.color) {
                        enemyUnits.push(new rUnit(scene, order.unitType));
                    }
                }
            }
        }

        enemy.setUnits(enemyUnits);
    });

    gameMap.create();

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

    var gameLoop = function() {
        execTick = sock.sendTick - 3;

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

        requestAnimationFrame(gameLoop, glGlobals.canvas);
    };

    requestAnimationFrame(gameLoop, glGlobals.canvas);
}

window.onload = function() {
    zogl.debug = true;
    zogl.init(document.getElementById('webgl-canvas'));
    var g = new Game();
};

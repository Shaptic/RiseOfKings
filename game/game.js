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
    zogl.debug = false;

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
    this.player = new rPlayer(this.map, null, this.socket);
    this.otherPlayers = [];

    this.armyComposition = [];

    this.execDelay = {
        "count": 0,
        "on": false
    };

    this.setStatus("waiting for connections...");

    this.intervalHandle = setInterval(function() {
        that.gameLoop();
    }, 500);

    requestAnimationFrame(function() {
        that.render();
    }, glGlobals.canvas);

    var sockHandle = setInterval(function() {
        that.socket.update();
    }, 1000);
    this.socket.intervalHandle = sockHandle;

    sock = this.socket;
}

Game.prototype.gameLoop = function() {
    var that = this;
    switch(this.state) {

    case GameState.WAITING_FOR_PEERS:
        if (this.socket.peers.length > 1 ||
            this.socket.host !== null    ||
            this.socket.attribs.host     ||
            this.socket.attribs.singleplayer) {
            this.setStatus("synchronizing...");
            this.state = GameState.WAITING_FOR_ARMY;
        }
        break;

    case GameState.WAITING_FOR_ARMY:
        this.player.setColor(this.socket.color);

        if ((this.socket.armyComposition.length > 1 &&
             this.socket.armyComposition.length === this.socket.peers.length + 1) ||
            this.socket.attribs.singleplayer) {
            this.armyComposition = this.socket.armyComposition;
            this.setStatus("loading game...");
            this.state = GameState.READY;
        }
        break;

    case GameState.READY:
        var that = this;

        this.setStatus("loading game... map");
        this.map.create();
        this.setStatus("loading game... armies");

        var c = this.socket.color;
        for (var i in this.armyComposition) {
            var list = this.armyComposition[i].units;
            var units = [];

            for (var j in list) {

                var u = this.gameScene.addObject(
                    rUnit, [this.gameScene, list[j].type]
                );
                u.move(list[j].position.x, list[j].position.y);

                units.push(u);
            }

            if (this.armyComposition[i].color === c) {
                this.player.setUnits(units);
            } else {
                var p = new rPlayer(this.map, this.armyComposition[i].color);
                p.setUnits(units);
                this.otherPlayers.push(p);
            }
        }

        this.selectionQuad = new zogl.zQuad();
        this.setupEventHandlers();

        this.state = GameState.PLAYING;

        clearInterval(this.intervalHandle);
        this.intervalHandle = setInterval(function() {
            that.update();
        }, 1000 / 60);

        requestAnimationFrame(function() {
            that.render();
        }, glGlobals.canvas);
        break;
    }
};

Game.prototype.update = function() {
    var playerCmds = this.socket.getMessages(this.socket.sendTick);
    for (var i in playerCmds) {
        var msgs = playerCmds[i];
        if (msgs.length === 0) {
            return;
        }

        // Only simulate once we've received "done" commands for all players.
        has_done = false;
        for (var j in msgs) {
            if (msgs[j].misc === "complete") {
                has_done = true;
                break;
            }
        }

        if (!has_done) {
            console.log("no acks for all clients");
            return;
        }

        else if (!this.execDelay.on) {
            this.execDelay = {
                "count": this.socket.roundtrip / 2,
                "on": true
            };
        }

        else {
            this.execDelay.count--;
        }

        if (this.execDelay.count <= 0) {
            this.execDelay.count = 0;
            this.execDelay.on = false;
        } else {
            return;
        }

        // Figure out which player this set of commands is relevant to.
        var p = this.player;
        if (this.player.color !== msgs[0].color) {
            for (var j in this.otherPlayers) {
                if (this.otherPlayers[j].color !== msgs[0].color) {
                    continue;
                }

                p = this.otherPlayers[j];
                break;
            }
        }

        for (var j = msgs.length - 1; j >= 0; --j) {
            var msg = msgs[j];
            if (msg.misc === "complete") continue;

            console.log("Processing", msg);

            var units = [];
            for (var j in msg.units) {
                for (var k in p.units) {
                    if (p.units[k].id === msg.units[j]) {
                        units.push(p.units[k]);
                    }
                }
            }

            console.log("Giving order to", p.color, msg.orders);

            var group = new rSquad(this.map);
            group.assignUnits(units);
            group.giveOrders(msg.orders);
            p.groups.push(group);

            msgs.splice(j, 1);
        }
    }

    // Delete all but the last 10 turns.
    for (var tick in this.socket.recvQueue.queue) {
        if (tick <= this.socket.sendQueue - 10) {
            delete this.socket.recvQueue.queue[tick];
        }
    }
}

Game.prototype.render = function() {
    var that = this;

    requestAnimationFrame(function() {
        that.render();
    }, glGlobals.canvas);

    this.window.clear('#000000');

    switch(this.state) {

    case GameState.WAITING_FOR_PEERS:
        this.statusText.draw();
        break;

    case GameState.WAITING_FOR_ARMY:
        this.statusText.draw();
        break;

    case GameState.PLAYING:
        if (this.socket.roundtrip !== undefined) {
            this.setStatus(
                'Ping: ' +
                this.socket.roundtrip.toFixed(2) +
                'ms'
            );
        }

        this.player.update();
        for (var i in this.otherPlayers) {
            this.otherPlayers[i].update();
        }

        this.gameScene.draw();

        for (var i in this.player.selection) {
            this.player.selection[i].drawHealthBar();
        }

        if (this.player.selectionBox !== null) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            this.selectionQuad.draw();
            gl.disable(gl.BLEND);
        }

        this.statusText.draw();

        break;
    }
}

Game.prototype.setupEventHandlers = function() {
    var that = this;

    var playerEventHandler = function(evt) {
        that.player.handleEvent(evt);
    }

    glGlobals.canvas.addEventListener("mousedown", playerEventHandler, false);
    glGlobals.canvas.addEventListener("mouseup",   playerEventHandler, false);
    glGlobals.canvas.addEventListener("mousemove", function(evt) {
        playerEventHandler(evt);

        if (that.player.selectionBox !== null) {
            that.selectionQuad = new zogl.zQuad(that.player.selectionQuad.w,
                                                that.player.selectionQuad.h);
            that.selectionQuad.setColor(new zogl.color4([1, 1, 1, 0.5]));
            that.selectionQuad.create();
            that.selectionQuad.move(that.player.selectionQuad.x,
                                    that.player.selectionQuad.y);

        } else {
            that.selectionQuad = new zogl.zQuad(1, 1);
            that.selectionQuad.create();
        }

    }, false);
    glGlobals.canvas.addEventListener("mouseout",  playerEventHandler, false);
};

Game.prototype.setStatus = function(message) {
    if (this.statusText === undefined) {
        this.statusFont = new zogl.zFont();
        this.statusFont.loadFromFile('monospace', 10);
        this.statusFont.color = 'white';

        this.statusText = new zogl.zSprite();
        this.statusText.flags.blend = true;

    } else {
        this.statusText.prims = [];
    }

    this.statusFont.drawOnSprite(message, this.statusText);
    this.statusText.move(
        glGlobals.canvas.width  - this.statusText.rect.w,
        glGlobals.canvas.height - this.statusText.rect.h
    );
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
        socket.sendTick = sock.sendTick - 3;

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

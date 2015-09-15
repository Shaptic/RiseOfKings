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
    WAITING_FOR_SYNC: 2,
    READY: 3,
    PLAYING: 4
};

function Game(p2p) {
    zogl.debug = false;

    var that = this;

    this.state = GameState.WAITING_FOR_PEERS;
    this.socket = p2p;

    this.window = new zogl.zWindow(WINDOW_SIZE.w, WINDOW_SIZE.h);
    this.window.init();

    this.gameScene = new zogl.zScene();
    this.map = new rMap(this.gameScene);
    this.player = new rPlayer(this.map, null, this.socket);
    this.otherPlayers = [];
    this.armyComposition = [];

    this.setStatus("waiting for connections...");

    this.intervalHandle = setInterval(function() {
        that.gameLoop();
    }, 500);

    requestAnimationFrame(function() {
        that.render();
    }, glGlobals.canvas);

    sock = this.socket;

    this.timer = {
        "start": window.performance.now(),
        "time": 0,
        "interval": 1000.0 / 60
    };

    this.accurateInterval = function(callback) {
        that.timer.time += that.timer.interval;

        callback();

        var diff = (window.performance.now() - that.timer.start) - that.timer.time;
        setTimeout(function() {
            that.accurateInterval(callback);
        }, that.timer.interval - diff);
    }
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
            this.state = GameState.WAITING_FOR_SYNC;
        }
        break;

    case GameState.WAITING_FOR_SYNC:
        this.player.setColor(this.socket.color);

        // Send him our army composition data.
        if (!this.socket.attribs.host) {
            setTimeout(function() {
                that.socket.sendMessage({
                    "color": that.socket.color,
                    "type": MessageType.ARMY_COMPOSITION,
                    "misc": "army_comp",
                    "turn": that.socket.sendTick,
                    "misc": that.socket.initialArmyComp
                }, that.host)
            }, 500);
        }

        var count = 0;
        for (var color in this.socket.armyComposition) {
            if (this.socket.armyComposition[color].length > 0) {
                count++;
            } else {
                console.log("No composition for", color, "yet.");
            }
        }

        if ((count > 1 && count === this.socket.peers.length + 1) ||
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
            var list = this.armyComposition[i];
            var units = [];

            for (var j in list) {

                var u = this.gameScene.addObject(
                    rUnit, [this.gameScene, list[j].type]
                );
                u.move(list[j].position.x, list[j].position.y);

                units.push(u);
            }

            if (i === c) {
                this.player.setUnits(units);
            } else {
                var p = new rPlayer(this.map, i, this.socket);
                p.setUnits(units);
                this.otherPlayers.push(p);
            }
        }

        this.selectionQuad = new zogl.zQuad();
        this.setupEventHandlers();

        this.state = GameState.PLAYING;

        clearInterval(this.intervalHandle);

        that.accurateInterval(function() {
            that.gameLoop();
        });

        requestAnimationFrame(function() {
            that.render();
        }, glGlobals.canvas);

        this.socket.onTick = function(tick) {
            var playerCmds = that.socket.getMessages(tick);
            for (var i in playerCmds) {
                var msgs = playerCmds[i];
                if (msgs.length === 0 || (
                        msgs.length === 1 &&
                        msgs[0].type === MessageType.DONE
                    )) {
                    continue;
                }

                // Figure out which player this set of commands is relevant to.
                var p = that.player;
                if (that.player.color !== msgs[0].color) {
                    for (var j in that.otherPlayers) {
                        if (that.otherPlayers[j].color !== msgs[0].color) {
                            continue;
                        }

                        p = that.otherPlayers[j];
                        break;
                    }
                }

                for (var j in msgs) {
                    var msg = msgs[j];
                    if (msg.type === MessageType.DONE) continue;

                    if (msg.type === MessageType.PING &&
                        !that.socket.attribs.host) {
                        that.socket.iterDelay = msg.misc;
                    }

                    console.log("Processing", msg);

                    var select = !(p === that.player);
                    p.handleSocketEvent(msg.misc, select);
                }

                that.socket.recvQueue.queue[tick][i] = []
            }

            // Delete all but the last 10 turns.
            for (var tick in that.socket.recvQueue.queue) {
                if (tick <= that.socket.sendTick - 10) {
                    delete that.socket.recvQueue.queue[tick];
                }
            }
        };

        break;

    case GameState.PLAYING:
        if (this.socket.skippedTurn > 0) break;

        this.update();
        break;
    }
};

Game.prototype.update = function() {
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

    allPlayers = this.otherPlayers.slice(0);
    allPlayers.push(this.player);

    for (var i in allPlayers) {
        for (var j in allPlayers[i].units) {

            var attacker = allPlayers[i].units[j];

            for (var k = allPlayers[i].units[j].projectiles.length - 1;
                     k >= 0; --k) {

                for (var a in allPlayers) {
                    if (allPlayers[a] === allPlayers[i]) continue;

                    for (var b in allPlayers[a].units) {
                        if (allPlayers[a].units[b].isAlive() &&
                            allPlayers[a].units[b].collides(
                                attacker.projectiles[j].rect
                            )) {
                            allPlayers[a].units[b].doDamage(attacker);
                            attacker.projectiles.splice(k, 1);
                            break;
                        }
                    }
                }
            }
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
        this.gameScene.draw();

        allPlayers = this.otherPlayers.slice(0);
        allPlayers.push(this.player);
        for (var i in allPlayers) {
            for (var j in allPlayers[i].units) {
                for (var k = allPlayers[i].units[j].projectiles.length - 1;
                         k >= 0; --k) {
                    allPlayers[i].units[j].projectiles[k].draw();
                }
            }
        }

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
    AJAX("GET", RTS_CONFIG.AUTH_SERVER+ "/peers/", function(ajax) {
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

function newGame(p2p) {
    zogl.debug = true;
    zogl.init(document.getElementById('webgl-canvas'));

    var g = new Game(p2p);
};

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

function Game() {
    //zogl.debug = false;

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

    this.setStatus("waiting for connections...");

    this.intervalHandle = setInterval(function() {
        that.gameLoop();
    }, 500);

    requestAnimationFrame(function() {
        that.render();
    }, glGlobals.canvas);

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
                    "misc": that.socket.armyComposition[that.socket.color] || {}
                }, that.host)
            }, 500);
        }

        var count = 0;
        for (var color in this.socket.armyComposition) {
            count++;
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
            if (msgs[j].type === MessageType.DONE) {
                has_done = true;
                break;
            }
        }

        if (!has_done) {
            console.log("no acks for all clients");
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

        for (var j in msgs) {
            var msg = msgs[j];
            if (msg.type === MessageType.DONE) continue;

            console.log("Processing", msg);
        }

        this.socket.recvQueue.queue[this.socket.sendTick][i] = []
    }

    // Delete all but the last 10 turns.
    for (var tick in this.socket.recvQueue.queue) {
        if (tick <= this.socket.sendTick - 10) {
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

window.onload = function() {
    zogl.debug = true;
    zogl.init(document.getElementById('webgl-canvas'));
    var g = new Game();
};

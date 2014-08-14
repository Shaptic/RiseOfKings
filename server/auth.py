'''
Matchmaking back-end.

Peers interact with the server in the following ways:
    - Querying existing matches                     GET  /match/
    - Creating a match                              POST /match/
    - Joining a match                               POST /join/
    - Starting a game from a multi-person match     POST /start/
    - Ping status while in a match                  POST /ping/

All peers in a match must periodically ping the server in order to validate
that they are still online and in the match.
'''

import time
from flask      import Flask, jsonify, make_response, request
from flask_cors import cross_origin

app = Flask(__name__)
gamePeers = []
matches = []

# Colors that can be chosen by peers in a match.
AVAILABLE_COLORS = {
    'blue':     True,
    'red':      True,
    'green':    True,
    'yellow':   True
}

# Timeout in seconds.
TIMEOUT_THRESHOLD = 15

class Peer:
    def __init__(self, id_, nick, units=None):
        self.id = id_
        self.nick = nick
        self.last_ping = time.time()
        self.color = ''
        self.units = units or {}

    def asJSON(self):
        return {
            'id':       self.id,
            'nick':     self.nick,
            'color':    self.color,
            'units':    self.units
        }

class Match:
    def __init__(self, name, host, pcount, maxUnits):
        self.lobbyName = name
        self.host = host
        self.peers = []
        self.playerCount = pcount or 1
        self.maxUnits = maxUnits or 5
        self.colors = dict(AVAILABLE_COLORS)
        self.addPeer(host)

    def addPeer(self, peer):
        # Assign a color to the peer.
        peer.color = [k for k, v in self.colors.iteritems() if v]
        if not peer.color: return False
        else: peer.color = peer.color[0]

        global gamePeers
        gamePeers.append(peer)
        self.peers.append(peer)

    def asJSON(self):
        return {
            'name': self.lobbyName,
            'playerCount': self.playerCount,
            'maxUnits': self.maxUnits,
            'host': self.host.asJSON(),
            'players': [x.asJSON() for x in self.peers]
        }

@app.route('/match/', methods=[ 'GET', 'POST' ])
@cross_origin()
def match():
    global matches

    validateMatches()

    # A GET request indicates that someone wants a list of existing matches.
    if request.method == 'GET':
        return make_response(
            jsonify({
                'matches': [
                    x.asJSON() for x in matches
                ]
            }),
            200
        )

    # A POST request is someone creating a new match.
    elif request.method == 'POST':
        peerObj = Peer(request.form['id'],
                       request.form['nick'], {
            'knights':  request.form['knights'],
            'spears':   request.form['spears'],
            'archers':  request.form['archers']
        })
        match = Match(request.form['name'], peerObj,
                      request.form['pcount'],
                      request.form['maxunit'])
        matches.append(match)

        return make_response(jsonify({
            'status':   'initialized',
            'data':     match.asJSON()
        }), 200)

@app.route('/ping/', methods=[ 'POST' ])
@cross_origin()
def ping():
    t = time.time()
    global gamePeers

    for p in gamePeers:
        if p.id == request.form['id']:
            p.last_ping = t
            break
    else:
        return make_response('No such peer.', 404)

    validateMatches()
    return 'Ping successful.'

def validateMatches():
    global matches
    global gamePeers

    t = time.time()

    # Find all peers that haven't pinged us back recently and remove them
    # from their respective matches.
    for m in matches:
        m.peers = [p for p in m.peers if t - p.last_ping < TIMEOUT_THRESHOLD]
    gamePeers = [p for p in gamePeers if t - p.last_ping < TIMEOUT_THRESHOLD]

    # Removes all matches with no host.
    matches = [m for m in matches if m.host in m.peers]

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)


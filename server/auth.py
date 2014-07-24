import time
from flask      import Flask, jsonify, make_response, request
from flask_cors import cross_origin

app = Flask(__name__)
gamePeers = []

AVAILABLE_COLORS = {
    'blue':     True,
    'red':      True,
    'green':    True,
    'yellow':   True
}

class Peer:
    def __init__(self, id_):
        self.id = id_
        self.name = "Peer " + str(id_)
        self.last_ping = time.time()
        self.commands = []
        self.color = ''

    def asJSON(self):
        return {
            'id':       self.id,
            'color':    self.color,
            'name':     self.name
        }

@app.route('/register/<peer_id>')
@cross_origin()
def register_peer(peer_id):
    global gamePeers

    if [p for p in gamePeers if p.id == peer_id]:
        return make_response('Already registered.', 402)

    p = Peer(peer_id)
    gamePeers.append(p)

    col = None
    for k, v in AVAILABLE_COLORS.iteritems():
        if AVAILABLE_COLORS[k]:
            col = k
            AVAILABLE_COLORS[k] = False
            break
    else:
        return make_response('nope', 404)

    if not col.strip():
        raise Exception("Fuck this bullshit")

    print "Giving", col, "to", peer_id
    p.color = col

    return make_response(jsonify({'color': col}), 200)

@app.route('/peers/', methods=[ 'GET' ])
@cross_origin()
def peers():
    # Find all peers that haven't pinged us back.
    global gamePeers
    t = time.time()
    for gp in gamePeers:
        if t - gp.last_ping >= 5 and gp.color:
            AVAILABLE_COLORS[gp.color] = True

    gamePeers = [p for p in gamePeers if time.time() - p.last_ping < 5]

    # JSON response of peers
    return make_response((
        jsonify({
            'peers': [
                x.asJSON() for x in gamePeers
            ]
        }),
        200
    ))

@app.route('/ping/<peer_id>', methods=[ 'GET' ])
@cross_origin()
def ping(peer_id):
    peer = [x for x in gamePeers if x.id == peer_id]
    if not peer:
        return register_peer(peer_id)
    peer[0].last_ping = time.time()

    return make_response('Ping successful.', 200)

@app.route('/connect/<from_id>/<to_id>', methods=[ 'GET' ])
@cross_origin()
def connect(from_id, to_id):
    from_peer = [x for x in gamePeers if x.id == from_id]
    to_peer   = [x for x in gamePeers if x.id == to_id]

    if not from_peer or not to_peer:
        return make_response('Bad ID.', 404, {
            'Access-Control-Allow-Origin': '*'
        })

    to_peer[0].commands.append({
        'type': 'connect',
        'from': from_peer[0].id
    })

    return make_response('Ready.', 200)

@app.route('/commands/<peer_id>', methods=[ 'GET', 'DELETE' ])
@cross_origin(methods=[ 'GET', 'DELETE' ])
def commands(peer_id):
    peer = [x for x in gamePeers if x.id == peer_id]
    if not peer:
        return make_response('Bad ID.', 404)
    peer = peer[0]

    if request.method == 'DELETE' and peer.commands:
        peer.commands.pop(0)

    return make_response(jsonify({'commands': peer.commands}), 200)

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)

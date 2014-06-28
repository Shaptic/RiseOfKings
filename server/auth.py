import time
from flask import Flask, request, jsonify, make_response

app = Flask(__name__)
gamePeers = []

class Peer:
    def __init__(self, id_):
        self.id = id_
        self.name = "Peer " + str(id_)
        self.last_ping = time.time()
        self.commands = []

    def asJSON(self):
        return {
            'id': self.id,
            'name': self.name
        }

@app.route('/register/<peer_id>')
def register_peer(peer_id):
    global gamePeers

    if [p for p in gamePeers if p.id == peer_id]:
        return make_response('Already registered.', 402)

    p = Peer(peer_id)
    gamePeers.append(p)

    return make_response('Peer registered.', 200, {
        'Access-Control-Allow-Origin': '*'
    })

@app.route('/getpeers/', methods=[ 'GET' ])
def peers():
    # Find all peers that haven't pinged us back.
    global gamePeers
    gamePeers = [p for p in gamePeers if time.time() - p.last_ping < 5]

    # JSON response of peers
    return make_response((
        jsonify({
            'peers': [
                x.asJSON() for x in gamePeers
            ]
        }),
        200, {
            'Access-Control-Allow-Origin': '*'
        }
    ))

@app.route('/ping/<peer_id>', methods=[ 'GET' ])
def ping(peer_id):
    peer = [x for x in gamePeers if x.id == peer_id]
    if not peer:
        return register_peer(peer_id)
    peer[0].last_ping = time.time()

    return make_response('Ping successful.', 200,  {
        'Access-Control-Allow-Origin': '*'
    })

@app.route('/connect/<from_id>/<to_id>', methods=[ 'GET' ])
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

    return make_response('Ready.', 200,  {
        'Access-Control-Allow-Origin': '*'
    })

@app.route('/commands/<peer_id>', methods=[ 'GET', 'DELETE' ])
def commands(peer_id):
    peer = [x for x in gamePeers if x.id == peer_id]
    if not peer:
        return make_response('Bad ID.', 404, {
            'Access-Control-Allow-Origin': '*'
        })
    peer = peer[0]

    if request.method == 'DELETE' and peer.commands:
        peer.commands.pop(0)

    return make_response(jsonify({'commands': peer.commands}), 200, {
        'Access-Control-Allow-Origin': '*'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)

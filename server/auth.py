import time
from flask import Flask, request, jsonify, make_response

app = Flask(__name__)
gamePeers = []

class Peer:
    def __init__(self, id_):
        self.id = id_
        self.name = "Peer " + str(id_)
        self.last_ping = time.time()

    def asJSON(self):
        return {
            'id': self.name,
            'name': self.name
        }

@app.route('/register/<peer_id>')
def register_peer(peer_id):
    global gamePeers

    if [p for p in gamePeers if p.id == peer_id]:
        return make_response('Already registered.', 402)

    p = Peer(peer_id)
    gamePeers.append(p)

    return make_response('Peer registered.', 200)

@app.route('/getpeers/', methods=[ 'GET' ])
def peers():
    # Find all peers that haven't pinged us back.
    print [{'name': p.name, 'delta': time.time() - p.last_ping} for p in gamePeers]

    global gamePeers
    gamePeers = [p for p in gamePeers if time.time() - p.last_ping < 5]

    print [{'name': p.name, 'delta': time.time() - p.last_ping} for p in gamePeers]

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

    return make_response('Ping successful.', 200)

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)

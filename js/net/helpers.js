net.helpers = net.helpers || {};

/*
 * Presents a simple interface for performing AJAX calls to the auth server.
 *  The `onReady` callback should accept a single parameter, namely the response
 *  object. On the other hand, the `onFail` callback should take 2 parameters;
 *  the first is the response object, and the second is the HTTP status code.
 *
 * @param   method  POST, GET, etc.
 * @param   URL     The URL to send the request to
 * @param   options An object containing a variety of possible options:
 *                  onReady     -- Callback executed when a 200 reply is given
 *                  onFail      -- Callback executed when a non-200 reply is given
 *                  onTimeout   -- Callback executed when time (in ms) elapses w/o a response
 *                  timeout     -- In union with onTimeout to specify time in ms to wait
 *                  data        -- Data to send to the server on a POST request
 */
net.helpers.ajax = function(method, URL, options) {
    var onReady = options.onReady || function() {};
    var onFail  = options.onFail  || function() {};

    var http = new XMLHttpRequest();

    http.onreadystatechange = function() {
        if (http.readyState === 4) {
            if (http.status === 200) {
                onReady(http.responseText);
            } else {
                onFail(http.responseText, http.status);
            }
        }
    };

    if (method === "GET" && options.data) {
        URL += '?' + (options.data || '');
    }

    http.open(method, URL, true);

    if (options.timeout) {
        http.timeout = options.timeout;
        if (options.onTimeout) {
            http.ontimeout = options.onTimeout;
        }
    }

    if (method === "POST") {
        http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    }

    if (zogl.debug) {
        console.log(method, "sending", options.data, "to", URL);
    }

    http.send(options.data);
}

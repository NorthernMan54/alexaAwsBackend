var request = require('request');
var oAuthId;
var timeStamp;

// Need to create environment variable with lightsail endpoint address

var endpoint = process.env.ENDPOINT;

// Region identifier
var region = process.env.AWS_REGION;

// If debug variable exists, enable debug loggin

var debug = process.env.DEBUG;

exports.handler = function(event, context, callback) {
  timeStamp = new Date().getTime();
  log("Entry: " + event.directive.header.namespace, event);

  if (event.directive.header.namespace === 'Alexa' && event.directive.header.payloadVersion === '3') {
    // log("Troubleshoot", event.directive.endpoint, event.directive.header);
    oAuthId = event.directive.endpoint.scope.token;
    delete event.directive.endpoint.scope; // Remove oauth token from message body
    sendMessage(event, context, callback);
  } else if (event.directive.header.payloadVersion === '3') {
    if (event.directive.endpoint !== undefined) {
      oAuthId = event.directive.endpoint.scope.token;
      delete event.directive.endpoint.scope;
    } else if (event.directive.payload !== undefined) {
      oAuthId = event.directive.payload.scope.token;
      delete event.directive.payload.scope; // Remove oauth token from message body
    }
    sendMessage(event, context, callback);
  } else {
    log("Unexpected playloadversion", event.directive.header.payloadVersion);
    callback(new Error("Unexpected playloadversion"), null);
  }
};

function sendMessage(event, context, callback) {
  // Pass Alexa Directive to message router

  var messageId = createMessageId();
  request.post(endpoint + '/api/v2/messages', {
    auth: {
      'bearer': oAuthId
    },
    timeout: 8000,
    rejectUnauthorized: false,
    headers: {
      'Content-Type': 'application/json',
      'messageId': messageId,
      'User-Agent': region
    },
    body: JSON.stringify(event)

  }, function(err, response, body) {
    if (err) {
      // Logging handled by error handler
      callback(err, null);
    } else if (response.statusCode === 200) {
      var reply = JSON.parse(body);
      log("Response: " + reply.event.header.namespace, reply);
      // log('Alexa Directive', "success");
      callback(null, reply);
    } else if (response.statusCode === 401) {
      log("Response: Error - Auth failure", body);
      // log('Alexa Directive', "Auth failure");

      response = {
        header: {
          messageId: messageId,
          name: "ErrorResponse",
          namespace: "Alexa",
          payloadVersion: "3"
        },
        payload: {
          discoveredAppliances: []
        }
      };

      // context.succeed(response);
      callback(null, response);
    } else {
      log("Response: Error " + response.statusCode, body);
      // log('Unknown Response', response.statusCode);

      response = {
        header: {
          messageId: messageId,
          name: "ErrorResponse",
          namespace: "Alexa",
          payloadVersion: "3"
        },
        payload: {
          discoveredAppliances: []
        }
      };

      // context.succeed(response);
      callback(null, response);
    }
  }).on('error', function(error) {
    log('Internal Error:', error);

    callback(error, null);
  });
}

function createMessageId() {
  var d = new Date().getTime();

  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
    function(c) {
      var r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

  return uuid;
}

function log(title, msg) {
  var currentTime = new Date().getTime();
  console.log(title + ', ' + (currentTime - timeStamp) + ' ms' + ', ' + msg.toString());
  if (msg instanceof Object && debug) {
    console.log(msg);
  }
  timeStamp = currentTime;
}

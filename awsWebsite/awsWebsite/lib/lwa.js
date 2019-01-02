var request = require('request');
var Account = require('../models/account');

module.exports = {
  validate: validate
};

function validate(req, callback) {
  console.log(req.body.directive.payload);

  var message = req.body;
  var body = "grant_type=authorization_code&code=" + message.directive.payload.grant.code + "&client_id=amzn1.application-oa2-client.8ff7ed85e0e1434f840a4f466ad34f7b&client_secret=60441f26e76a10e3d8a64945b7bd1284b24cd51d5b110b8a0c1be88ce72df7e0";
  var reply;

  request({
    method: 'POST',
    url: 'https://api.amazon.com/auth/o2/token',
    timeout: 7000,
    maxAttempts: 1, // (default) try 5 times
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: body
  }, function(err, response) {
    if (!err && response.statusCode === 200) {
      console.log(err, response.body, response.statusCode);
      updateToken(req.user.username, response.body);
      reply = {
        "event": {
          "header": {
            "messageId": message.directive.header.messageId,
            "namespace": "Alexa.Authorization",
            "name": "AcceptGrant.Response",
            "payloadVersion": "3"
          },
          "payload": {}
        }
      };
    } else if (!err && response.statusCode !== 200) {
      console.log("Error: ", response.body, response.statusCode);
      reply = {
        "event": {
          "header": {
            "messageId": message.directive.header.messageId,
            "namespace": "Alexa.Authorization",
            "name": "ErrorResponse",
            "payloadVersion": "3"
          },
          "payload": {
            "type": "ACCEPT_GRANT_FAILED",
            "message": "Amazon Error"
          }
        }
      };
    } else {
      console.log("Error: ", err);
      reply = {
        "event": {
          "header": {
            "messageId": message.directive.header.messageId,
            "namespace": "Alexa.Authorization",
            "name": "ErrorResponse",
            "payloadVersion": "3"
          },
          "payload": {
            "type": "ACCEPT_GRANT_FAILED",
            "message": "Internal Error"
          }
        }
      };
    }
    callback(reply);
  });
}

function updateToken(username, message) {
  console.log("Update", username, {
    access_token: message.access_token,
    refresh_token: message.refresh_token,
    token_expires: new Date() + message.expires_in
  });
  Account.update({
    username: username
  }, {
    $set: {
      access_token: message.access_token,
      refresh_token: message.refresh_token,
      token_expires: new Date() + message.expires_in
    }
  }, {
    multi: false
  },
  function(err, count) {
    if (err) {
      console.log("DB Error:", err);
    }
  }
  );
}

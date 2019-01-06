var request = require('request');
var Account = require('../models/account');

module.exports = {
  retrieve: retrieve,
  refresh: refresh
};

function refresh(user, token) {
  console.log("refresh: ", user, token);
  _tokenRequest(user, token.region, 'grant_type=refresh_token&refresh_token=' + token.refresh_token, function(err, response) {
    //
    console.log("tokenRefresh: ", err, response.statusCode, response.body);
    // callback(err, response);
  });
}

function retrieve(req, callback) {
  //
  _tokenRequest(req.user.username, req.get('user-agent'), 'grant_type=authorization_code&code=' + req.body.directive.payload.grant.code, function(err, response) {
    var reply = "";
    if (!err && response.statusCode === 200) {
      reply = {
        "event": {
          "header": {
            "messageId": req.body.directive.header.messageId,
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
            "messageId": req.body.directive.header.messageId,
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
            "messageId": req.body.directive.header.messageId,
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
    console.log("validate: ", err, reply);
    callback(err, reply);
  });
}

function _tokenRequest(username, region, tokenRequest, callback) {
  // tokenRequest:
  // Refresh Token - grant_type=refresh_token&refresh_token=Atzr|IQEBLzAtAhRPpMJxdwVz2Nn6f2y-tpJX2DeX...
  // Access Token - grant_type=authorization_code&code=SplxlOBezQQYbYS6WxSbIA

  var body = tokenRequest + "&client_id=amzn1.application-oa2-client.8ff7ed85e0e1434f840a4f466ad34f7b&client_secret=60441f26e76a10e3d8a64945b7bd1284b24cd51d5b110b8a0c1be88ce72df7e0";

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
      // console.log(err, response.body, response.statusCode);
      updateToken(username, region, JSON.parse(response.body));
    }
    callback(err, response);
  });
}

function updateToken(username, region, message) {
  // console.log("Update", username, message, {
  //  access_token: message.access_token,
  //  refresh_token: message.refresh_token,
  //  token_expires: new Date().getTime() / 1000 + message.expires_in
  // });
  Account.update({
      username: username
    }, {
      $set: {
        access_token: message.access_token,
        refresh_token: message.refresh_token,
        region: region,
        token_expires: new Date().getTime() / 1000 + message.expires_in
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

var request = require('request');
// var Account = require('../models/account');
var OauthClient = require('../models/oauthClient');
var Account = require('../models/account');

module.exports = {
  retrieve: retrieve,
  getAccessToken: getAccessToken
};

function getAccessToken(username, callback) {
  // get Event GW access token for a user
  // returns object containing token, and url
  Account.findOne({
    username: username
  }, function(error, user) {
    if (error) {
      console.log("getUser Error: ", error);
      callback(error, null);
    } else {
      // lookup access token for user
      OauthClient.findOne({
          user: user
        }, function(error, data) {
          if (error) {
            console.log("getAccessToken Error: ", user.username, error);
            callback(error, null);
          } else if (!data) {
            console.log("getAccessToken No data Error: ", user.username);
            callback(new Error("getAccessToken No data Error: " + user.username), null);
          } else {
            console.log("retrieveToken Result: ", user.username, data);
            if (data.token_expires < new Date()) {
              // Token is expired, need to refresh_token
              refreshExpired(username, data, callback);
            } else {
              callback(null, {
                "access_token": data.access_token,
                "refresh_token": data.refresh_token,
                "url": getEventUrl(data.region)
              });
            }
          }
        } // End of function
      );
    }
  });
}

function refreshExpired(username, token, callback) {
  console.log("Access Token Expired, refreshing: ", username);
  tokenRequest(username, token.region, 'grant_type=refresh_token&refresh_token=' + token.refresh_token, function(err, response) {
    //
    // console.log("tokenRefresh: ", username, err, response.statusCode);
    if (err || response.statusCode !== 200) {
      if (!err) {
        err = "Event gateway token refresh error: " + response.statusCode;
      }
      callback(err);
    } else {
      var body = JSON.parse(response.body);
      callback(null, {
        "access_token": body.access_token,
        "refresh_token": body.refresh_token,
        "url": getEventUrl(token.region)
      });
    }
  });
}

function retrieve(req, callback) {
  // Retrieve refresh and access token from Amazon Login With Alexa Service
  tokenRequest(req.user.username, req.get('user-agent'), 'grant_type=authorization_code&code=' + req.body.directive.payload.grant.code, function(err, response) {
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

function tokenRequest(username, region, tokenRequest, callback) {
  // tokenRequest:
  // Refresh Token - grant_type=refresh_token&refresh_token=Atzr|IQEBLzAtAhRPpMJxdwVz2Nn6f2y-tpJX2DeX...
  // Access Token - grant_type=authorization_code&code=SplxlOBezQQYbYS6WxSbIA

  var clientId = process.env.EVENT_CLIENT_ID;
  var clientSecret = process.env.EVENT_CLIENT_SECRET;

  var body = tokenRequest + "&client_id=" + clientId + "&client_secret=" + clientSecret;

  // console.log("tokenRequest: ", username, body);

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
      _updateToken(username, region, JSON.parse(response.body));
    }
    callback(err, response);
  });
}

function _updateToken(username, region, message) {
  Account.findOne({
    username: username
  }, function(error, user) {
    if (!error && user) {
      // User account found
      OauthClient.findOne({
        user: user
      }, function(error, token) {
        if (!error && token) {
          // Update OauthClient Record
          token.access_token = message.access_token;
          token.refresh_token = message.refresh_token;
          token.region = region;
          // Expiry token 60 seconds early
          token.token_expires = (new Date().getTime() / 1000 + (message.expires_in - 60)) * 1000;
          token.save(function(error) {
            if (error) {
              console.log("ERROR: update Token", error);
            }
          });
          console.log("Token expires update", message.expires_in, token.token_expires);
          console.log("Token", token);
        } else if (!error) {
          // Create new OauthClient Records
          var token = new OauthClient({
            user: user,
            access_token: message.access_token,
            refresh_token: message.refresh_token,
            region: region,
            token_expires: (new Date().getTime() / 1000 + (message.expires_in - 60)) * 1000
          });
          token.save(function(error) {
            if (error) {
              console.log("ERROR: new Token", error);
            }
          });
          console.log("Token expires save", message.expires_in, token.token_expires);
        } else {
          console.log("ERROR: _updateToken OauthClient.", error);
        }
      });
    } else {
      console.log("ERROR: _updateToken failed account not found. ", username);
    }
  });
}

function getEventUrl(region) {
  var url = "";
  switch (region) {
    case "us-east-1":
      url = "https://api.amazonalexa.com/v3/events";
      break;
    case "us-west-2":
      url = "https://api.fe.amazonalexa.com/v3/events";
      break;
    case "eu-west-1":
      url = "https://api.eu.amazonalexa.com/v3/events";
      break;
    default:
      console.log("lwa Error: Unknown region", region);
  }
  return url;
}

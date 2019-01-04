var request = require('request');
var Account = require('../models/account');

module.exports = {
  send: send
};

function send(user, message) {
  // console.log(req);
  // var body = "grant_type=authorization_code&code=" + message.directive.payload.grant.code + "&client_id=amzn1.application-oa2-client.8ff7ed85e0e1434f840a4f466ad34f7b&client_secret=60441f26e76a10e3d8a64945b7bd1284b24cd51d5b110b8a0c1be88ce72df7e0";
  retrieveToken(user, function(error, token) {
      if (error || !token.url) {
        // Error already logged
      } else {
        message.endpoint.scope = {
          "type": "BearerToken",
          "token": token.access_token
        };
        console.log("Event: ", message);
        request({
          method: 'POST',
          url: token.url,
          timeout: 7000,
          maxAttempts: 1, // (default) try 5 times
          headers: {
            "Content-Type": "application/json"
          },
          body: message
        }, function(err, response) {
          if (!err && response.statusCode === 200) {
            // console.log(err, response.body, response.statusCode);
            // updateToken(req.user.username, req.get('user-agent'), JSON.parse(response.body));
          } else if (!err && response.statusCode !== 200) {
            console.log("Error: ", response.body, response.statusCode);
          } else {
            console.log("Error: ", err);
          }
        }); // end of request
      } // end of if else {
    } // end of retrieve token callback
  );
}

function retrieveToken(username, callback) {
  // Find user tokens
  Account.findOne({
    username: username
  }, function(error, data) {
    if (error) {
      console.log("Error: ", error);
      callback(error, null);
    } else {
      console.log("Result: ", data.username, data.region);
      // Determine region
      var url = "";
      switch (data.region) {
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
          console.log("Error: Unknown region", data.region);
      }
      callback(null, {
        "access_token": data.access_token,
        "refresh_token": data.refresh_token,
        "url": url
      });
    }
  });
}

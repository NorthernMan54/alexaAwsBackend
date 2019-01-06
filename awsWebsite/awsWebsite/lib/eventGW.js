// Design
//
// index.js-mqtt/event==>eventGW.send(user,message)==>retrieveToken(user)
// callback()==> post to eventGW 202=ok 401=old token
//
var lwa = require('./lwa.js');
var request = require('request');
var Account = require('../models/account');
var Measurement = require('./googleMeasurement.js');

var googleAnalyicsTID = process.env.GOOGLE_ANALYTICS_TID;
var measurement = new Measurement(googleAnalyicsTID);

module.exports = {
  send: send
};

function send(user, message) {
  // console.log(user, message);
  // console.log(req);
  // var body = "grant_type=authorization_code&code=" + message.directive.payload.grant.code + "&client_id=amzn1.application-oa2-client.8ff7ed85e0e1434f840a4f466ad34f7b&client_secret=60441f26e76a10e3d8a64945b7bd1284b24cd51d5b110b8a0c1be88ce72df7e0";
  retrieveToken(user, function(error, token) {
      if (error || !token.url) {
        // Error already logged
      } else {
        // console.log("2", message.event.endpoint );
        message.event.endpoint.scope = {
          "type": "BearerToken",
          "token": token.access_token
        };
        console.log("Sending event: ", user);
        request({
          method: 'POST',
          url: token.url,
          timeout: 7000,
          maxAttempts: 1, // (default) try 5 times
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(message)
        }, function(err, response) {
          if (!err && response.statusCode === 202) {
            // console.log(err, response.body, response.statusCode);
            // updateToken(req.user.username, req.get('user-agent'), JSON.parse(response.body));
            console.log("Event sent");
            measurement.send({
              t: 'event',
              ec: 'event',
              ea: message.event.header.name,
              el: user,
              sc: 'end',
              geoid: 'Amazon',
              uid: user
            });
          } else if (!err && response.statusCode === 401) {
            console.log("Refresh Token required: ", response.body, response.statusCode);
            lwa.refresh(user, token);
            measurement.send({
              t: 'event',
              ec: 'event',
              ea: 'tokenRefresh',
              el: user,
              sc: 'end',
              geoid: 'Amazon',
              uid: user
            });
          } else if (!err && response.statusCode) {
            console.log("eventGW Error: ", response.body, response.statusCode);
            // lwa.refresh(user, token);
            measurement.send({
              t: 'event',
              ec: 'event',
              ea: 'status.' + response.statusCode,
              el: user,
              sc: 'end',
              geoid: 'Amazon',
              uid: user
            });
          } else {
            console.log("Error: ", err);
            measurement.send({
              t: 'event',
              ec: 'event',
              ea: 'Error',
              el: user,
              sc: 'end',
              geoid: 'Amazon',
              uid: user
            });
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
      console.log("retrieveToken Error: ", error);
      callback(error, null);
    } else {
      // console.log("retrieveToken Result: ", data.username, data);
      // Determine region
      // token_expires: new Date().getTime() / 1000 + message.expires_in
      if (data.region < new Date().getTime() / 1000) {
        // Token is expired, need to refresh_token
        lwa.refresh(user, data);
      }
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
          console.log("eventGW Error: Unknown region", data.region);
          measurement.send({
            t: 'event',
            ec: 'event',
            ea: 'Error.region',
            el: user,
            sc: 'end',
            geoid: 'Amazon',
            uid: user
          });
      }
      callback(null, {
        "access_token": data.access_token,
        "refresh_token": data.refresh_token,
        "url": url
      });
    }
  });
}

// Design
//
// index.js-mqtt/event==>eventGW.send(user,message)==>retrieveToken(user)
// callback()==> post to eventGW 202=ok 401=old token
//
var oauthClient = require('./oauthClient.js');
var request = require('request');
var Measurement = require('./googleMeasurement.js');

var googleAnalyicsTID = process.env.GOOGLE_ANALYTICS_TID;
var measurement = new Measurement(googleAnalyicsTID);

module.exports = {
  send: send
};

function send(user, message, callback) {
  // console.log(user, message);
  // console.log(req);
  // var body = "grant_type=authorization_code&code=" + message.directive.payload.grant.code + "&client_id=amzn1.application-oa2-client.8ff7ed85e0e1434f840a4f466ad34f7b&client_secret=60441f26e76a10e3d8a64945b7bd1284b24cd51d5b110b8a0c1be88ce72df7e0";
  oauthClient.getAccessToken(user, function(error, token) {
      if (error || !token.url || !token.access_token) {
        // Error already logged
        if (!error) {
          error = "Token Error";
        }
        console.log("eventGW Error sending event:", user, token, error);
        measurement.send({
          t: 'event',
          ec: 'event',
          ea: error.toString(),
          el: user,
          sc: 'end',
          geoid: 'Amazon',
          uid: user
        });
        callback(error);
      } else {
        // console.log("2", message.event.endpoint );
        message.event.endpoint.scope = {
          "type": "BearerToken",
          "token": token.access_token
        };
        console.log("Sending event: ", user, token.url, JSON.stringify(message));
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
            console.log("Event sent", user);
            measurement.send({
              t: 'event',
              ec: 'event',
              ea: message.event.header.name,
              el: user,
              sc: 'end',
              geoid: 'Amazon',
              uid: user
            });
            callback(null);
          } else if (!err && response.statusCode === 401) {
            console.log("Refresh Token required: ", response.body, response.statusCode);
            oauthClient.refresh(user, token);
            measurement.send({
              t: 'event',
              ec: 'event',
              ea: 'tokenRefresh',
              el: user,
              sc: 'end',
              geoid: 'Amazon',
              uid: user
            });
            callback(null);
          } else if (!err && response.statusCode) {
            console.log("eventGW Error: ", user, response.body, response.statusCode);
            // oauthClient.refresh(user, token);
            measurement.send({
              t: 'event',
              ec: 'event',
              ea: 'status.' + response.statusCode,
              el: user,
              sc: 'end',
              geoid: 'Amazon',
              uid: user
            });
            callback("Event Gateway Response Code: " + response.statusCode);
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
            callback(err);
          }
        }); // end of request
      } // end of if else {
    } // end of retrieve token callback
  );
}

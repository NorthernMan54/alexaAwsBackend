var Usage = require('../models/usage');
var Account = require('../models/account');

module.exports = {
  lastUsedAlexa: lastUsedAlexa,
  lastUsedBroker: lastUsedBroker,
  lastUsedWebsite: lastUsedWebsite
};


function lastUsedAlexa(username) {
  Account.update({
      username: username
    }, {
      $set: {
        lastUsedAlexa: new Date()
      },
      $inc: {
        alexaCount: 1
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

function lastBrokerResponse(username) {
  Account.update({
      username: username
    }, {
      $set: {
        lastUsedBroker: new Date()
      },
      $inc: {
        brokerCount: 1
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

function lastUsedWebsite(username) {

  Account.update({
      username: username
    }, {
      $set: {
        lastUsedWebsite: new Date()
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

function getUserID(username, callback) {
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
      callback(null, user);
    }
  });
}

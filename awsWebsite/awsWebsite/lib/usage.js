var Usage = require('../models/usage');
var Account = require('../models/account');

module.exports = {
  lastUsedAlexa: lastUsedAlexa,
  lastUsedBroker: lastUsedBroker,
  lastUsedWebsite: lastUsedWebsite,
  lastEvent: lastEvent
};

function lastEvent(username) {
  getRecord(username, function(error, usage) {
    if (!error) {
      usage.lastEvent = new Date();
      usage.eventCount = usage.eventCount + 1;
      usage.save();
    } else {
      // Error
    }
  });
}

function lastUsedAlexa(username) {
  getRecord(username, function(error, usage) {
    if (!error) {
      usage.lastUsedAlexa = new Date();
      usage.alexaCount = usage.alexaCount + 1;
      usage.save();
    } else {
      // Error
    }
  });
}

function lastUsedBroker(username) {
  getRecord(username, function(error, usage) {
    if (!error) {
      usage.lastUsedBroker = new Date();
      usage.brokerCount = usage.brokerCount + 1;
      usage.save();
    } else {
      // Error
    }
  });
}

function lastUsedWebsite(username) {
  getRecord(username, function(error, usage) {
    if (!error) {
      usage.lastUsedWebsite = new Date();
      usage.save();
    } else {
      // Error
    }
  });
}

function getRecord(username, callback) {
  getUserID(username, function(error, user) {
    if (!error) {
      Usage.findOne({
        user: user
      }, function(error, usage) {
        if (error) {
          console.log("getUsage Error: ", error);
          callback(error, null);
        } else if (user) {
          // lookup access token for user
          callback(null, usage);
        } else {
          // Usage record not found
          // Initial population from legacy record
          var usage = new Usage({
            user: user,
            created: user.created,
            lastUsedAlexa: user.lastUsedAlexa,
            alexaCount: user.alexaCount,
            lastUsedBroker: user.lastUsedBroker,
            brokerCount: user.brokerCount,
            lastUsedWebsite: user.lastUsedWebsite
          });
          callback(null, usage);
        }
      });
    } else {
      // Error
      callback(error, null);
    }
  });
}

function getUserID(username, callback) {
  // get Event GW access token for a user
  // returns object containing token, and url
  Account.findOne({
    username: username
  }, function(error, user) {
    if (error || !user) {
      console.log("getUser Error: ", error);
      callback(error, null);
    } else {
      // lookup access token for user
      callback(null, user);
    }
  });
}

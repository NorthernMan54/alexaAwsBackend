const mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Usage = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'Account'
  },
  created: {
    type: Date,
    default: function() {
      return new Date();
    }
  },
  lastUsedAlexa: {
    type: Date,
    default: function() {
      return new Date(0);
    }
  },
  alexaCount: {
    type: Number,
    default: 0
  },
  lastUsedBroker: {
    type: Date,
    default: function() {
      return new Date(0);
    }
  },
  brokerCount: {
    type: Number,
    default: 0
  },
  lastEvent: {
    type: Date,
    default: function() {
      return new Date(0);
    }
  },
  eventCount: {
    type: Number,
    default: 0
  },
  lastUsedWebsite: {
    type: Date,
    default: function() {
      return new Date(0);
    }
  },
  presence: {
    type: Date,
    default: function() {
      return new Date(0);
    }
  },
  version: {
    type: String,
    default: ""
  }
});

module.exports = mongoose.model('Usage', Usage);

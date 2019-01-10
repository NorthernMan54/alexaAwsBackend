const mongoose = require('mongoose');
var Schema = mongoose.Schema;

var OauthClient = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'Account'
  },
  access_token: String,
  refresh_token: String,
  region: String,
  token_expires: {
    type: Date,
    default: function() {
      return new Date(0);
    }
  }
});

module.exports = mongoose.model('OauthClient', OauthClient);

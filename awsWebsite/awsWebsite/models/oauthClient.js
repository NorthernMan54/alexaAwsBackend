const mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ClientTokenSchema = new Schema({
  username: String,
  access_token: String,
  refresh_token: String,
  region: String,
  token_expires: {
    type: Number,
    default: 0
  }
});

var ClientToken = mongoose.model('ClientToken', ClientTokenSchema);

module.exports = {
  ClientToken: ClientToken
};
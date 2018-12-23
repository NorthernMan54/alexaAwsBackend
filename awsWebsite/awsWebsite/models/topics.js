const mongoose = require('mongoose');
var Schema = mongoose.Schema;
const AutoIncrement = require('mongoose-sequence')(mongoose);

var Topics = new Schema({
  _id: Number,
  topics: {type: [String]}
}, { _id: false });

Topics.plugin(AutoIncrement, {inc_field: '_id'});

module.exports = mongoose.model('Topics', Topics);

const mongoose = require("mongoose");

const streamSchema = new mongoose.Schema({
  streamerId: String,
  startTime: Date,
  endTime: Date,
  channelId: String,
});
module.exports = mongoose.model('Stream', streamSchema);

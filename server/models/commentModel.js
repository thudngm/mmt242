const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  streamerId: { type: String, required: true },
  streamId: { type: String, required: true },
  username: { type: String, required: true, trim: true },
  comment: { type: String, required: true, trim: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Comment", commentSchema);

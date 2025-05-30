const mongoose = require("mongoose");

const channelMessageSchema = new mongoose.Schema({
  channel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Channels",
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  message: {
    type: String, 
  },
  fileUrl: {
    type: String, 
  },
  fileName: {
    type: String, 
  }
}, { timestamps: true });

module.exports = mongoose.model("ChannelMessages", channelMessageSchema);

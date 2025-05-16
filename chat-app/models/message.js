const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['global', 'private', 'group'],
    required: true
  },
  sender: {
    type: String,
    required: true,
    ref: 'User'
  },
  recipient: {
    type: String,
    ref: 'User',
    // Required only for private messages
    required: function() {
      return this.type === 'private';
    }
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    // Required only for group messages
    required: function() {
      return this.type === 'group';
    }
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  read: {
    type: Boolean,
    default: false
  },
  time: {
    type: String, // For formatted time display
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient querying
MessageSchema.index({ sender: 1, recipient: 1 });
MessageSchema.index({ groupId: 1 });
MessageSchema.index({ type: 1 });
MessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// Get private messages between two users
router.get('/private', async (req, res) => {
  try {
    const { user1, user2, limit = 50 } = req.query;
    
    if (!user1 || !user2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both user names are required' 
      });
    }
    
    // Find messages between the two users
    const messages = await Message.find({
      type: 'private',
      $or: [
        { sender: user1, recipient: user2 },
        { sender: user2, recipient: user1 }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit, 10));
    
    res.json({ 
      success: true, 
      messages: messages.reverse() 
    });
  } catch (error) {
    console.error('Error getting private messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Get global messages
router.get('/global', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const messages = await Message.find({ 
      type: 'global' 
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit, 10));
    
    res.json({ 
      success: true, 
      messages: messages.reverse() 
    });
  } catch (error) {
    console.error('Error getting global messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Mark messages as read
router.put('/read', async (req, res) => {
  try {
    const { username, otherUsername } = req.body;
    
    if (!username || !otherUsername) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both usernames are required' 
      });
    }
    
    // Mark messages as read
    await Message.updateMany(
      {
        type: 'private',
        sender: otherUsername,
        recipient: username,
        read: false
      },
      { $set: { read: true } }
    );
    
    res.json({ 
      success: true, 
      message: 'Messages marked as read' 
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

module.exports = router;
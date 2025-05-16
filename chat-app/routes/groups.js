const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Message = require('../models/Message');

// Create a new group
router.post('/', async (req, res) => {
  try {
    const { name, creator, members } = req.body;
    
    // Validate input
    if (!name || !creator || !members || !Array.isArray(members)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid group chat data' 
      });
    }
    
    // Check if group name already exists
    const existingGroup = await Group.findOne({ name });
    if (existingGroup) {
      return res.status(400).json({ 
        success: false, 
        message: 'Group chat name already exists' 
      });
    }
    
    // Create new group
    const newGroup = new Group({
      name,
      creator,
      members: [creator, ...members.filter(member => member !== creator)]
    });
    
    await newGroup.save();
    
    res.status(201).json({
      success: true,
      group: {
        id: newGroup._id,
        name: newGroup.name,
        creator: newGroup.creator,
        members: newGroup.members,
        createdAt: newGroup.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Get groups for a user
router.get('/', async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username is required' 
      });
    }
    
    // Find groups where user is a member
    const groups = await Group.find({ members: username });
    
    const formattedGroups = groups.map(group => ({
      id: group._id,
      name: group.name,
      creator: group.creator,
      members: group.members,
      createdAt: group.createdAt
    }));
    
    res.json({ success: true, groups: formattedGroups });
  } catch (error) {
    console.error('Error getting groups:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Get messages for a group
router.get('/:groupId/messages', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 50 } = req.query;
    
    const messages = await Message.find({ 
      type: 'group', 
      groupId 
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit, 10));
    
    res.json({ 
      success: true, 
      messages: messages.reverse() 
    });
  } catch (error) {
    console.error('Error getting group messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Add a member to group
router.post('/:groupId/members', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { username } = req.body;
    
    // Find group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ 
        success: false, 
        message: 'Group not found' 
      });
    }
    
    // Check if user is already a member
    if (group.members.includes(username)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is already a member' 
      });
    }
    
    // Add user to group
    group.members.push(username);
    await group.save();
    
    res.json({ 
      success: true, 
      message: 'Member added successfully',
      group: {
        id: group._id,
        name: group.name,
        creator: group.creator,
        members: group.members,
        createdAt: group.createdAt
      }
    });
  } catch (error) {
    console.error('Error adding member to group:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Remove a member from group
router.delete('/:groupId/members/:username', async (req, res) => {
  try {
    const { groupId, username } = req.params;
    
    // Find group
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ 
        success: false, 
        message: 'Group not found' 
      });
    }
    
    // Check if user is a member
    if (!group.members.includes(username)) {
      return res.status(400).json({ 
        success: false, 
        message: 'User is not a member' 
      });
    }
    
    // Remove user from group
    group.members = group.members.filter(member => member !== username);
    await group.save();
    
    res.json({ 
      success: true, 
      message: 'Member removed successfully',
      group: {
        id: group._id,
        name: group.name,
        creator: group.creator,
        members: group.members,
        createdAt: group.createdAt
      }
    });
  } catch (error) {
    console.error('Error removing member from group:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

module.exports = router;
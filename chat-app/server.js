const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');

// Load env variables
dotenv.config();

// Import database connection
const connectDB = require('./config/db');

// Import models
const User = require('./models/User');
const Message = require('./models/Message');
const Group = require('./models/Group');

// Import routes
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');
const messageRoutes = require('./routes/messages');

// Initialize app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/messages', messageRoutes);

// Track online users and their socket IDs
const onlineUsers = {};
const userSocketMap = {}; // Maps username to socket ID

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);
  
  // Handle user login
  socket.on('userLogin', async (username) => {
    try {
      // Store user information
      socket.username = username;
      onlineUsers[socket.id] = username;
      userSocketMap[username] = socket.id;
      
      // Update user status in database
      await User.findOneAndUpdate(
        { username },
        { isOnline: true, lastActive: Date.now() }
      );
      
      // Join a room specific to this user for private messages
      socket.join(username);
      
      // Get all online users
      const users = await User.find({ isOnline: true }, 'username');
      const onlineUsernames = users.map(user => user.username);
      
      // Welcome message to the new user
      socket.emit('message', {
        type: 'system',
        user: 'System',
        text: `Welcome to the chat, ${username}!`,
        time: new Date().toLocaleTimeString()
      });
      
      // Broadcast to others that a new user has joined
      socket.broadcast.emit('message', {
        type: 'system',
        user: 'System',
        text: `${username} has joined the chat`,
        time: new Date().toLocaleTimeString()
      });
      
      // Send the list of online users to everyone
      io.emit('updateOnlineUsers', onlineUsernames);
      
      // Get user's groups
      const groups = await Group.find({ members: username });
      const formattedGroups = groups.map(group => ({
        id: group._id,
        name: group.name,
        creator: group.creator,
        members: group.members
      }));
      
      // Join all group chats this user is a member of
      groups.forEach(group => {
        socket.join(`group:${group._id}`);
      });
      
      // Send group list
      socket.emit('groupList', formattedGroups);
    } catch (error) {
      console.error('Error in userLogin:', error);
    }
  });
  
  // Handle global chat messages
  socket.on('sendMessage', async (message) => {
    try {
      const time = new Date().toLocaleTimeString();
      
      // Create and save message to database
      const newMessage = new Message({
        type: 'global',
        sender: message.user,
        text: message.text,
        time
      });
      
      await newMessage.save();
      
      // Format the message
      const formattedMessage = {
        type: 'global',
        user: message.user,
        text: message.text,
        time
      };
      
      // Broadcast to everyone
      io.emit('message', formattedMessage);
    } catch (error) {
      console.error('Error sending global message:', error);
    }
  });
  
  // Handle private messages
  socket.on('sendPrivateMessage', async (data) => {
    try {
      const { recipient, text } = data;
      const sender = socket.username;
      
      if (!sender || !recipient || !text) return;
      
      const time = new Date().toLocaleTimeString();
      
      // Create and save message to database
      const newMessage = new Message({
        type: 'private',
        sender,
        recipient,
        text,
        time,
        read: false
      });
      
      await newMessage.save();
      
      // Format the message
      const privateMessage = {
        type: 'private',
        sender,
        recipient,
        text,
        time,
        read: false
      };
      
      // Send to sender
      socket.emit('privateMessage', privateMessage);
      
      // Send to recipient if online
      if (userSocketMap[recipient]) {
        io.to(recipient).emit('privateMessage', privateMessage);
      }
    } catch (error) {
      console.error('Error sending private message:', error);
    }
  });
  
  // Handle group messages
  socket.on('sendGroupMessage', async (data) => {
    try {
      const { groupId, text } = data;
      const sender = socket.username;
      
      if (!sender || !groupId || !text) return;
      
      // Find the group
      const group = await Group.findById(groupId);
      if (!group) return;
      
      // Check if user is a member
      if (!group.members.includes(sender)) return;
      
      const time = new Date().toLocaleTimeString();
      
      // Create and save message to database
      const newMessage = new Message({
        type: 'group',
        sender,
        groupId,
        text,
        time
      });
      
      await newMessage.save();
      
      // Format the message
      const groupMessage = {
        type: 'group',
        groupId,
        sender,
        text,
        time
      };
      
      // Send to all group members
      io.to(`group:${groupId}`).emit('groupMessage', groupMessage);
    } catch (error) {
      console.error('Error sending group message:', error);
    }
  });
  
  // Get group message history
  socket.on('getGroupMessages', async (groupId) => {
    try {
      const username = socket.username;
      
      // Find the group
      const group = await Group.findById(groupId);
      if (!group) return;
      
      // Check if user is a member
      if (!group.members.includes(username)) return;
      
      // Get messages for the group
      const messages = await Message.find({ 
        type: 'group',
        groupId 
      })
      .sort({ createdAt: 1 })
      .limit(50);
      
      socket.emit('groupMessageHistory', {
        groupId,
        messages
      });
    } catch (error) {
      console.error('Error getting group messages:', error);
    }
  });
  
  // Handle private message history request
  socket.on('getPrivateMessages', async (otherUsername) => {
    try {
      const username = socket.username;
      
      // Get messages between the two users
      const messages = await Message.find({
        type: 'private',
        $or: [
          { sender: username, recipient: otherUsername },
          { sender: otherUsername, recipient: username }
        ]
      })
      .sort({ createdAt: 1 })
      .limit(50);
      
      socket.emit('privateMessageHistory', {
        username: otherUsername,
        messages
      });
      
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
    } catch (error) {
      console.error('Error getting private messages:', error);
    }
  });
  
  // Handle global message history request
  socket.on('getGlobalMessages', async () => {
    try {
      // Get global messages
      const messages = await Message.find({ 
        type: 'global' 
      })
      .sort({ createdAt: 1 })
      .limit(50);
      
      socket.emit('globalMessageHistory', messages);
    } catch (error) {
      console.error('Error getting global messages:', error);
    }
  });
  
  // Handle user typing notification for private chat
  socket.on('typing', (data) => {
    const { recipient, isTyping } = data;
    const sender = socket.username;
    
    if (!sender || !recipient) return;
    
    if (userSocketMap[recipient]) {
      io.to(recipient).emit('userTyping', {
        user: sender,
        isTyping
      });
    }
  });
  
  // Handle user typing notification for group chat
  socket.on('typingInGroup', (data) => {
    const { groupId, isTyping } = data;
    const username = socket.username;
    
    if (!username || !groupId) return;
    
    socket.to(`group:${groupId}`).emit('userTypingInGroup', {
      groupId,
      user: username,
      isTyping
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', async () => {
    const username = socket.username;
    
    if (username) {
      console.log('User disconnected:', username);
      
      try {
        // Update user status in database
        await User.findOneAndUpdate(
          { username },
          { isOnline: false, lastActive: Date.now() }
        );
        
        // Remove user from online users and mapping
        delete onlineUsers[socket.id];
        delete userSocketMap[username];
        
        // Notify others that user has left
        io.emit('message', {
          type: 'system',
          user: 'System',
          text: `${username} has left the chat`,
          time: new Date().toLocaleTimeString()
        });
        
        // Update the list of online users
        const users = await User.find({ isOnline: true }, 'username');
        const onlineUsernames = users.map(user => user.username);
        
        io.emit('updateOnlineUsers', onlineUsernames);
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
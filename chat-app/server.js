const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Initialize app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);
  
  // Welcome message to the new user
  socket.emit('message', {
    user: 'System',
    text: 'Welcome to the chat!',
    time: new Date().toLocaleTimeString()
  });
  
  // Broadcast to others that a new user has joined
  socket.broadcast.emit('message', {
    user: 'System',
    text: 'A new user has joined the chat',
    time: new Date().toLocaleTimeString()
  });
  
  // Handle incoming messages
  socket.on('sendMessage', (message) => {
    io.emit('message', {
      user: message.user || 'Anonymous',
      text: message.text,
      time: new Date().toLocaleTimeString()
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    io.emit('message', {
      user: 'System',
      text: 'A user has left the chat',
      time: new Date().toLocaleTimeString()
    });
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
// DOM elements
const chatMessages = document.getElementById('chat-messages');
const usernameForm = document.getElementById('username-form');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const usernameInput = document.getElementById('username');
const joinContainer = document.getElementById('join-container');
const messageInputContainer = document.getElementById('message-input-container');

// State
let username = '';
let socket = null;

// Event listeners
usernameForm.addEventListener('submit', joinChat);
messageForm.addEventListener('submit', sendMessage);

// Functions
function joinChat(e) {
    e.preventDefault();
    username = usernameInput.value.trim();
    
    if (!username) return;
    
    // Hide join form, show message input
    joinContainer.style.display = 'none';
    messageInputContainer.style.display = 'block';
    
    // Initialize Socket.io connection
    initializeSocket();
    
    // Focus on message input
    messageInput.focus();
}

function initializeSocket() {
    // Connect to server
    socket = io();
    
    // Listen for messages
    socket.on('message', (message) => {
        displayMessage(message);
        
        // Scroll to the bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

function sendMessage(e) {
    e.preventDefault();
    
    const text = messageInput.value.trim();
    
    if (!text) return;
    
    // Send message to server
    socket.emit('sendMessage', {
        user: username,
        text
    });
    
    // Clear input
    messageInput.value = '';
    messageInput.focus();
}

function displayMessage(message) {
    const messageElement = document.createElement('div');
    
    // Determine message style
    if (message.user === 'System') {
        messageElement.className = 'message system-message';
    } else if (message.user === username) {
        messageElement.className = 'message user-message';
    } else {
        messageElement.className = 'message other-message';
    }
    
    // Create message content
    if (message.user !== 'System') {
        const userElement = document.createElement('div');
        userElement.className = 'message-user';
        userElement.textContent = message.user;
        messageElement.appendChild(userElement);
    }
    
    const textElement = document.createElement('div');
    textElement.className = 'message-text';
    textElement.textContent = message.text;
    messageElement.appendChild(textElement);
    
    const timeElement = document.createElement('div');
    timeElement.className = 'message-time';
    timeElement.textContent = message.time;
    messageElement.appendChild(timeElement);
    
    // Add message to chat
    chatMessages.appendChild(messageElement);
}
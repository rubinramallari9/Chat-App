// -----------------------------------------------------
// DOM Elements
// -----------------------------------------------------
const chatMessages = document.getElementById('chat-messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const usernameDisplay = document.getElementById('username-display');
const logoutBtn = document.getElementById('logout-btn');
const onlineUsersList = document.getElementById('online-users-list');
const allUsersList = document.getElementById('all-users-list');
const groupList = document.getElementById('group-list');
const chatList = document.getElementById('chat-list');
const currentChatName = document.getElementById('current-chat-name');
const chatParticipants = document.getElementById('chat-participants');
const userTypingIndicator = document.getElementById('user-typing-indicator');
const createGroupBtn = document.getElementById('create-group-btn');
const createGroupModal = document.getElementById('create-group-modal');
const closeModal = document.querySelector('.close-modal');
const createGroupForm = document.getElementById('create-group-form');
const groupNameInput = document.getElementById('group-name');
const memberSearch = document.getElementById('member-search');
const memberResults = document.getElementById('member-results');
const selectedMembers = document.getElementById('selected-members');

// Tab navigation
const chatsTab = document.getElementById('chats-tab');
const usersTab = document.getElementById('users-tab');
const groupsTab = document.getElementById('groups-tab');
const chatsContent = document.getElementById('chats-content');
const usersContent = document.getElementById('users-content');
const groupsContent = document.getElementById('groups-content');

// Search inputs
const searchChats = document.getElementById('search-chats');
const searchUsers = document.getElementById('search-users');
const searchGroups = document.getElementById('search-groups');

// -----------------------------------------------------
// State
// -----------------------------------------------------
let currentUsername = '';
let onlineUsers = [];
let allUsers = [];
let myGroups = [];
let currentChat = 'global'; // global, private:username, or group:id
let privateChats = {}; // Stores private chat messages
let groupChats = {}; // Stores group chat messages
let typingTimeout;
let selectedMembersList = [];
let unreadMessages = {
    global: 0,
    // Will add private:username and group:id entries dynamically
};

// Add a notification sound
const messageSound = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=notification-sound-7062.mp3');

// -----------------------------------------------------
// Notification Functions
// -----------------------------------------------------

// Request notification permission on page load
function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('This browser does not support desktop notifications');
        return;
    }
    
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', requestNotificationPermission);

// Add this function to show browser notifications
function showBrowserNotification(title, body) {
    // Check if the page is not visible
    if (document.hidden && Notification.permission === 'granted') {
        const notification = new Notification(title, {
            body: body,
            icon: '/favicon.ico' // Add a favicon.ico to your public folder
        });
        
        // Close the notification after 5 seconds
        setTimeout(() => notification.close(), 5000);
        
        // Focus the window when notification is clicked
        notification.onclick = function() {
            window.focus();
            this.close();
        };
    }
}

// Play a notification sound and show browser notification
function playNotificationSound(sender, message) {
    // Clone the audio to allow multiple overlapping sounds
    messageSound.cloneNode(true).play().catch(err => {
        // Browsers may block autoplay of sounds, we'll ignore this error
        console.log('Sound notification blocked by browser policy');
    });
    
    // Show browser notification if provided with sender and message
    if (sender && message) {
        showBrowserNotification(sender, message);
    }
}

// -----------------------------------------------------
// Authentication Check
// -----------------------------------------------------
function checkAuth() {
    const username = localStorage.getItem('chatUsername');
    
    if (!username) {
        // Redirect to login page if not logged in
        window.location.href = '/login.html';
        return null;
    }
    
    return username;
}

// Get username
currentUsername = checkAuth();

// Display username
if (currentUsername) {
    usernameDisplay.textContent = currentUsername;
}

// -----------------------------------------------------
// Chat Persistence Functions
// -----------------------------------------------------

// Save the current chat to localStorage
function saveCurrentChat() {
    localStorage.setItem('currentChat', currentChat);
}

// Load the previously selected chat
function loadSavedChat() {
    const savedChat = localStorage.getItem('currentChat');
    
    if (savedChat) {
        // Check if the chat exists before switching to it
        if (savedChat === 'global') {
            switchChat('global');
        } else if (savedChat.startsWith('private:')) {
            const username = savedChat.split(':')[1];
            if (privateChats[username]) {
                switchChat(savedChat);
            }
        } else if (savedChat.startsWith('group:')) {
            const groupId = savedChat.split(':')[1];
            if (myGroups.some(g => g.id === groupId)) {
                switchChat(savedChat);
            }
        }
    }
}

// -----------------------------------------------------
// Socket.io Connection
// -----------------------------------------------------
let socket = io();

socket.on('connect', () => {
    // Send login information to server
    socket.emit('userLogin', currentUsername);
    
    // Get all users (in a real app, this would be an API call)
    fetchAllUsers();
    
    // Focus on message input
    messageInput.focus();
    
    // After receiving private messages and groups, load the saved chat
    setTimeout(loadSavedChat, 1000);
});

// -----------------------------------------------------
// Event Listeners
// -----------------------------------------------------
messageForm.addEventListener('submit', sendMessage);
logoutBtn.addEventListener('click', logout);

// Tab navigation
chatsTab.addEventListener('click', () => switchTab('chats'));
usersTab.addEventListener('click', () => switchTab('users'));
groupsTab.addEventListener('click', () => switchTab('groups'));

// Group modal
createGroupBtn.addEventListener('click', openCreateGroupModal);
closeModal.addEventListener('click', closeCreateGroupModal);
window.addEventListener('click', (e) => {
    if (e.target === createGroupModal) {
        closeCreateGroupModal();
    }
});
createGroupForm.addEventListener('submit', createGroup);

// Member search for group creation
memberSearch.addEventListener('input', searchMembers);

// Chat search
searchChats.addEventListener('input', filterChats);
searchUsers.addEventListener('input', filterUsers);
searchGroups.addEventListener('input', filterGroups);

// Typing indicator
messageInput.addEventListener('input', handleTyping);

// -----------------------------------------------------
// Socket Event Listeners
// -----------------------------------------------------

// Global messages
socket.on('message', (message) => {
    if (currentChat === 'global') {
        displayMessage(message);
        scrollToBottom();
    } else {
        // Increment unread count for global chat
        unreadMessages.global = (unreadMessages.global || 0) + 1;
        
        // Play notification sound
        playNotificationSound('Global Chat', message.text);
    }
    
    // Update chat list to show unread indicator
    updateChatList();
});

// Online users update
socket.on('updateOnlineUsers', (users) => {
    onlineUsers = users;
    renderOnlineUsers();
    updateUsersList();
});

// Private messages
socket.on('privateMessage', (message) => {
    // Determine the chat identifier (the other user's username)
    const otherUser = message.sender === currentUsername ? message.recipient : message.sender;
    const chatId = `private:${otherUser}`;
    
    // Initialize chat if it doesn't exist
    if (!privateChats[otherUser]) {
        privateChats[otherUser] = [];
    }
    
    // Add message to chat
    privateChats[otherUser].push(message);
    
    // If this is the current chat, display the message
    if (currentChat === chatId) {
        displayMessage({
            ...message,
            user: message.sender // For display purposes
        });
        scrollToBottom();
    } else {
        // Increment unread count
        unreadMessages[chatId] = (unreadMessages[chatId] || 0) + 1;
        
        // Play notification sound and show browser notification if message is from other user
        if (message.sender !== currentUsername) {
            playNotificationSound(message.sender, message.text);
        }
    }
    
    // Update chat list
    updateChatList();
});

// Private message history
socket.on('privateMessageHistory', (data) => {
    const { username, messages } = data;
    
    // Initialize chat if it doesn't exist
    if (!privateChats[username]) {
        privateChats[username] = [];
    }
    
    // Clear existing messages and add new ones
    privateChats[username] = messages;
    
    // If this is the current chat, display all messages
    if (currentChat === `private:${username}`) {
        renderChat();
    }
    
    // Update chat list
    updateChatList();
});

// Global message history
socket.on('globalMessageHistory', (messages) => {
    // Display global messages
    messages.forEach(message => {
        displayMessage({
            ...message,
            user: message.sender // For display purposes
        });
    });
    
    scrollToBottom();
});

// Group created
socket.on('groupChatCreated', (group) => {
    myGroups.push(group);
    updateGroupList();
});

// Group message
socket.on('groupMessage', (message) => {
    const groupId = message.groupId;
    const chatId = `group:${groupId}`;
    const group = myGroups.find(g => g.id === groupId);
    
    // Initialize group chat if it doesn't exist
    if (!groupChats[groupId]) {
        groupChats[groupId] = [];
    }
    
    // Add message to group chat
    groupChats[groupId].push(message);
    
    // If this is the current chat, display the message
    if (currentChat === chatId) {
        displayMessage({
            ...message,
            user: message.sender // For display purposes
        });
        scrollToBottom();
    } else {
        // Increment unread count
        unreadMessages[chatId] = (unreadMessages[chatId] || 0) + 1;
        
        // Play notification sound and show browser notification if message is from other user
        if (message.sender !== currentUsername && group) {
            playNotificationSound(`${message.sender} (${group.name})`, message.text);
        }
    }
    
    // Update chat list
    updateChatList();
});

// Group message history
socket.on('groupMessageHistory', (data) => {
    const { groupId, messages } = data;
    
    groupChats[groupId] = messages;
    
    // If this is the current chat, display all messages
    if (currentChat === `group:${groupId}`) {
        renderChat();
    }
});

// Group list
socket.on('groupList', (groups) => {
    myGroups = groups;
    updateGroupList();
});

// Typing indicators
socket.on('userTyping', (data) => {
    if (currentChat === `private:${data.user}` && data.isTyping) {
        userTypingIndicator.textContent = `${data.user} is typing...`;
    } else {
        userTypingIndicator.textContent = '';
    }
});

socket.on('userTypingInGroup', (data) => {
    if (currentChat === `group:${data.groupId}` && data.isTyping) {
        userTypingIndicator.textContent = `${data.user} is typing...`;
    } else {
        userTypingIndicator.textContent = '';
    }
});

// -----------------------------------------------------
// UI Functions
// -----------------------------------------------------

function switchTab(tab) {
    // Hide all tabs
    chatsTab.classList.remove('active');
    usersTab.classList.remove('active');
    groupsTab.classList.remove('active');
    chatsContent.classList.remove('active');
    usersContent.classList.remove('active');
    groupsContent.classList.remove('active');
    
    // Show selected tab
    if (tab === 'chats') {
        chatsTab.classList.add('active');
        chatsContent.classList.add('active');
    } else if (tab === 'users') {
        usersTab.classList.add('active');
        usersContent.classList.add('active');
    } else if (tab === 'groups') {
        groupsTab.classList.add('active');
        groupsContent.classList.add('active');
    }
}

function openCreateGroupModal() {
    createGroupModal.classList.add('active');
    groupNameInput.focus();
    selectedMembersList = [];
    selectedMembers.innerHTML = '';
    renderMemberSearchResults([]);
}

function closeCreateGroupModal() {
    createGroupModal.classList.remove('active');
    createGroupForm.reset();
}

function updateChatList() {
    // Keep global chat at the top
    const globalUnread = unreadMessages.global || 0;
    let html = `
        <li class="chat-item ${currentChat === 'global' ? 'active' : ''}" data-chat="global">
            <div class="chat-item-icon">
                <i class="fas fa-globe"></i>
            </div>
            <div class="chat-item-content">
                <div class="chat-item-name">
                    Global Chat
                    ${globalUnread > 0 ? `<span class="unread-badge">${globalUnread}</span>` : ''}
                </div>
                <div class="chat-item-last-message">Everyone can see these messages</div>
            </div>
        </li>
    `;
    
    // Add private chats
    for (const username in privateChats) {
        const chatId = `private:${username}`;
        const isActive = currentChat === chatId;
        const messages = privateChats[username];
        const lastMessage = messages.length > 0 ? messages[messages.length - 1].text : 'No messages yet';
        const isOnline = onlineUsers.includes(username);
        const unreadCount = unreadMessages[chatId] || 0;
        
        html += `
            <li class="chat-item ${isActive ? 'active' : ''} ${unreadCount > 0 ? 'has-unread' : ''}" data-chat="${chatId}">
                <div class="chat-item-icon">
                    <i class="fas fa-user"></i>
                </div>
                <div class="chat-item-content">
                    <div class="chat-item-name">
                        ${username} ${isOnline ? '🟢' : ''}
                        ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                    </div>
                    <div class="chat-item-last-message">${truncateText(lastMessage, 30)}</div>
                </div>
            </li>
        `;
    }
    
    // Add group chats
    for (const group of myGroups) {
        const chatId = `group:${group.id}`;
        const isActive = currentChat === chatId;
        const messages = groupChats[group.id] || [];
        const lastMessage = messages.length > 0 ? 
            `${messages[messages.length - 1].sender}: ${messages[messages.length - 1].text}` : 
            'No messages yet';
        const unreadCount = unreadMessages[chatId] || 0;
        
        html += `
            <li class="chat-item ${isActive ? 'active' : ''} ${unreadCount > 0 ? 'has-unread' : ''}" data-chat="${chatId}">
                <div class="chat-item-icon">
                    <i class="fas fa-users"></i>
                </div>
                <div class="chat-item-content">
                    <div class="chat-item-name">
                        ${group.name}
                        ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                    </div>
                    <div class="chat-item-last-message">${truncateText(lastMessage, 30)}</div>
                </div>
            </li>
        `;
    }
    
    chatList.innerHTML = html;
    
    // Add event listeners to chat items
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const chatId = item.dataset.chat;
            switchChat(chatId);
        });
    });
    
    // Update page title if there are unread messages
    updatePageTitle();
}

function updatePageTitle() {
    // Count total unread messages
    let totalUnread = 0;
    for (const chatId in unreadMessages) {
        totalUnread += unreadMessages[chatId] || 0;
    }
    
    // Update page title
    if (totalUnread > 0) {
        document.title = `(${totalUnread}) Chat App`;
    } else {
        document.title = 'Chat App';
    }
}

function renderOnlineUsers() {
    let html = '';
    
    onlineUsers.forEach(username => {
        if (username === currentUsername) return; // Skip current user
        
        html += `
            <li class="user-item" data-username="${username}">
                <div class="user-status online"></div>
                ${username}
            </li>
        `;
    });
    
    onlineUsersList.innerHTML = html || '<div class="empty-list">No users online</div>';
    
    // Add event listeners
    document.querySelectorAll('#online-users-list .user-item').forEach(item => {
        item.addEventListener('click', () => {
            const username = item.dataset.username;
            startPrivateChat(username);
        });
    });
}

function updateUsersList() {
    let html = '';
    
    allUsers.forEach(user => {
        if (user.username === currentUsername) return; // Skip current user
        
        const isOnline = onlineUsers.includes(user.username);
        
        html += `
            <li class="user-item" data-username="${user.username}">
                <div class="user-status ${isOnline ? 'online' : 'offline'}"></div>
                ${user.username}
            </li>
        `;
    });
    
    allUsersList.innerHTML = html || '<div class="empty-list">No users found</div>';
    
    // Add event listeners
    document.querySelectorAll('#all-users-list .user-item').forEach(item => {
        item.addEventListener('click', () => {
            const username = item.dataset.username;
            startPrivateChat(username);
        });
    });
}

function updateGroupList() {
    let html = '';
    
    myGroups.forEach(group => {
        html += `
            <li class="group-item" data-group-id="${group.id}">
                <div class="group-item-icon">
                    <i class="fas fa-users"></i>
                </div>
                <div class="group-item-content">
                    <div class="group-item-name">${group.name}</div>
                    <div class="group-item-members">${group.members.length} members</div>
                </div>
            </li>
        `;
    });
    
    groupList.innerHTML = html || '<div class="empty-list">No groups yet</div>';
    
    // Add event listeners
    document.querySelectorAll('.group-item').forEach(item => {
        item.addEventListener('click', () => {
            const groupId = item.dataset.groupId;
            switchChat(`group:${groupId}`);
        });
    });
    
    // Update chat list too
    updateChatList();
}

function startPrivateChat(username) {
    // Switch to this chat
    switchChat(`private:${username}`);
    
    // Switch to chats tab
    switchTab('chats');
}

function switchChat(chatId) {
    // Remove active class from all chat items
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to selected chat
    const chatItem = document.querySelector(`.chat-item[data-chat="${chatId}"]`);
    if (chatItem) {
        chatItem.classList.add('active');
    }
    
    // Reset unread count for this chat
    unreadMessages[chatId] = 0;
    
    // Update current chat
    currentChat = chatId;
    
    // Update chat header
    updateChatHeader();
    
    // Clear messages until we get them from the server
    chatMessages.innerHTML = '';
    
    // Fetch appropriate message history
    if (chatId === 'global') {
        fetchGlobalMessages();
    } else if (chatId.startsWith('private:')) {
        const username = chatId.split(':')[1];
        fetchPrivateMessages(username);
    } else if (chatId.startsWith('group:')) {
        const groupId = chatId.split(':')[1];
        socket.emit('getGroupMessages', groupId);
    }
    
    // Update chat list to reflect read status
    updateChatList();
    
    // Save current chat to localStorage
    saveCurrentChat();
    
    // Focus on message input
    messageInput.focus();
}

function updateChatHeader() {
    let name = '';
    let participants = '';
    
    if (currentChat === 'global') {
        name = 'Global Chat';
        participants = 'Everyone can participate';
    } else if (currentChat.startsWith('private:')) {
        const username = currentChat.split(':')[1];
        name = username;
        participants = onlineUsers.includes(username) ? 'Online' : 'Offline';
    } else if (currentChat.startsWith('group:')) {
        const groupId = currentChat.split(':')[1];
        const group = myGroups.find(g => g.id === groupId);
        if (group) {
            name = group.name;
            participants = `${group.members.length} members`;
        }
    }
    
    currentChatName.textContent = name;
    chatParticipants.textContent = participants;
}

function renderChat() {
    // Clear messages
    chatMessages.innerHTML = '';
    
    // Display appropriate messages based on current chat
    if (currentChat === 'global') {
        // We don't have stored global messages yet, so do nothing
    } else if (currentChat.startsWith('private:')) {
        const username = currentChat.split(':')[1];
        const messages = privateChats[username] || [];
        
        messages.forEach(msg => {
            displayMessage({
                ...msg,
                user: msg.sender // For display purposes
            });
        });
    } else if (currentChat.startsWith('group:')) {
        const groupId = currentChat.split(':')[1];
        const messages = groupChats[groupId] || [];
        
        messages.forEach(msg => {
            displayMessage({
                ...msg,
                user: msg.sender // For display purposes
            });
        });
    }
    
    scrollToBottom();
}

function displayMessage(message) {
    const messageElement = document.createElement('div');
    
    // Determine message style
    if (message.type === 'system' || message.user === 'System') {
        messageElement.className = 'message system-message';
    } else if (message.user === currentUsername || message.sender === currentUsername) {
        messageElement.className = 'message user-message';
    } else {
        messageElement.className = 'message other-message';
    }
    
    // Create message content
    if (message.user !== 'System' && message.type !== 'system') {
        const userElement = document.createElement('div');
        userElement.className = 'message-user';
        userElement.textContent = message.user || message.sender;
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
    
    // Add a clear element to fix float layout
    const clearElement = document.createElement('div');
    clearElement.className = 'message-clear';
    chatMessages.appendChild(clearElement);
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// -----------------------------------------------------
// Chat Functions
// -----------------------------------------------------

function sendMessage(e) {
    e.preventDefault();
    
    const text = messageInput.value.trim();
    
    if (!text) return;
    
    // Send message based on current chat type
    if (currentChat === 'global') {
        socket.emit('sendMessage', {
            user: currentUsername,
            text
        });
    } else if (currentChat.startsWith('private:')) {
        const recipient = currentChat.split(':')[1];
        socket.emit('sendPrivateMessage', {
            recipient,
            text
        });
    } else if (currentChat.startsWith('group:')) {
        const groupId = currentChat.split(':')[1];
        socket.emit('sendGroupMessage', {
            groupId,
            text
        });
    }
    
    // Clear input and stop typing indicator
    messageInput.value = '';
    
    // Emit stop typing event
    emitStopTyping();
    
    // Focus input
    messageInput.focus();
}

function handleTyping() {
    // Clear existing timeout
    clearTimeout(typingTimeout);
    
    // Emit typing event based on chat type
    if (currentChat.startsWith('private:')) {
        const recipient = currentChat.split(':')[1];
        socket.emit('typing', {
            recipient,
            isTyping: true
        });
    } else if (currentChat.startsWith('group:')) {
        const groupId = currentChat.split(':')[1];
        socket.emit('typingInGroup', {
            groupId,
            isTyping: true
        });
    }
    
    // Set timeout to stop typing after 2 seconds of inactivity
    typingTimeout = setTimeout(emitStopTyping, 2000);
}

function emitStopTyping() {
    if (currentChat.startsWith('private:')) {
        const recipient = currentChat.split(':')[1];
        socket.emit('typing', {
            recipient,
            isTyping: false
        });
    } else if (currentChat.startsWith('group:')) {
        const groupId = currentChat.split(':')[1];
        socket.emit('typingInGroup', {
            groupId,
            isTyping: false
        });
    }
    
    userTypingIndicator.textContent = '';
}

// -----------------------------------------------------
// Group Functions
// -----------------------------------------------------

function createGroup(e) {
    e.preventDefault();
    
    const name = groupNameInput.value.trim();
    
    if (!name) {
        alert('Please enter a group name');
        return;
    }
    
    if (selectedMembersList.length === 0) {
        alert('Please select at least one member');
        return;
    }
    
    console.log("Attempting to create group:", name);
    console.log("Selected members:", selectedMembersList);
    
    // Send request to create group
    fetch('/api/groups', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name,
            creator: currentUsername,
            members: selectedMembersList
        })
    })
    .then(response => {
        console.log("Group creation response status:", response.status);
        return response.json();
    })
    .then(data => {
        console.log("Group creation response:", data);
        if (data.success) {
            // Close modal
            closeCreateGroupModal();
            
            // Switch to new group
            switchChat(`group:${data.group.id}`);
            
            // Switch to groups tab
            switchTab('groups');
        } else {
            alert(data.message);
        }
    })
    .catch(err => {
        console.error('Error creating group:', err);
        alert('An error occurred. Please try again.');
    });
}

function searchMembers() {
    const query = memberSearch.value.trim().toLowerCase();
    
    if (!query) {
        renderMemberSearchResults([]);
        return;
    }
    
    // Filter users based on query, excluding current user and already selected members
    const filteredUsers = allUsers
        .filter(user => user.username !== currentUsername && !selectedMembersList.includes(user.username))
        .filter(user => user.username.toLowerCase().includes(query))
        .map(user => user.username);
    
    renderMemberSearchResults(filteredUsers);
}

function renderMemberSearchResults(results) {
    let html = '';
    
    results.forEach(username => {
        html += `<div class="member-result-item" data-username="${username}">${username}</div>`;
    });
    
    memberResults.innerHTML = html || '';
    
    // Add event listeners
    document.querySelectorAll('.member-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const username = item.dataset.username;
            addMemberToSelection(username);
            memberSearch.value = '';
            memberResults.innerHTML = '';
        });
    });
}

function addMemberToSelection(username) {
    // Check if already selected
    if (selectedMembersList.includes(username)) return;
    
    // Add to selected list
    selectedMembersList.push(username);
    
    // Add to UI
    const memberElement = document.createElement('div');
    memberElement.className = 'selected-member';
    memberElement.innerHTML = `
        ${username}
        <span class="remove-member" data-username="${username}">&times;</span>
    `;
    selectedMembers.appendChild(memberElement);
    
    // Add event listener to remove button
    memberElement.querySelector('.remove-member').addEventListener('click', () => {
        removeMemberFromSelection(username);
    });
}

function removeMemberFromSelection(username) {
    // Remove from selected list
    selectedMembersList = selectedMembersList.filter(name => name !== username);
    
    // Remove from UI
    const memberElement = document.querySelector(`.selected-member .remove-member[data-username="${username}"]`).parentNode;
    memberElement.remove();
}

// -----------------------------------------------------
// Filter Functions
// -----------------------------------------------------

function filterChats() {
    const query = searchChats.value.trim().toLowerCase();
    
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.chat-item-name').textContent.toLowerCase();
        if (name.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function filterUsers() {
    const query = searchUsers.value.trim().toLowerCase();
    
    document.querySelectorAll('.user-item').forEach(item => {
        const name = item.textContent.trim().toLowerCase();
        if (name.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function filterGroups() {
    const query = searchGroups.value.trim().toLowerCase();
    
    document.querySelectorAll('.group-item').forEach(item => {
        const name = item.querySelector('.group-item-name').textContent.toLowerCase();
        if (name.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// -----------------------------------------------------
// Message History Functions
// -----------------------------------------------------

// Function to fetch global message history
function fetchGlobalMessages() {
    socket.emit('getGlobalMessages');
}

// Function to fetch private message history
function fetchPrivateMessages(username) {
    if (!privateChats[username]) {
        privateChats[username] = [];
    }
    
    socket.emit('getPrivateMessages', username);
}

// -----------------------------------------------------
// API Functions
// -----------------------------------------------------

function fetchAllUsers() {
    fetch('/api/users')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                allUsers = data.users;
                updateUsersList();
            }
        })
        .catch(err => {
            console.error('Error fetching users:', err);
        });
}

// -----------------------------------------------------
// Helper Functions
// -----------------------------------------------------

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function logout() {
    // Remove username from localStorage
    localStorage.removeItem('chatUsername');
    
    // Redirect to login page
    window.location.href = '/login.html';
}

// Initialize the UI
updateChatList();
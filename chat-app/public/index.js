// Simple script to check login status on page load
document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('chatUsername');
    
    if (!username) {
        window.location.href = '/login.html';
    }
});
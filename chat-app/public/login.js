// DOM Elements
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const loginAlert = document.getElementById('login-alert');
const registerAlert = document.getElementById('register-alert');

// Tab switching
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    loginAlert.style.display = 'none';
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
    registerAlert.style.display = 'none';
});

// Login form submission
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showAlert(loginAlert, 'Please enter both username and password', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/users/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Store username in localStorage
            localStorage.setItem('chatUsername', username);
            
            // Redirect to chat page
            window.location.href = '/';
        } else {
            showAlert(loginAlert, data.message, 'error');
        }
    } catch (err) {
        showAlert(loginAlert, 'An error occurred. Please try again.', 'error');
        console.error(err);
    }
});

// Register form submission
formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    
    if (!username || !password || !confirmPassword) {
        showAlert(registerAlert, 'Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showAlert(registerAlert, 'Passwords do not match', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(registerAlert, 'Registration successful! You can now log in.', 'success');
            registerAlert.classList.add('success');
            
            // Clear the form
            document.getElementById('register-username').value = '';
            document.getElementById('register-password').value = '';
            document.getElementById('register-confirm-password').value = '';
            
            // Switch to login tab after successful registration
            setTimeout(() => {
                loginTab.click();
            }, 2000);
        } else {
            showAlert(registerAlert, data.message, 'error');
        }
    } catch (err) {
        showAlert(registerAlert, 'An error occurred. Please try again.', 'error');
        console.error(err);
    }
});

// Helper function to show alerts
function showAlert(element, message, type) {
    element.textContent = message;
    element.style.display = 'block';
    
    if (type === 'success') {
        element.classList.add('success');
    } else {
        element.classList.remove('success');
    }
}
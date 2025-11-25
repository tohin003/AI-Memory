const API_URL = 'https://ai-memory-ejtx.vercel.app'; // Production URL

const form = document.getElementById('auth-form');
const loginUsernameInput = document.getElementById('login-username');
const loginFields = document.getElementById('login-fields');
const signupEmailInput = document.getElementById('signup-email'); // Merged Input
const otpInput = document.getElementById('otp');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const sendOtpBtn = document.getElementById('send-otp-btn');
const submitBtn = document.getElementById('submit-btn');
const toggleLink = document.getElementById('toggle-mode');
const title = document.getElementById('auth-title');
const errorMsg = document.getElementById('error-msg');
const signupFields = document.getElementById('signup-fields');
const signupFields2 = document.getElementById('signup-fields-2');

let isLogin = true;

// Toggle Login/Signup Mode
toggleLink.addEventListener('click', () => {
    isLogin = !isLogin;
    title.textContent = isLogin ? 'Welcome Back' : 'Create Account';
    submitBtn.textContent = isLogin ? 'Sign In' : 'Sign Up';
    toggleLink.textContent = isLogin ? "Don't have an account? Sign Up" : 'Have an account? Sign In';
    errorMsg.style.display = 'none';

    if (isLogin) {
        loginFields.classList.remove('hidden');
        signupFields.classList.add('hidden');
        signupFields2.classList.add('hidden');

        loginUsernameInput.setAttribute('required', 'true');
        signupEmailInput.removeAttribute('required');
        otpInput.removeAttribute('required');
        confirmPasswordInput.removeAttribute('required');
    } else {
        loginFields.classList.add('hidden');
        signupFields.classList.remove('hidden');
        signupFields2.classList.remove('hidden');

        loginUsernameInput.removeAttribute('required');
        signupEmailInput.setAttribute('required', 'true');
        otpInput.setAttribute('required', 'true');
        confirmPasswordInput.setAttribute('required', 'true');
    }
});

// Send OTP Logic
sendOtpBtn.addEventListener('click', async () => {
    const email = signupEmailInput.value;
    if (!email || !email.includes('@')) {
        showError('Please enter a valid email to receive OTP.');
        return;
    }

    try {
        sendOtpBtn.disabled = true;
        sendOtpBtn.textContent = 'Sending...';

        const response = await fetch(`${API_URL}/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        if (response.ok) {
            alert(data.message); // "OTP sent" or "Check console"
            errorMsg.style.display = 'none';
        } else {
            showError(data.error || 'Failed to send OTP');
        }
    } catch (err) {
        showError('Network error. Is server running?');
    } finally {
        sendOtpBtn.disabled = false;
        sendOtpBtn.textContent = 'Send OTP';
    }
});

// Submit Form
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput.value;

    if (!isLogin) {
        // Signup Validation
        const email = signupEmailInput.value;
        // Use part before @ as username, or the whole email if they prefer
        const name = email.split('@')[0];
        const otp = otpInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!email.includes('@')) {
            showError('Please enter a valid email address.');
            return;
        }

        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        // Signup Request
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating Account...';

            const response = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, name, password, otp })
            });

            const data = await response.json();
            handleAuthResponse(response, data);
        } catch (err) {
            showError('Signup failed. Server error.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign Up';
        }

    } else {
        // Login Request
        const username = loginUsernameInput.value;

        try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';

            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) {
                alert("Login Failed: " + (data.error || 'Unknown error'));
                handleAuthResponse(response, data);
            } else {
                handleAuthResponse(response, data);
            }
        } catch (err) {
            alert('Login failed. Server error: ' + err.message);
            showError('Login failed. Server error.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    }
});

async function handleAuthResponse(response, data) {
    if (response.ok) {
        // Save token
        await chrome.storage.local.set({
            authToken: data.token,
            username: data.user.name || data.user.email,
            email: data.user.email // Store email explicitly
        });

        // Redirect to sidebar
        window.location.href = '../sidebar/sidebar.html';
    } else {
        showError(data.error || 'Authentication failed');
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
}

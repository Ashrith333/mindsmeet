// Firebase SDK - Modern Modular SDK
// Import Firebase functions
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBkEbvGk_kxL3d1IB2zgYFpbixUBJ8EV8c",
  authDomain: "mindsmeet-a8945.firebaseapp.com",
  projectId: "mindsmeet-a8945",
  storageBucket: "mindsmeet-a8945.firebasestorage.app",
  messagingSenderId: "273248409523",
  appId: "1:273248409523:web:88fc2d8eefacc665c8ddc6",
  measurementId: "G-H8QD41XT3P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Set persistence to LOCAL for better iOS Safari support
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Firebase persistence set to LOCAL');
  })
  .catch((error) => {
    console.error('Error setting persistence:', error);
  });

// Make auth available globally
window.firebaseAuth = auth;

// Function to check if email exists using createAuthUri
async function checkEmailExists(email) {
  const apiKey = 'AIzaSyBkEbvGk_kxL3d1IB2zgYFpbixUBJ8EV8c';
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`;

  const payload = {
    identifier: email,
    continueUri: "http://localhost"
  };

  try {
    console.log('🔍 Checking email existence for:', email);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log('🔍 Firebase API response:', data);
    
    // Check if the response indicates the user is registered
    if (data.registered === true) {
      console.log('✅ Email exists - user is registered');
      return true;
    } else if (data.registered === false) {
      console.log('❌ Email does not exist - user is not registered');
      return false;
    } else {
      // If we can't determine, try alternative method
      console.log('⚠️ Could not determine registration status, trying alternative method');
      return await checkEmailExistsAlternative(email);
    }
  } catch (error) {
    console.error('❌ Error checking email existence:', error);
    // Fallback to alternative method
    return await checkEmailExistsAlternative(email);
  }
}

// Alternative method to check if email exists
async function checkEmailExistsAlternative(email) {
  try {
    console.log('🔍 Trying alternative method to check email existence');
    
    // Try to sign in with a dummy password to see if account exists
    // This will fail with 'auth/wrong-password' if account exists, or 'auth/user-not-found' if it doesn't
    const dummyPassword = 'dummyPassword123!@#';
    
    try {
      await firebase.auth().signInWithEmailAndPassword(email, dummyPassword);
      // If we get here, the password was somehow correct (very unlikely)
      console.log('⚠️ Unexpected success with dummy password');
      return true;
    } catch (error) {
      console.log('🔍 Alternative method error code:', error.code);
      
      if (error.code === 'auth/wrong-password') {
        console.log('✅ Email exists (wrong password error)');
        return true;
      } else if (error.code === 'auth/user-not-found') {
        console.log('❌ Email does not exist (user not found error)');
        return false;
      } else if (error.code === 'auth/invalid-email') {
        console.log('❌ Invalid email format');
        return false;
      } else {
        console.log('⚠️ Unknown error, assuming email does not exist');
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Alternative method also failed:', error);
    // If all methods fail, assume email doesn't exist (safer for signup flow)
    return false;
  }
}

// Make function available globally
window.checkEmailExists = checkEmailExists;
window.checkEmailExistsAlternative = checkEmailExistsAlternative;

// This is the main function that runs when you click "Continue"
async function handleFormSubmit(event) {
  // 1. Prevent the form from submitting normally
  event.preventDefault();
  console.log("✅ Step 1: Form submission started.");
  console.log("🔍 Event object:", event);

  // 2. Get the email from the input field
  const emailInput = document.getElementById('identifier');
  const email = emailInput.value.trim();
  console.log(`✅ Step 2: Got email: ${email}`);

  // 3. Get the button to show loading status
  const submitButton = document.querySelector('button[type="submit"]');

  // 4. Validate the email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Please enter a valid email address.');
    console.error("❌ Error: Invalid email format.");
    resetButtonState(); // Reset button state on validation error
    return;
  }
  console.log("✅ Step 3: Email format is valid.");

  // 5. Show loading state on the button
  submitButton.disabled = true;
  submitButton.innerHTML = 'Checking...';
  console.log("✅ Step 4: UI changed to loading state.");

  // 6. Check if Firebase is available
  console.log("🔍 Checking Firebase availability...");
  console.log("🔍 window.firebaseAuth:", window.firebaseAuth);

  if (!window.firebaseAuth) {
    console.error("❌ CRITICAL: Firebase is not properly loaded!");
    alert("Firebase is not properly loaded. Please refresh the page and try again.");
    resetButtonState(); // Reset button state on Firebase error
    return;
  }

  // 7. Check network connectivity
  if (!navigator.onLine) {
    console.error("❌ CRITICAL: No internet connection!");
    alert("No internet connection. Please check your network and try again.");
    resetButtonState(); // Reset button state on network error
    return;
  }
  console.log("✅ Step 5: Network connection is available.");

  try {
    // 8. Check if email exists using checkEmailExists
    console.log("✅ Step 6: Checking if email exists...");
    console.log("🔍 About to call: checkEmailExists(" + email + ")");
    
    // Check if email exists using the proper Firebase method
    const isRegistered = await window.checkEmailExists(email);
    console.log("✅ Step 7: Firebase responded. User exists:", isRegistered);
    
    if (isRegistered) {
      // User exists - has at least one sign-in method
      console.log("✅ Step 8: User exists. Redirecting to SIGN IN page.");
      window.location.href = `verify.html?email=${encodeURIComponent(email)}&scenario=password`;
    } else {
      // User doesn't exist - no sign-in methods found
      console.log("✅ Step 8: User does not exist. Redirecting to SIGN UP page.");
      window.location.href = `verify.html?email=${encodeURIComponent(email)}&scenario=signup`;
    }
    
  } catch (error) {
    console.log("🔍 Firebase error response:", error);
    console.log("🔍 Error code:", error.code);
    console.log("🔍 Error message:", error.message);
    console.log("🔍 Full error object:", error);
    
    if (error.code === 'auth/invalid-email') {
      // Invalid email format
      console.error("❌ Error: Invalid email format.");
      alert('Please enter a valid email address.');
      resetButtonState(); // Reset button state on validation error
    } else if (error.code === 'auth/network-request-failed') {
      // Network error
      console.error("❌ Error: Network request failed.");
      alert('Network error. Please check your internet connection and try again.');
      resetButtonState(); // Reset button state on network error
    } else {
      // For any other error, assume email doesn't exist and go to signup
      console.log("✅ Step 7: Error occurred, assuming email does not exist. Redirecting to SIGN UP page.");
      console.log("🔍 Error details for debugging:", error);
      window.location.href = `verify.html?email=${encodeURIComponent(email)}&scenario=signup`;
    }
  }
}

// Global error handler to catch any unexpected issues
window.addEventListener('error', function(event) {
  console.error('🚨 UNEXPECTED GLOBAL ERROR:', event.message, event.error);
  resetButtonState(); // Reset button state on any global error
});

// Handle page visibility changes (when user navigates back/forward)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    console.log('🔄 Page became visible - resetting button state');
    resetButtonState();
  }
});

// Handle beforeunload event (when user is about to leave the page)
window.addEventListener('beforeunload', function() {
  console.log('🔄 User is leaving page - resetting button state');
  resetButtonState();
});

// Log to confirm the script file itself is loaded
console.log("🔑 Login page script loaded and ready.");

// This is the modern, reliable way to run code after the HTML page is loaded.
document.addEventListener('DOMContentLoaded', () => {
  // Reset button state when page loads
  resetButtonState();
  
  // Find the form on the page
  const loginForm = document.getElementById('login-form');
  
  if (loginForm) {
    // Attach our function to the form's 'submit' event
    loginForm.addEventListener('submit', handleFormSubmit);
    console.log("✅ Event listener attached to form submission.");
  } else {
    console.error("❌ CRITICAL: Could not find the login form on the page to attach event listener.");
  }
});

// Function to reset button state
function resetButtonState() {
  const submitButton = document.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Continue';
    console.log("✅ Button state reset to normal.");
  }
}

// Manual test function - you can run this in console
window.testEmail = async function(email) {
  console.log("🧪 MANUAL TEST: Checking email:", email);
  
  if (!window.firebaseAuth) {
    console.error("❌ Firebase not properly loaded!");
    return null;
  }
  
  try {
    const isRegistered = await window.checkEmailExists(email);
    console.log("🧪 RESULT:", isRegistered);
    console.log("🧪 Is valid:", isRegistered);
    
    if (isRegistered) {
      console.log("🧪 RESULT: Email exists - should go to PASSWORD page");
      return { exists: true, methods: true };
    } else {
      console.log("🧪 RESULT: Email does not exist - should go to SIGNUP page");
      return { exists: false, methods: false };
    }
  } catch (error) {
    console.log("🧪 ERROR:", error);
    console.log("🧪 Error code:", error.code);
    console.log("🧪 Error message:", error.message);
    console.log("🧪 RESULT: Error occurred, assuming email does not exist - should go to SIGNUP page");
    return { exists: false, methods: false };
  }
};

console.log("💡 To test manually, run: window.testEmail('your-email@example.com')"); 
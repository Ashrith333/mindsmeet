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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Set persistence to LOCAL for better iOS Safari support
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log('Firebase persistence set to LOCAL');
  })
  .catch((error) => {
    console.error('Error setting persistence:', error);
  });

let userProfileData = {};

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, checking authentication...');
  
  auth.onAuthStateChanged(function(user) {
    console.log('Auth state changed:', user ? 'User logged in' : 'No user');
    
    if (user && user.email) {
      console.log('User authenticated:', user.email);
      console.log('Email verified:', user.emailVerified);
      console.log('User ID:', user.uid);
      
      // Load user profile
      loadUserProfile();
      checkEmailVerificationStatus(user);
    } else {
      console.log('No user authenticated, redirecting to login');
      window.location.href = 'login.html';
    }
  });
});

// Check and display email verification status
function checkEmailVerificationStatus(user) {
  const verificationStatus = document.getElementById('emailVerificationStatus');
  const verificationIcon = document.getElementById('verificationIcon');
  const verificationText = document.getElementById('verificationText');
  const verificationMessage = document.getElementById('verificationMessage');
  const resendBtn = document.getElementById('resendVerificationBtn');

  if (!user.emailVerified) {
    // Show unverified status
    verificationStatus.classList.remove('hidden');
    verificationStatus.className = 'mb-6 p-4 rounded-lg border-2 border-yellow-200 bg-yellow-50';
    verificationIcon.className = 'w-5 h-5 text-yellow-600';
    verificationIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
    verificationText.textContent = 'Email Not Verified';
    verificationText.className = 'font-medium text-yellow-800';
    verificationMessage.textContent = 'Please verify your email address to access all features.';
    verificationMessage.className = 'text-sm mb-3 text-yellow-700';
    resendBtn.className = 'text-sm text-yellow-700 hover:text-yellow-800 font-medium';
    resendBtn.textContent = 'Resend verification email';
  } else {
    // Show verified status
    verificationStatus.classList.remove('hidden');
    verificationStatus.className = 'mb-6 p-4 rounded-lg border-2 border-green-200 bg-green-50';
    verificationIcon.className = 'w-5 h-5 text-green-600';
    verificationIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>';
    verificationText.textContent = 'Email Verified';
    verificationText.className = 'font-medium text-green-800';
    verificationMessage.textContent = 'Your email has been verified successfully!';
    verificationMessage.className = 'text-sm mb-3 text-green-700';
    resendBtn.style.display = 'none';
  }
}

// Resend verification email
async function resendVerificationEmail() {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert('Please sign in first to resend verification email');
      return;
    }

    const resendBtn = document.getElementById('resendVerificationBtn');
    const originalText = resendBtn.textContent;
    resendBtn.textContent = 'Sending...';
    resendBtn.disabled = true;

    console.log('Resending verification email to:', user.email);
    await user.sendEmailVerification();
    
    alert('Verification email sent! Please check your inbox and spam folder.');
    
    resendBtn.textContent = originalText;
    resendBtn.disabled = false;
    
  } catch (error) {
    console.error('Error sending verification email:', error);
    alert('Failed to send verification email. Please try again.');
    
    const resendBtn = document.getElementById('resendVerificationBtn');
    resendBtn.textContent = 'Resend verification email';
    resendBtn.disabled = false;
  }
}

// Load user profile
async function loadUserProfile() {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const userDoc = await db.collection('users').doc(user.email).get();
    if (!userDoc.exists) {
      window.location.href = 'profile-setup.html';
      return;
    }

    const userData = userDoc.data();
    
    // Check if essential profile data exists
    if (!userData.fullName || !userData.age) {
      window.location.href = 'profile-setup.html';
      return;
    }

    // Check if profile is complete enough to browse
    if (userData.fullName && userData.age && userData.gender && userData.datingPreferences) {
      console.log('Profile complete! Redirecting to browse page...');
      window.location.href = 'browse.html';
      return;
    }

    // Load profile data
    loadProfileData(userData);
    
    // Setup message notifications
    setupMessageNotifications();
    
  } catch (error) {
    console.error('Error loading user profile:', error);
    window.location.href = 'profile-setup.html';
  }
}

// Load profile data into the UI
function loadProfileData(userData) {
  console.log('Loading profile data:', userData);
  
  // Store user data globally
  userProfileData = userData;
  
  // Update profile display in welcome section
  const profileName = document.getElementById('profileName');
  const profileAge = document.getElementById('profileAge');
  const profileLocation = document.getElementById('profileLocation');
  const profileBio = document.getElementById('profileBio');
  const profileInterests = document.getElementById('profileInterests');
  
  if (profileName) profileName.textContent = userData.fullName || 'Not set';
  if (profileAge) profileAge.textContent = userData.age || 'Not set';
  if (profileLocation) profileLocation.textContent = userData.currentLocation || 'Not set';
  if (profileBio) profileBio.textContent = userData.bio || 'Not set';
  if (profileInterests) profileInterests.textContent = userData.interests || 'Not set';
  
  // Populate edit form with current data
  populateEditForm();
  
  // Display existing photos if they exist
  if (userData.photo1Url) {
    displayEditPhoto('photo1', 'editPhoto1Preview', 'editPhoto1Placeholder', 'editPhoto1Img', userData.photo1Url);
  }
  if (userData.photo2Url) {
    displayEditPhoto('photo2', 'editPhoto2Preview', 'editPhoto2Placeholder', 'editPhoto2Img', userData.photo2Url);
  }
}

// Setup message notifications
function setupMessageNotifications() {
  const user = auth.currentUser;
  if (!user) return;

  console.log('Setting up message notifications in home');

  // First, check for existing unread messages
  checkForUnreadMessages();

  // Listen for new conversations (messages)
  db.collection('conversations').where('participants', 'array-contains', user.email)
    .onSnapshot(snapshot => {
      console.log('Home: Conversation changes detected:', snapshot.docChanges().length);
      
      snapshot.docChanges().forEach(change => {
        console.log('Home: Change type:', change.type, 'Doc ID:', change.doc.id);
        
        if (change.type === 'modified') {
          const conversationData = change.doc.data();
          console.log('Home: Modified conversation data:', conversationData);
          
          // Check if this is a new message (not from current user, not system)
          if (conversationData.lastMessage && 
              conversationData.lastMessageSender && 
              conversationData.lastMessageSender !== 'system' &&
              conversationData.lastMessageSender !== user.email) {
            console.log('Home: New message detected:', change.doc.id);
            
            // Get sender's name for notification
            const otherUserEmail = conversationData.participants.find(email => email !== user.email);
            if (otherUserEmail) {
              db.collection('users').doc(otherUserEmail).get().then(userDoc => {
                if (userDoc.exists) {
                  const senderProfile = userDoc.data();
                  const senderName = senderProfile.fullName || otherUserEmail;
                  
                  // Update notification badge
                  updateMessageNotificationBadge(senderName, conversationData.lastMessage);
                }
              });
            }
          }
        }
      });
    });
}

// Check for unread messages
async function checkForUnreadMessages() {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const conversationsSnapshot = await db.collection('conversations')
      .where('participants', 'array-contains', user.email)
      .get();

    let hasUnreadMessages = false;
    let latestMessage = null;
    let latestSender = null;

    conversationsSnapshot.forEach(doc => {
      const conversationData = doc.data();
      
      // Check if there's a message not from current user
      if (conversationData.lastMessage && 
          conversationData.lastMessageSender && 
          conversationData.lastMessageSender !== user.email &&
          conversationData.lastMessageSender !== 'system') {
        
        hasUnreadMessages = true;
        
        // Track the latest message
        if (!latestMessage || conversationData.lastMessageTime > latestMessage.lastMessageTime) {
          latestMessage = conversationData;
          latestSender = conversationData.lastMessageSender;
        }
      }
    });

    if (hasUnreadMessages && latestMessage) {
      // Get sender's name
      const senderDoc = await db.collection('users').doc(latestSender).get();
      if (senderDoc.exists) {
        const senderProfile = senderDoc.data();
        const senderName = senderProfile.fullName || latestSender;
        updateMessageNotificationBadge(senderName, latestMessage.lastMessage);
      }
    }
  } catch (error) {
    console.error('Error checking for unread messages:', error);
  }
}

// Update message notification badge
function updateMessageNotificationBadge(senderName, message) {
  const messageIcon = document.querySelector('button[onclick="window.location.href=\'messages.html\'"]');
  if (messageIcon) {
    // Remove existing notification
    const existingNotification = messageIcon.querySelector('.notification-badge');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    // Add new notification
    const notification = document.createElement('div');
    notification.className = 'notification-badge absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center';
    notification.textContent = '1';
    notification.title = `New message from ${senderName}: ${message}`;
    
    messageIcon.style.position = 'relative';
    messageIcon.appendChild(notification);
  }
}

// Populate edit form with current data
function populateEditForm() {
  const editName = document.getElementById('editName');
  const editAge = document.getElementById('editAge');
  const editBio = document.getElementById('editBio');
  const editLocation = document.getElementById('editLocation');
  const editInterests = document.getElementById('editInterests');
  const editGender = document.getElementById('editGender');
  const editDatingPreferences = document.getElementById('editDatingPreferences');
  const editRelationshipStatus = document.getElementById('editRelationshipStatus');
  const editDatingIntentions = document.getElementById('editDatingIntentions');
  const editHeightFeet = document.getElementById('editHeightFeet');
  const editHeightInches = document.getElementById('editHeightInches');
  const editOccupation = document.getElementById('editOccupation');
  const editJobTitle = document.getElementById('editJobTitle');
  const editSchool = document.getElementById('editSchool');
  const editHighestDegree = document.getElementById('editHighestDegree');
  const editHometown = document.getElementById('editHometown');
  const editReligion = document.getElementById('editReligion');
  const editSmoking = document.getElementById('editSmoking');
  const editDrinking = document.getElementById('editDrinking');

  if (editName) editName.value = userProfileData.fullName || '';
  if (editAge) editAge.value = userProfileData.age || '';
  if (editBio) editBio.value = userProfileData.bio || '';
  if (editLocation) editLocation.value = userProfileData.currentLocation || '';
  if (editInterests) editInterests.value = userProfileData.interests || '';
  if (editGender) editGender.value = userProfileData.gender || '';
  if (editDatingPreferences) editDatingPreferences.value = userProfileData.datingPreferences || '';
  if (editRelationshipStatus) editRelationshipStatus.value = userProfileData.relationshipStatus || '';
  if (editDatingIntentions) editDatingIntentions.value = userProfileData.datingIntentions || '';
  if (editHeightFeet) editHeightFeet.value = userProfileData.heightFeet || '';
  if (editHeightInches) editHeightInches.value = userProfileData.heightInches || '';
  if (editOccupation) editOccupation.value = userProfileData.occupation || '';
  if (editJobTitle) editJobTitle.value = userProfileData.jobTitle || '';
  if (editSchool) editSchool.value = userProfileData.school || '';
  if (editHighestDegree) editHighestDegree.value = userProfileData.highestDegree || '';
  if (editHometown) editHometown.value = userProfileData.hometown || '';
  if (editReligion) editReligion.value = userProfileData.religion || '';
  if (editSmoking) editSmoking.value = userProfileData.smoking || '';
  if (editDrinking) editDrinking.value = userProfileData.drinking || '';
}

// Show edit profile modal
function showEditProfile() {
  const editModal = document.getElementById('editProfileModal');
  editModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// Hide edit profile modal
function hideEditProfile() {
  const editModal = document.getElementById('editProfileModal');
  editModal.classList.add('hidden');
  document.body.style.overflow = 'auto';
}

// Preview photo for edit
function previewEditPhoto(photoType, previewId, placeholderId, imgId, file) {
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);
  const img = document.getElementById(imgId);
  
  if (file && file.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      img.src = e.target.result;
      img.style.display = 'block';
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file.files[0]);
  }
}

// Display existing photo in edit form
function displayEditPhoto(photoType, previewId, placeholderId, imgId, photoUrl) {
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);
  const img = document.getElementById(imgId);
  
  if (photoUrl) {
    img.src = photoUrl;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  }
}

// Save profile changes
async function saveProfileChanges() {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert('Please sign in to save changes');
      return;
    }

    // Get form data
    const formData = {
      fullName: document.getElementById('editName').value.trim(),
      age: parseInt(document.getElementById('editAge').value),
      bio: document.getElementById('editBio').value.trim(),
      currentLocation: document.getElementById('editLocation').value.trim(),
      interests: document.getElementById('editInterests').value.trim(),
      gender: document.getElementById('editGender').value,
      datingPreferences: document.getElementById('editDatingPreferences').value,
      relationshipStatus: document.getElementById('editRelationshipStatus').value,
      datingIntentions: document.getElementById('editDatingIntentions').value,
      heightFeet: document.getElementById('editHeightFeet').value,
      heightInches: document.getElementById('editHeightInches').value,
      occupation: document.getElementById('editOccupation').value.trim(),
      jobTitle: document.getElementById('editJobTitle').value.trim(),
      school: document.getElementById('editSchool').value.trim(),
      highestDegree: document.getElementById('editHighestDegree').value,
      hometown: document.getElementById('editHometown').value.trim(),
      religion: document.getElementById('editReligion').value,
      smoking: document.getElementById('editSmoking').value,
      drinking: document.getElementById('editDrinking').value
    };

    // Validate required fields
    if (!formData.fullName || !formData.age) {
      alert('Name and age are required');
      return;
    }

    // Upload photos if selected
    const photo1File = document.getElementById('editPhoto1').files[0];
    const photo2File = document.getElementById('editPhoto2').files[0];

    if (photo1File) {
      const photo1Url = await uploadPhoto(photo1File, user.email, 'photo1');
      formData.photo1Url = photo1Url;
      formData.photo1FileName = photo1File.name;
    }

    if (photo2File) {
      const photo2Url = await uploadPhoto(photo2File, user.email, 'photo2');
      formData.photo2Url = photo2Url;
      formData.photo2FileName = photo2File.name;
    }

    // Update Firestore
    await db.collection('users').doc(user.email).update(formData);

    // Update local data
    Object.assign(userProfileData, formData);

    // Update UI
    loadProfileData(userProfileData);

    // Hide modal
    hideEditProfile();

    alert('Profile updated successfully!');

  } catch (error) {
    console.error('Error saving profile changes:', error);
    alert('Error saving changes. Please try again.');
  }
}

// Upload photo to Firebase Storage
async function uploadPhoto(file, userEmail, photoType) {
  const storageRef = storage.ref();
  const photoRef = storageRef.child(`profiles/${userEmail}/${photoType}_${Date.now()}_${file.name}`);
  
  const snapshot = await photoRef.put(file);
  const downloadURL = await snapshot.ref.getDownloadURL();
  
  return downloadURL;
}

// Sign out user
async function signOutUser() {
  try {
    await auth.signOut();
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Error signing out:', error);
    alert('Error signing out. Please try again.');
  }
}

// Switch tabs
function switchTab(tabName, buttonElement) {
  // Hide all tab content
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    content.classList.add('hidden');
  });

  // Remove active class from all nav buttons
  const navButtons = document.querySelectorAll('.nav-icon');
  navButtons.forEach(button => {
    button.classList.remove('active');
  });

  // Show selected tab content
  const selectedTab = document.getElementById(tabName + 'Tab');
  if (selectedTab) {
    selectedTab.classList.remove('hidden');
  }

  // Add active class to clicked button
  if (buttonElement) {
    buttonElement.classList.add('active');
  }
}

// Filter modal functions
function selectFilter(filterType) {
  // Implementation for filter selection
  console.log('Filter selected:', filterType);
}

function closeFilterModal() {
  const filterModal = document.getElementById('filterModal');
  filterModal.classList.add('hidden');
}

// At the end, attach needed functions to window:
window.showEditProfile = showEditProfile;
window.hideEditProfile = hideEditProfile;
window.previewEditPhoto = previewEditPhoto;
window.resendVerificationEmail = resendVerificationEmail;
window.saveProfileChanges = saveProfileChanges;
window.signOutUser = signOutUser;
window.switchTab = switchTab;
window.selectFilter = selectFilter;
window.closeFilterModal = closeFilterModal; 
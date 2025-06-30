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

// Check authentication on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('Browse page loaded, checking authentication...');
  
  auth.onAuthStateChanged(function(user) {
    console.log('Auth state changed:', user ? 'User logged in' : 'No user');
    
    if (user && user.email) {
      console.log('User authenticated:', user.email);
      console.log('Email verified:', user.emailVerified);
      
      // Check if user has complete profile
      checkUserProfile(user);
    } else {
      console.log('No user authenticated, redirecting to login');
      window.location.href = 'login.html';
    }
  });
});

// Check if user has complete profile
async function checkUserProfile(user) {
  try {
    console.log('Checking user profile completion...');
    
    const userDocRef = db.collection('users').doc(user.email);
    const userSnap = await userDocRef.get();
    
    if (userSnap.exists) {
      const userData = userSnap.data();
      console.log('User profile data:', userData);
      
      // Check if essential profile data exists
      if (!userData.fullName || !userData.age) {
        window.location.href = 'profile-setup.html';
        return;
      }
      
      // Check if profile has essential data (name, age, etc.)
      // For existing profiles, dating preferences is optional
      // For new profiles, it will be required during setup
      const hasEssentialData = userData.fullName && userData.age;
      console.log('Has essential profile data:', hasEssentialData);
      
      if (hasEssentialData) {
        // Profile exists with essential data - load browse data
        console.log('Profile complete, loading browse data');
        loadBrowseData();
        
        // Setup message notifications
        setupMessageNotifications();
      } else {
        // Profile exists but missing essential data - go to profile setup
        console.log('Profile incomplete, redirecting to profile setup');
        window.location.href = 'profile-setup.html?email=' + encodeURIComponent(user.email);
      }
    } else {
      // No profile data found - go to profile setup
      console.log('No profile data found, redirecting to profile setup');
      window.location.href = 'profile-setup.html?email=' + encodeURIComponent(user.email);
    }
  } catch (error) {
    console.error('Error checking user profile:', error);
    alert('Error checking profile. Please try again.');
  }
}

// Global variables for profile management
let profileQueue = [];
let currentProfileIndex = 0;

// Load browse data
async function loadBrowseData() {
  try {
    console.log('Loading browse data from Firebase...');
    
    // Show loading state
    const loadingState = document.getElementById('loadingState');
    const noProfilesState = document.getElementById('noProfilesState');
    const browseContainer = document.querySelector('.browse-container');
    
    loadingState.classList.remove('hidden');
    noProfilesState.classList.add('hidden');
    browseContainer.innerHTML = '';
    
    // Get current user to exclude them from browse results
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No current user found');
      return;
    }

    // Get current user's profile to check preferences
    const currentUserDoc = await db.collection('users').doc(currentUser.email).get();
    const currentUserData = currentUserDoc.data();
    
    console.log('Current user data:', currentUserData);
    
    // Fetch all user profiles except current user
    const usersSnapshot = await db.collection('users').get();
    
    // Clear existing content
    profileQueue = [];
    currentProfileIndex = 0;
    
    // Get current user's likes/dislikes to filter out already interacted profiles
    const likesSnapshot = await db.collection('likes').where('fromUser', '==', currentUser.email).get();
    const userInteractions = {};
    likesSnapshot.forEach(doc => {
      const likeData = doc.data();
      userInteractions[likeData.toUser] = likeData.status; // 'like' or 'dislike'
    });
    
    // Get existing conversations to filter out matched users
    const conversationsSnapshot = await db.collection('conversations').where('participants', 'array-contains', currentUser.email).get();
    const matchedUsers = new Set();
    conversationsSnapshot.forEach(doc => {
      const conversationData = doc.data();
      conversationData.participants.forEach(userEmail => {
        if (userEmail !== currentUser.email) {
          matchedUsers.add(userEmail);
        }
      });
    });
    
    console.log('User interactions:', userInteractions);
    console.log('Matched users:', Array.from(matchedUsers));
    
    // Filter and collect valid profiles
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const userEmail = doc.id;
      
      // Skip current user
      if (userEmail === currentUser.email) return;
      
      // Skip if already liked/disliked
      if (userInteractions[userEmail]) {
        console.log(`Skipping ${userInteractions[userEmail]} user:`, userEmail);
        return;
      }
      
      // Skip if already matched
      if (matchedUsers.has(userEmail)) {
        console.log('Skipping matched user:', userEmail);
        return;
      }
      
      // Check if profile has essential data
      if (userData.fullName && userData.age) {
        profileQueue.push({
          email: userEmail,
          data: userData
        });
      }
    });
    
    console.log(`Found ${profileQueue.length} valid profiles`);
    
    // Hide loading state
    loadingState.classList.add('hidden');
    
    // Show first profile or no profiles state
    if (profileQueue.length > 0) {
      showNextProfile();
    } else {
      noProfilesState.classList.remove('hidden');
    }
    
  } catch (error) {
    console.error('Error loading browse data:', error);
    loadingState.classList.add('hidden');
    noProfilesState.classList.remove('hidden');
  }
}

// Show the next profile in the queue
function showNextProfile() {
  if (currentProfileIndex >= profileQueue.length) {
    // No more profiles
    const browseContainer = document.querySelector('.browse-container');
    const noProfilesState = document.getElementById('noProfilesState');
    
    browseContainer.innerHTML = '';
    noProfilesState.classList.remove('hidden');
    return;
  }
  
  const profile = profileQueue[currentProfileIndex];
  const browseContainer = document.querySelector('.browse-container');
  
  // Create profile card
  const profileCard = createProfileCard(profile);
  browseContainer.innerHTML = '';
  browseContainer.appendChild(profileCard);
}

// Create a single profile card
function createProfileCard(profile) {
  const { email, data } = profile;
  
  // Get profile photos - handle both array format and individual field format
  let photos = [];
  
  // Check if photos exist as an array (newer format)
  if (data.photos && Array.isArray(data.photos)) {
    photos = data.photos;
  } else {
    // Check for individual photo fields (current format)
    if (data.photo1Url) {
      photos.push({ url: data.photo1Url, name: data.photo1FileName || 'Photo 1' });
    }
    if (data.photo2Url) {
      photos.push({ url: data.photo2Url, name: data.photo2FileName || 'Photo 2' });
    }
    // Add more photo fields if they exist
    for (let i = 3; i <= 6; i++) {
      const photoKey = `photo${i}Url`;
      if (data[photoKey]) {
        photos.push({ 
          url: data[photoKey], 
          name: data[`photo${i}FileName`] || `Photo ${i}` 
        });
      }
    }
  }
  
  // Debug logging for photo data
  console.log('🔍 Creating profile card for:', email);
  console.log('🔍 Photos found:', photos.length);
  console.log('🔍 Photos array:', photos);
  console.log('🔍 Full profile data keys:', Object.keys(data));
  
  // Calculate age from birth date if available
  let age = data.age;
  if (data.birthDate) {
    const birthDate = new Date(data.birthDate);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  }
  
  const card = document.createElement('div');
  card.className = 'profile-card';
  card.dataset.userEmail = email;
  
  // Build the continuous scrollable content
  let contentSections = [];
  
  // 1. First Photo
  if (photos.length > 0 && photos[0].url && photos[0].url.trim() !== '') {
    contentSections.push(`
      <img src="${photos[0].url}" class="w-full h-80 object-cover" alt="Profile" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
      <div class="w-full h-80 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center" style="display:none;">
        <svg class="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
        </svg>
      </div>
    `);
  } else {
    contentSections.push(`
      <div class="w-full h-80 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
        <svg class="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
        </svg>
      </div>
    `);
  }
  
  // 2. Profile Details
  let profileDetails = [];
  
  // Basic Info
  profileDetails.push(`
    <div class="px-6 py-4">
      <h2 class="text-3xl font-bold text-primary mb-2">${data.fullName}, ${age}</h2>
      <div class="text-secondary text-base mb-2">${data.currentLocation || 'Location not set'}</div>
      ${data.gender ? `<div class="text-secondary text-base mb-2">${data.gender}</div>` : ''}
      ${data.datingPreferences ? `<div class="text-secondary text-base mb-2">Interested in: ${data.datingPreferences}</div>` : ''}
    </div>
  `);
  
  // Bio
  if (data.bio) {
    profileDetails.push(`
      <div class="px-6 py-4">
        <h4 class="text-primary font-semibold mb-3 text-lg">About</h4>
        <p class="text-secondary text-base leading-relaxed">${data.bio}</p>
      </div>
    `);
  }
  
  // Personal Information
  let personalInfoItems = [];
  if (data.relationshipStatus) personalInfoItems.push(`<div class="mb-2"><span class="font-medium text-primary">Relationship Status:</span> <span class="text-secondary">${data.relationshipStatus}</span></div>`);
  if (data.datingIntentions) personalInfoItems.push(`<div class="mb-2"><span class="font-medium text-primary">Looking for:</span> <span class="text-secondary">${data.datingIntentions}</span></div>`);
  if (data.heightFeet && data.heightInches) personalInfoItems.push(`<div class="mb-2"><span class="font-medium text-primary">Height:</span> <span class="text-secondary">${data.heightFeet}'${data.heightInches}"</span></div>`);
  
  if (personalInfoItems.length > 0) {
    profileDetails.push(`
      <div class="px-6 py-4">
        <h4 class="text-primary font-semibold mb-3 text-lg">Personal Information</h4>
        <div class="space-y-2 text-base">
          ${personalInfoItems.join('')}
        </div>
      </div>
    `);
  }
  
  // Work & Education
  let workEducationItems = [];
  if (data.occupation) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Occupation:</span> <span class="text-secondary">${data.occupation}</span></div>`);
  if (data.jobTitle) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Job Title:</span> <span class="text-secondary">${data.jobTitle}</span></div>`);
  if (data.school) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">School/University:</span> <span class="text-secondary">${data.school}</span></div>`);
  if (data.highestDegree) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Highest Degree:</span> <span class="text-secondary">${data.highestDegree}</span></div>`);
  
  if (workEducationItems.length > 0) {
    profileDetails.push(`
      <div class="px-6 py-4">
        <h4 class="text-primary font-semibold mb-3 text-lg">Work & Education</h4>
        <div class="space-y-2 text-base">
          ${workEducationItems.join('')}
        </div>
      </div>
    `);
  }
  
  // Location
  let locationItems = [];
  if (data.currentLocation) locationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Current Location:</span> <span class="text-secondary">${data.currentLocation}</span></div>`);
  if (data.hometown) locationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Hometown:</span> <span class="text-secondary">${data.hometown}</span></div>`);
  
  if (locationItems.length > 0) {
    profileDetails.push(`
      <div class="px-6 py-4">
        <h4 class="text-primary font-semibold mb-3 text-lg">Location</h4>
        <div class="space-y-2 text-base">
          ${locationItems.join('')}
        </div>
      </div>
    `);
  }
  
  // Interests
  if (data.interests) {
    const interestTags = data.interests.split(',').map(interest => 
      `<span class="bg-blue-50 text-primary px-3 py-1 rounded-full text-sm">${interest.trim()}</span>`
    ).join('');
    
    profileDetails.push(`
      <div class="px-6 py-4">
        <h4 class="text-primary font-semibold mb-3 text-lg">Interests</h4>
        <div class="flex flex-wrap gap-2">
          ${interestTags}
        </div>
      </div>
    `);
  }
  
  // Add profile details to content sections
  contentSections.push(profileDetails.join(''));
  
  // 3. Second Image (if available)
  if (photos.length > 1 && photos[1].url && photos[1].url.trim() !== '') {
    contentSections.push(`
      <img src="${photos[1].url}" class="w-full h-80 object-cover" alt="Profile photo 2" onerror="this.style.display='none';">
    `);
  }
  
  // 4. Third Image (if available)
  if (photos.length > 2 && photos[2].url && photos[2].url.trim() !== '') {
    contentSections.push(`
      <img src="${photos[2].url}" class="w-full h-80 object-cover" alt="Profile photo 3" onerror="this.style.display='none';">
    `);
  }
  
  // Set the card HTML with continuous scrollable content
  card.innerHTML = `
    <div class="flex flex-col h-full w-full">
      <div class="flex-1 overflow-y-auto" style="padding-bottom: 120px;">
        ${contentSections.join('')}
      </div>
    </div>
  `;
  
  return card;
}

// Handle like action
async function handleLike(userEmail) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No current user found');
      return;
    }

    console.log(`Liking user: ${userEmail}`);
    
    // Create or update like document
    const likeRef = db.collection('likes').doc(`${currentUser.email}_${userEmail}`);
    await likeRef.set({
      fromUser: currentUser.email,
      toUser: userEmail,
      status: 'like',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Remove current profile from view with animation
    removeProfileFromBrowse(userEmail);
    
    // Check if it's a match (other user also liked current user)
    await checkForMatch(userEmail);
    
    // Show next profile
    currentProfileIndex++;
    setTimeout(() => {
      showNextProfile();
    }, 300);
    
  } catch (error) {
    console.error('Error liking user:', error);
    alert('Error liking user. Please try again.');
  }
}

// Handle dislike action
async function handleDislike(userEmail) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No current user found');
      return;
    }

    console.log(`Disliking user: ${userEmail}`);
    
    // Create or update like document
    const likeRef = db.collection('likes').doc(`${currentUser.email}_${userEmail}`);
    await likeRef.set({
      fromUser: currentUser.email,
      toUser: userEmail,
      status: 'dislike',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Remove current profile from view with animation
    removeProfileFromBrowse(userEmail);
    
    // Show next profile
    currentProfileIndex++;
    setTimeout(() => {
      showNextProfile();
    }, 300);
    
  } catch (error) {
    console.error('Error disliking user:', error);
    alert('Error disliking user. Please try again.');
  }
}

// Remove profile from browse view with animation
function removeProfileFromBrowse(userEmail) {
  const profileCard = document.querySelector(`[data-user-email="${userEmail}"]`);
  if (profileCard) {
    profileCard.style.transform = 'translateX(100%)';
    profileCard.style.opacity = '0';
    setTimeout(() => {
      profileCard.remove();
    }, 300);
  }
}

// Check for match
async function checkForMatch(userEmail) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Check if the other user also liked current user
    const otherUserLikeRef = db.collection('likes').doc(`${userEmail}_${currentUser.email}`);
    const otherUserLikeDoc = await otherUserLikeRef.get();
    
    if (otherUserLikeDoc.exists && otherUserLikeDoc.data().status === 'like') {
      console.log('🎉 It\'s a match!');
      
      // Create conversation
      await createConversation(userEmail);
      
      // Show match notification
      showMatchNotification(userEmail);
    }
  } catch (error) {
    console.error('Error checking for match:', error);
  }
}

// Create conversation
async function createConversation(otherUserEmail) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const conversationRef = db.collection('conversations').doc();
    await conversationRef.set({
      participants: [currentUser.email, otherUserEmail],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessage: 'You matched! Start a conversation.',
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageSender: 'system'
    });
    
    console.log('Conversation created for match');
  } catch (error) {
    console.error('Error creating conversation:', error);
  }
}

// Show match notification
async function showMatchNotification(otherUserEmail) {
  try {
    // Get other user's profile data
    const otherUserDoc = await db.collection('users').doc(otherUserEmail).get();
    const otherUserData = otherUserDoc.data();
    const otherUserName = otherUserData.fullName || otherUserEmail;
    
    // Create match notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.innerHTML = `
      <div class="flex items-center space-x-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
        </svg>
        <span>It's a match with ${otherUserName}!</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
    
  } catch (error) {
    console.error('Error showing match notification:', error);
  }
}

// Setup message notifications
function setupMessageNotifications() {
  const user = auth.currentUser;
  if (!user) return;

  console.log('Setting up message notifications in browse');

  // Listen for new conversations (messages)
  db.collection('conversations').where('participants', 'array-contains', user.email)
    .onSnapshot(snapshot => {
      console.log('Browse: Conversation changes detected:', snapshot.docChanges().length);
      
      snapshot.docChanges().forEach(change => {
        console.log('Browse: Change type:', change.type, 'Doc ID:', change.doc.id);
        
        if (change.type === 'modified') {
          const conversationData = change.doc.data();
          console.log('Browse: Modified conversation data:', conversationData);
          
          // Check if this is a new message (not from current user, not system)
          if (conversationData.lastMessage && 
              conversationData.lastMessageSender && 
              conversationData.lastMessageSender !== 'system' &&
              conversationData.lastMessageSender !== user.email) {
            console.log('Browse: New message detected:', change.doc.id);
            
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

// Filter modal functions
function openFilterModal() {
  const filterModal = document.getElementById('filterModal');
  if (filterModal) {
    filterModal.classList.remove('hidden');
  }
}

function selectFilter(filterType) {
  // Implementation for filter selection
  console.log('Filter selected:', filterType);
  closeFilterModal();
}

function closeFilterModal() {
  const filterModal = document.getElementById('filterModal');
  if (filterModal) {
    filterModal.classList.add('hidden');
  }
}

// At the end, attach needed functions to window:
window.handleLike = handleLike;
window.handleDislike = handleDislike;
window.closeFilterModal = closeFilterModal;
window.selectFilter = selectFilter;
window.openFilterModal = openFilterModal;
window.loadBrowseData = loadBrowseData;

// Floating like button handler
window.floatingLike = function() {
  if (profileQueue && profileQueue.length > 0 && profileQueue[currentProfileIndex]) {
    handleLike(profileQueue[currentProfileIndex].email);
  }
};

// Floating dislike button handler
window.floatingDislike = function() {
  if (profileQueue && profileQueue.length > 0 && profileQueue[currentProfileIndex]) {
    handleDislike(profileQueue[currentProfileIndex].email);
  }
}; 
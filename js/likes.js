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
window.addEventListener('DOMContentLoaded', function() {
  console.log('Likes page loaded, checking authentication...');
  auth.onAuthStateChanged(function(user) {
    console.log('Auth state changed:', user ? 'User logged in' : 'No user');
    if (user && user.email) {
      console.log('User authenticated:', user.email);
      console.log('Email verified:', user.emailVerified);
      checkUserProfile(user);
    } else {
      console.log('No user authenticated, redirecting to login');
      window.location.href = 'login.html';
    }
  });
});

async function checkUserProfile(user) {
  try {
    console.log('Checking user profile completion...');
    const userDocRef = db.collection('users').doc(user.email);
    const userSnap = await userDocRef.get();
    if (userSnap.exists) {
      const userData = userSnap.data();
      console.log('User profile data:', userData);
      if (!userData.fullName || !userData.age) {
        window.location.href = 'profile-setup.html';
        return;
      }
      const hasEssentialData = userData.fullName && userData.age;
      console.log('Has essential profile data:', hasEssentialData);
      if (hasEssentialData) {
        console.log('Profile complete, loading likes');
        loadLikes();
        setupMessageNotifications();
      } else {
        console.log('Profile incomplete, redirecting to profile setup');
        window.location.href = 'profile-setup.html?email=' + encodeURIComponent(user.email);
      }
    } else {
      console.log('No profile data found, redirecting to profile setup');
      window.location.href = 'profile-setup.html?email=' + encodeURIComponent(user.email);
    }
  } catch (error) {
    console.error('Error checking user profile:', error);
    alert('Error checking profile. Please try again.');
  }
}

async function loadLikes() {
  try {
    console.log('Loading likes...');
    const user = auth.currentUser;
    if (!user) return;
    const likesSnapshot = await db.collection('likes').where('toUser', '==', user.email).where('status', '==', 'like').get();
    const likesGrid = document.getElementById('likesGrid');
    const emptyState = document.getElementById('emptyState');
    likesGrid.innerHTML = '';
    let likesFound = 0;
    const usersSnapshot = await db.collection('users').get();
    const userProfiles = {};
    usersSnapshot.forEach(doc => {
      userProfiles[doc.id] = doc.data();
    });
    // Store userProfiles globally for modal access (must be set before rendering cards)
    window._likesUserProfiles = userProfiles;
    const conversationsSnapshot = await db.collection('conversations').where('participants', 'array-contains', user.email).get();
    const matchedUsers = new Set();
    conversationsSnapshot.forEach(doc => {
      const conversationData = doc.data();
      conversationData.participants.forEach(userEmail => {
        if (userEmail !== user.email) {
          matchedUsers.add(userEmail);
        }
      });
    });
    const currentUserLikesSnapshot = await db.collection('likes').where('fromUser', '==', user.email).get();
    const currentUserLikes = {};
    currentUserLikesSnapshot.forEach(doc => {
      const likeData = doc.data();
      currentUserLikes[likeData.toUser] = likeData.status;
    });
    console.log('Matched users:', Array.from(matchedUsers));
    console.log('Current user likes:', currentUserLikes);
    // Collect likes into an array for sorting
    let likesArray = [];
    likesSnapshot.forEach(doc => {
      const likeData = doc.data();
      likeData._docId = doc.id;
      likesArray.push(likeData);
    });
    // Sort likes by timestamp ascending (oldest first)
    likesArray.sort((a, b) => {
      const aTime = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate().getTime() : 0;
      const bTime = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate().getTime() : 0;
      return aTime - bTime;
    });
    likesArray.forEach(likeData => {
      const likerEmail = likeData.fromUser;
      const likerProfile = userProfiles[likerEmail];
      if (matchedUsers.has(likerEmail)) {
        console.log('Skipping matched user from likes:', likerEmail);
        return;
      }
      if (currentUserLikes[likerEmail]) {
        console.log(`Skipping user that current user has already ${currentUserLikes[likerEmail]}:`, likerEmail);
        return;
      }
      if (likerProfile && likerProfile.fullName && likerProfile.age) {
        likesFound++;
        let photos = [];
        if (likerProfile.photos && Array.isArray(likerProfile.photos)) {
          photos = likerProfile.photos;
        } else {
          if (likerProfile.photo1Url) {
            photos.push({ url: likerProfile.photo1Url, name: likerProfile.photo1FileName || 'Photo 1' });
          }
          if (likerProfile.photo2Url) {
            photos.push({ url: likerProfile.photo2Url, name: likerProfile.photo2FileName || 'Photo 2' });
          }
          for (let i = 3; i <= 6; i++) {
            const photoKey = `photo${i}Url`;
            if (likerProfile[photoKey]) {
              photos.push({
                url: likerProfile[photoKey],
                name: likerProfile[`photo${i}FileName`] || `Photo ${i}`
              });
            }
          }
        }
        const mainPhoto = (photos.length > 0 && photos[0].url) ? photos[0].url : 'https://randomuser.me/api/portraits/lego/1.jpg';
        let age = likerProfile.age;
        if (likerProfile.birthDate) {
          const birthDate = new Date(likerProfile.birthDate);
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }
        const likeCard = document.createElement('div');
        likeCard.className = 'like-card bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer relative';
        likeCard.dataset.userEmail = likerEmail;
        likeCard.innerHTML = `
          <div class="relative">
            <img src="${mainPhoto}" class="w-full h-48 object-cover" alt="Profile">
            <div class="flex justify-between items-center w-full px-4 py-2 absolute left-0 right-0 bottom-0 z-10">
              <button onclick="event.stopPropagation(); window.handleDislikeFromLikes('${likerEmail}')" class="bg-red-500 shadow-md rounded-full w-10 h-10 flex items-center justify-center hover:bg-red-600 transition-all" style="outline:none;">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
              <button onclick="event.stopPropagation(); window.handleLikeFromLikes('${likerEmail}')" class="bg-blue-500 shadow-md rounded-full w-10 h-10 flex items-center justify-center hover:bg-blue-600 transition-all" style="outline:none;">
                <svg class="w-5 h-5 text-white" fill="currentColor" stroke="currentColor" stroke-width="0" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="p-3">
            <h3 class="font-semibold text-primary text-sm">${likerProfile.fullName}, ${age}</h3>
            <p class="text-xs text-gray-600 mt-1">${likerProfile.currentLocation || 'Location not set'}</p>
            <p class="text-xs text-green-600 mt-1 font-medium">Liked you ${formatTimeAgo(likeData.timestamp)}</p>
          </div>
        `;
        likeCard.addEventListener('click', function() {
          handleLikeCardClick(likerEmail);
        });
        likesGrid.appendChild(likeCard);
      }
    });
    if (likesFound === 0) {
      likesGrid.classList.add('hidden');
      emptyState.classList.remove('hidden');
    } else {
      likesGrid.classList.remove('hidden');
      emptyState.classList.add('hidden');
    }
    console.log(`Loaded ${likesFound} likes (excluding ${matchedUsers.size} matched users and ${Object.keys(currentUserLikes).length} already interacted users)`);
  } catch (error) {
    console.error('Error loading likes:', error);
    const likesGrid = document.getElementById('likesGrid');
    const emptyState = document.getElementById('emptyState');
    likesGrid.classList.add('hidden');
    emptyState.classList.remove('hidden');
    const emptyStateTitle = emptyState.querySelector('h3');
    const emptyStateDesc = emptyState.querySelector('p');
    if (emptyStateTitle) emptyStateTitle.textContent = 'Error loading likes';
    if (emptyStateDesc) emptyStateDesc.textContent = 'Please try again later';
  }
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'recently';
  const now = new Date();
  const time = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diffInSeconds = Math.floor((now - time) / 1000);
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

function handleLikeCardClick(userEmail) {
  // Find the profile data for this user
  const userProfiles = window._likesUserProfiles || {};
  const likerProfile = userProfiles[userEmail];
  if (!likerProfile) return;

  // Gather photos (same logic as card)
  let photos = [];
  if (likerProfile.photos && Array.isArray(likerProfile.photos)) {
    photos = likerProfile.photos;
  } else {
    if (likerProfile.photo1Url) {
      photos.push({ url: likerProfile.photo1Url, name: likerProfile.photo1FileName || 'Photo 1' });
    }
    if (likerProfile.photo2Url) {
      photos.push({ url: likerProfile.photo2Url, name: likerProfile.photo2FileName || 'Photo 2' });
    }
    for (let i = 3; i <= 6; i++) {
      const photoKey = `photo${i}Url`;
      if (likerProfile[photoKey]) {
        photos.push({
          url: likerProfile[photoKey],
          name: likerProfile[`photo${i}FileName`] || `Photo ${i}`
        });
      }
    }
  }
  const mainPhoto = (photos.length > 0 && photos[0].url) ? photos[0].url : 'https://randomuser.me/api/portraits/lego/1.jpg';

  // Calculate age from birth date if available
  let age = likerProfile.age;
  if (likerProfile.birthDate) {
    const birthDate = new Date(likerProfile.birthDate);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  }

  // Build profile details sections (like browse)
  let profileDetails = [];
  profileDetails.push(`
    <div class="px-6 py-4">
      <h2 class="text-3xl font-bold text-primary mb-2">${likerProfile.fullName || ''}${age ? ', ' + age : ''}</h2>
      <div class="text-secondary text-base mb-2">${likerProfile.currentLocation || 'Location not set'}</div>
      ${likerProfile.gender ? `<div class="text-secondary text-base mb-2">${likerProfile.gender}</div>` : ''}
      ${likerProfile.datingPreferences ? `<div class="text-secondary text-base mb-2">Interested in: ${likerProfile.datingPreferences}</div>` : ''}
    </div>
  `);
  if (likerProfile.bio) {
    profileDetails.push(`
      <div class="px-6 py-4">
        <h4 class="text-primary font-semibold mb-3 text-lg">About</h4>
        <p class="text-secondary text-base leading-relaxed">${likerProfile.bio}</p>
      </div>
    `);
  }
  let personalInfoItems = [];
  if (likerProfile.relationshipStatus) personalInfoItems.push(`<div class="mb-2"><span class="font-medium text-primary">Relationship Status:</span> <span class="text-secondary">${likerProfile.relationshipStatus}</span></div>`);
  if (likerProfile.datingIntentions) personalInfoItems.push(`<div class="mb-2"><span class="font-medium text-primary">Looking for:</span> <span class="text-secondary">${likerProfile.datingIntentions}</span></div>`);
  if (likerProfile.heightFeet && likerProfile.heightInches) personalInfoItems.push(`<div class="mb-2"><span class="font-medium text-primary">Height:</span> <span class="text-secondary">${likerProfile.heightFeet}'${likerProfile.heightInches}"</span></div>`);
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
  let workEducationItems = [];
  if (likerProfile.occupation) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Occupation:</span> <span class="text-secondary">${likerProfile.occupation}</span></div>`);
  if (likerProfile.jobTitle) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Job Title:</span> <span class="text-secondary">${likerProfile.jobTitle}</span></div>`);
  if (likerProfile.school) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">School/University:</span> <span class="text-secondary">${likerProfile.school}</span></div>`);
  if (likerProfile.highestDegree) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Highest Degree:</span> <span class="text-secondary">${likerProfile.highestDegree}</span></div>`);
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
  let locationItems = [];
  if (likerProfile.currentLocation) locationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Current Location:</span> <span class="text-secondary">${likerProfile.currentLocation}</span></div>`);
  if (likerProfile.hometown) locationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Hometown:</span> <span class="text-secondary">${likerProfile.hometown}</span></div>`);
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
  if (likerProfile.interests) {
    const interestTags = likerProfile.interests.split(',').map(interest => 
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

  // Additional photos
  let additionalPhotos = '';
  if (photos.length > 1) {
    for (let i = 1; i < photos.length; i++) {
      if (photos[i].url && photos[i].url.trim() !== '') {
        additionalPhotos += `<img src="${photos[i].url}" class="w-full h-80 object-cover" alt="Profile photo ${i+1}" onerror="this.style.display='none';">`;
      }
    }
  }

  // Modal content with scrollable area and fixed action buttons
  const modalContent = `
    <div class="flex flex-col h-full w-full">
      <div class="flex-1 overflow-y-auto" style="max-height:100%;">
        <img src="${mainPhoto}" class="w-full h-80 object-cover" alt="Profile Photo">
        ${profileDetails.join('')}
        ${additionalPhotos}
      </div>
      <div class="action-buttons fixed left-0 right-0 bottom-0 flex gap-4 justify-center p-4 z-20" style="background:linear-gradient(to top,rgba(255,255,255,0.95) 80%,rgba(255,255,255,0.1) 100%);">
        <button onclick="window.handleDislikeFromLikes('${userEmail}')" class="bg-red-500 shadow-md rounded-full w-12 h-12 flex items-center justify-center hover:bg-red-600 transition-all" style="outline:none;">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
        <button onclick="window.handleLikeFromLikes('${userEmail}')" class="bg-blue-500 shadow-md rounded-full w-12 h-12 flex items-center justify-center hover:bg-blue-600 transition-all" style="outline:none;">
          <svg class="w-6 h-6 text-white" fill="currentColor" stroke="currentColor" stroke-width="0" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  const modal = document.getElementById('profileModal');
  const modalContentDiv = document.getElementById('profileModalContent');
  if (modal && modalContentDiv) {
    modalContentDiv.innerHTML = modalContent;
    modal.classList.remove('hidden');
  }
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.add('hidden');
}
window.closeProfileModal = closeProfileModal;

async function handleLikeFromLikes(userEmail) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No current user found');
      return;
    }
    console.log(`Liking back user: ${userEmail}`);
    const likeRef = db.collection('likes').doc(`${currentUser.email}_${userEmail}`);
    await likeRef.set({
      fromUser: currentUser.email,
      toUser: userEmail,
      status: 'like',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    await checkForMatchFromLikes(userEmail);
    removeLikeCard(userEmail);
  } catch (error) {
    console.error('Error liking user from likes:', error);
    alert('Error liking user. Please try again.');
  }
}

async function handleDislikeFromLikes(userEmail) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No current user found');
      return;
    }
    console.log(`Disliking user from likes: ${userEmail}`);
    const likeRef = db.collection('likes').doc(`${currentUser.email}_${userEmail}`);
    await likeRef.set({
      fromUser: currentUser.email,
      toUser: userEmail,
      status: 'dislike',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    removeLikeCard(userEmail);
  } catch (error) {
    console.error('Error disliking user from likes:', error);
    alert('Error disliking user. Please try again.');
  }
}

async function checkForMatchFromLikes(userEmail) {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const otherUserLikeRef = db.collection('likes').doc(`${userEmail}_${currentUser.email}`);
    const otherUserLikeDoc = await otherUserLikeRef.get();
    if (otherUserLikeDoc.exists && otherUserLikeDoc.data().status === 'like') {
      console.log('Match found from likes section!');
      const matchRef = db.collection('matches').doc(`${currentUser.email}_${userEmail}`);
      await matchRef.set({
        users: [currentUser.email, userEmail].sort(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'active'
      });
      await createConversationFromLikes(currentUser.email, userEmail);
      showMatchNotificationFromLikes(userEmail);
    }
  } catch (error) {
    console.error('Error checking for match from likes:', error);
  }
}

async function createConversationFromLikes(user1Email, user2Email) {
  try {
    const conversationId = [user1Email, user2Email].sort().join('_');
    const conversationRef = db.collection('conversations').doc(conversationId);
    const conversationDoc = await conversationRef.get();
    if (!conversationDoc.exists) {
      await conversationRef.set({
        participants: [user1Email, user2Email].sort(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessage: null,
        lastMessageTime: null,
        lastMessageSender: 'system'
      });
      const messageRef = conversationRef.collection('messages').doc();
      await messageRef.set({
        sender: 'system',
        text: 'You matched! Start a conversation! 💕',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'system'
      });
      await conversationRef.update({
        lastMessage: 'You matched! Start a conversation! 💕',
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageSender: 'system'
      });
      console.log('Conversation created for match from likes:', conversationId);
    }
  } catch (error) {
    console.error('Error creating conversation from likes:', error);
  }
}

function showMatchNotificationFromLikes(userEmail) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce';
  notification.innerHTML = `
    <div class="flex items-center space-x-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
      </svg>
      <span class="font-medium">It's a match! 🎉</span>
    </div>
  `;
  document.body.appendChild(notification);
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

function removeLikeCard(userEmail) {
  const card = document.querySelector(`[data-user-email="${userEmail}"]`);
  if (card) {
    card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
    card.style.opacity = '0';
    card.style.transform = 'translateX(-100%)';
    setTimeout(() => {
      if (card.parentNode) {
        card.parentNode.removeChild(card);
      }
      const remainingCards = document.querySelectorAll('.like-card');
      if (remainingCards.length === 0) {
        const likesGrid = document.getElementById('likesGrid');
        const emptyState = document.getElementById('emptyState');
        likesGrid.classList.add('hidden');
        emptyState.classList.remove('hidden');
      }
    }, 300);
  }
}

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
    if (!userData.fullName || !userData.age) {
      window.location.href = 'profile-setup.html';
      return;
    }
    loadLikes();
    setupMessageNotifications();
  } catch (error) {
    console.error('Error loading user profile:', error);
    window.location.href = 'profile-setup.html';
  }
}

function setupMessageNotifications() {
  const user = auth.currentUser;
  if (!user) return;
  console.log('Setting up message notifications in likes');
  checkForUnreadMessages();
  db.collection('conversations').where('participants', 'array-contains', user.email)
    .onSnapshot(snapshot => {
      console.log('Likes: Conversation changes detected:', snapshot.docChanges().length);
      snapshot.docChanges().forEach(change => {
        console.log('Likes: Change type:', change.type, 'Doc ID:', change.doc.id);
        if (change.type === 'modified') {
          const conversationData = change.doc.data();
          console.log('Likes: Modified conversation data:', conversationData);
          if (conversationData.lastMessage && 
              conversationData.lastMessageSender && 
              conversationData.lastMessageSender !== 'system' &&
              conversationData.lastMessageSender !== user.email) {
            console.log('Likes: New message detected:', change.doc.id);
            const otherUserEmail = conversationData.participants.find(email => email !== user.email);
            if (otherUserEmail) {
              db.collection('users').doc(otherUserEmail).get().then(userDoc => {
                if (userDoc.exists) {
                  const senderProfile = userDoc.data();
                  setTimeout(() => {
                    checkForUnreadMessages();
                  }, 100);
                  console.log('Likes: Checking unread messages instead of setting blue dot');
                }
              });
            }
          }
        }
      });
      setTimeout(() => {
        checkForUnreadMessages();
      }, 100);
    }, error => {
      console.error('Error setting up message notifications:', error);
    });
}

async function checkForUnreadMessages() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    console.log('Checking for unread messages...');
    const conversationsSnapshot = await db.collection('conversations').where('participants', 'array-contains', user.email).get();
    let hasUnread = false;
    conversationsSnapshot.forEach(doc => {
      const conversationData = doc.data();
      if (conversationData.lastMessage && 
          conversationData.lastMessageSender && 
          conversationData.lastMessageSender !== 'system' &&
          conversationData.lastMessageSender !== user.email) {
        const readBy = conversationData.readBy || {};
        const lastMessageTime = conversationData.lastMessageTime;
        const userReadTime = readBy[user.email];
        const isUnread = !userReadTime || 
                        (lastMessageTime && userReadTime.toDate && lastMessageTime.toDate && 
                         userReadTime.toDate() < lastMessageTime.toDate());
        if (isUnread) {
          hasUnread = true;
          console.log('Found unread message in conversation:', doc.id);
        }
      }
    });
    console.log('Unread messages found:', hasUnread);
    updateMessagesIndicator(hasUnread);
  } catch (error) {
    console.error('Error checking for unread messages:', error);
  }
}

function updateMessagesIndicator(hasUnread) {
  console.log('Likes: Updating messages indicator, hasUnread:', hasUnread);
  const messagesNavButton = document.querySelector('[onclick*="messages.html"]');
  console.log('Likes: Messages nav button found:', !!messagesNavButton);
  if (messagesNavButton) {
    messagesNavButton.style.position = 'relative';
    const existingIndicator = messagesNavButton.querySelector('.unread-indicator');
    console.log('Likes: Existing indicator found:', !!existingIndicator);
    if (hasUnread && !existingIndicator) {
      const indicator = document.createElement('div');
      indicator.className = 'unread-indicator absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full z-10';
      messagesNavButton.appendChild(indicator);
      console.log('Likes: Blue dot indicator added');
    } else if (!hasUnread && existingIndicator) {
      existingIndicator.remove();
      console.log('Likes: Blue dot indicator removed');
    }
  }
  if (hasUnread) {
    document.title = 'Likes (1) - Minds Meet';
  } else {
    document.title = 'Likes - Minds Meet';
  }
}

function isUnread(conversationData) {
  const currentUser = auth.currentUser;
  if (!currentUser || !conversationData.lastMessageSender) return false;
  const isFromOtherPerson = conversationData.lastMessageSender !== 'system' && 
                           conversationData.lastMessageSender !== currentUser.email;
  const hasReadTimestamp = conversationData.readBy && 
                          conversationData.readBy[currentUser.email];
  return isFromOtherPerson && !hasReadTimestamp;
}

// Expose functions to global scope for inline HTML usage
window.handleLikeFromLikes = handleLikeFromLikes;
window.handleDislikeFromLikes = handleDislikeFromLikes;

// Add this helper function to get the top like card's email
function getTopLikeCardEmail() {
  const card = document.querySelector('.like-card');
  return card ? card.dataset.userEmail : null;
} 
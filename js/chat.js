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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentConversationId = null;
let otherUserEmail = null;
let otherUserProfile = null;
let messageListener = null;
let displayedMessageIds = new Set();

document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  currentConversationId = urlParams.get('conversationId');
  otherUserEmail = urlParams.get('user');
  if (!currentConversationId || !otherUserEmail) {
    alert('Invalid chat parameters');
    goBack();
    return;
  }
  auth.onAuthStateChanged(function(user) {
    if (user && user.email) {
      loadOtherUserProfile();
      loadMessages();
      setupMessageListener();
      setTimeout(() => { markConversationAsRead(); }, 1000);
    } else {
      window.location.href = 'login.html';
    }
  });
});

async function loadOtherUserProfile() {
  try {
    const userDoc = await db.collection('users').doc(otherUserEmail).get();
    if (userDoc.exists) {
      otherUserProfile = userDoc.data();
      document.getElementById('otherUserName').textContent = otherUserProfile.fullName || 'Unknown User';
      document.getElementById('otherUserName').style.color = '#111';
      const photos = otherUserProfile.photos || [];
      const mainPhoto = photos.length > 0 ? photos[0].url : (otherUserProfile.photo1Url || 'https://randomuser.me/api/portraits/lego/1.jpg');
      document.getElementById('otherUserPhoto').src = mainPhoto;
    }
  } catch (error) {
    console.error('Error loading other user profile:', error);
  }
}

async function loadMessages() {
  try {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '<div class="text-center text-gray-500">Loading messages...</div>';
    const messagesSnapshot = await db.collection('conversations').doc(currentConversationId)
      .collection('messages').orderBy('timestamp', 'asc').get();
    messagesContainer.innerHTML = '';
    displayedMessageIds.clear();
    messagesSnapshot.forEach(doc => {
      const messageData = doc.data();
      messageData.id = doc.id;
      displayMessage(messageData);
      displayedMessageIds.add(doc.id);
    });
    setTimeout(() => { scrollToBottom(); }, 200);
    setTimeout(() => { markConversationAsRead(); }, 500);
  } catch (error) {
    console.error('Error loading messages:', error);
    document.getElementById('messagesContainer').innerHTML = '<div class="text-center text-red-500">Error loading messages</div>';
  }
}

function setupMessageListener() {
  messageListener = db.collection('conversations').doc(currentConversationId)
    .collection('messages').orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' && !displayedMessageIds.has(change.doc.id)) {
          const messageData = change.doc.data();
          messageData.id = change.doc.id;
          displayMessage(messageData);
          displayedMessageIds.add(change.doc.id);
          setTimeout(() => { scrollToBottom(); }, 100);
          const currentUser = auth.currentUser;
          if (currentUser && messageData.sender !== currentUser.email && messageData.sender !== 'system') {
            markConversationAsRead();
          }
        }
      });
    }, error => { console.error('Error setting up message listener:', error); });
}

function displayMessage(messageData) {
  const messagesContainer = document.getElementById('messagesContainer');
  const currentUser = auth.currentUser;
  const messageDiv = document.createElement('div');
  messageDiv.className = 'flex mb-3';
  if (messageData.type === 'system') {
    messageDiv.innerHTML = `
      <div class="w-full">
        <div class="system-message px-4 py-2 mx-auto max-w-xs">${messageData.text}</div>
      </div>
    `;
  } else if (messageData.sender === currentUser.email) {
    messageDiv.innerHTML = `
      <div class="w-full flex justify-end">
        <div class="message-bubble message-sent px-4 py-2">${messageData.text}</div>
      </div>
    `;
  } else {
    messageDiv.innerHTML = `
      <div class="w-full flex justify-start">
        <div class="message-bubble message-received px-4 py-2">${messageData.text}</div>
      </div>
    `;
  }
  messagesContainer.appendChild(messageDiv);
}

async function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value.trim();
  if (!message || !currentConversationId) return;
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    await db.collection('conversations').doc(currentConversationId).collection('messages').add({
      text: message,
      sender: currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('conversations').doc(currentConversationId).update({
      lastMessage: message,
      lastMessageSender: currentUser.email,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
    });
    await markConversationAsRead();
    messageInput.value = '';
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

function handleKeyPress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

function scrollToBottom() {
  const messagesContainer = document.getElementById('messagesContainer');
  setTimeout(() => { messagesContainer.scrollTop = messagesContainer.scrollHeight; }, 100);
}

function goBack() {
  window.location.href = 'messages.html';
}

function showProfile() {
  if (otherUserProfile) {
    alert(`Profile of ${otherUserProfile.fullName}\nAge: ${otherUserProfile.age}\nLocation: ${otherUserProfile.currentLocation || 'Not set'}`);
  }
}

window.addEventListener('beforeunload', function() {
  if (messageListener) { messageListener(); }
});

async function markConversationAsRead() {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    await db.collection('conversations').doc(currentConversationId).update({
      [`readBy.${currentUser.email}`]: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('❌ Error marking conversation as read:', error);
  }
}

function showProfileModal() {
  if (!otherUserProfile) return;
  // Gather photos (same logic as likes)
  let photos = [];
  if (otherUserProfile.photos && Array.isArray(otherUserProfile.photos)) {
    photos = otherUserProfile.photos;
  } else {
    if (otherUserProfile.photo1Url) {
      photos.push({ url: otherUserProfile.photo1Url, name: otherUserProfile.photo1FileName || 'Photo 1' });
    }
    if (otherUserProfile.photo2Url) {
      photos.push({ url: otherUserProfile.photo2Url, name: otherUserProfile.photo2FileName || 'Photo 2' });
    }
    for (let i = 3; i <= 6; i++) {
      const photoKey = `photo${i}Url`;
      if (otherUserProfile[photoKey]) {
        photos.push({
          url: otherUserProfile[photoKey],
          name: otherUserProfile[`photo${i}FileName`] || `Photo ${i}`
        });
      }
    }
  }
  const mainPhoto = (photos.length > 0 && photos[0].url) ? photos[0].url : 'https://randomuser.me/api/portraits/lego/1.jpg';
  // Calculate age from birth date if available
  let age = otherUserProfile.age;
  if (otherUserProfile.birthDate) {
    const birthDate = new Date(otherUserProfile.birthDate);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  }
  // Build profile details sections
  let profileDetails = [];
  profileDetails.push(`
    <div class=\"px-6 py-4\">
      <h2 class=\"text-3xl font-bold mb-2\" style=\"color:#111\">${otherUserProfile.fullName || ''}${age ? ', ' + age : ''}</h2>
      <div class=\"text-base mb-2\" style=\"color:#111\">${otherUserProfile.currentLocation || 'Location not set'}</div>
      ${otherUserProfile.gender ? `<div class=\"text-base mb-2\" style=\"color:#111\">${otherUserProfile.gender}</div>` : ''}
      ${otherUserProfile.datingPreferences ? `<div class=\"text-base mb-2\" style=\"color:#111\">Interested in: ${otherUserProfile.datingPreferences}</div>` : ''}
    </div>
  `);
  if (otherUserProfile.bio) {
    profileDetails.push(`
      <div class=\"px-6 py-4\">
        <h4 class=\"font-semibold mb-3 text-lg\" style=\"color:#111\">About</h4>
        <p class=\"text-base leading-relaxed\" style=\"color:#111\">${otherUserProfile.bio}</p>
      </div>
    `);
  }
  let personalInfoItems = [];
  if (otherUserProfile.relationshipStatus) personalInfoItems.push(`<div class=\"mb-2\"><span class=\"font-medium\" style=\"color:#111\">Relationship Status:</span> <span style=\"color:#111\">${otherUserProfile.relationshipStatus}</span></div>`);
  if (otherUserProfile.datingIntentions) personalInfoItems.push(`<div class=\"mb-2\"><span class=\"font-medium\" style=\"color:#111\">Looking for:</span> <span style=\"color:#111\">${otherUserProfile.datingIntentions}</span></div>`);
  if (otherUserProfile.heightFeet && otherUserProfile.heightInches) personalInfoItems.push(`<div class=\"mb-2\"><span class=\"font-medium\" style=\"color:#111\">Height:</span> <span style=\"color:#111\">${otherUserProfile.heightFeet}'${otherUserProfile.heightInches}\"</span></div>`);
  if (personalInfoItems.length > 0) {
    profileDetails.push(`
      <div class=\"px-6 py-4\">
        <h4 class=\"font-semibold mb-3 text-lg\" style=\"color:#111\">Personal Information</h4>
        <div class=\"space-y-2 text-base\">
          ${personalInfoItems.join('')}
        </div>
      </div>
    `);
  }
  let workEducationItems = [];
  if (otherUserProfile.occupation) workEducationItems.push(`<div class=\"mb-2\"><span class=\"font-medium\" style=\"color:#111\">Occupation:</span> <span style=\"color:#111\">${otherUserProfile.occupation}</span></div>`);
  if (otherUserProfile.jobTitle) workEducationItems.push(`<div class=\"mb-2\"><span class=\"font-medium\" style=\"color:#111\">Job Title:</span> <span style=\"color:#111\">${otherUserProfile.jobTitle}</span></div>`);
  if (otherUserProfile.school) workEducationItems.push(`<div class=\"mb-2\"><span class=\"font-medium\" style=\"color:#111\">School/University:</span> <span style=\"color:#111\">${otherUserProfile.school}</span></div>`);
  if (otherUserProfile.highestDegree) workEducationItems.push(`<div class=\"mb-2\"><span class=\"font-medium\" style=\"color:#111\">Highest Degree:</span> <span style=\"color:#111\">${otherUserProfile.highestDegree}</span></div>`);
  if (workEducationItems.length > 0) {
    profileDetails.push(`
      <div class=\"px-6 py-4\">
        <h4 class=\"font-semibold mb-3 text-lg\" style=\"color:#111\">Work & Education</h4>
        <div class=\"space-y-2 text-base\">
          ${workEducationItems.join('')}
        </div>
      </div>
    `);
  }
  let locationItems = [];
  if (otherUserProfile.currentLocation) locationItems.push(`<div class=\"mb-2\"><span class=\"font-medium\" style=\"color:#111\">Current Location:</span> <span style=\"color:#111\">${otherUserProfile.currentLocation}</span></div>`);
  if (otherUserProfile.hometown) locationItems.push(`<div class=\"mb-2\"><span class=\"font-medium\" style=\"color:#111\">Hometown:</span> <span style=\"color:#111\">${otherUserProfile.hometown}</span></div>`);
  if (locationItems.length > 0) {
    profileDetails.push(`
      <div class=\"px-6 py-4\">
        <h4 class=\"font-semibold mb-3 text-lg\" style=\"color:#111\">Location</h4>
        <div class=\"space-y-2 text-base\">
          ${locationItems.join('')}
        </div>
      </div>
    `);
  }
  if (otherUserProfile.interests) {
    const interestTags = otherUserProfile.interests.split(',').map(interest => 
      `<span class=\"bg-blue-50 px-3 py-1 rounded-full text-sm\" style=\"color:#111\">${interest.trim()}</span>`
    ).join('');
    profileDetails.push(`
      <div class=\"px-6 py-4\">
        <h4 class=\"font-semibold mb-3 text-lg\" style=\"color:#111\">Interests</h4>
        <div class=\"flex flex-wrap gap-2\">
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
        additionalPhotos += `<img src=\"${photos[i].url}\" class=\"w-full h-80 object-cover\" alt=\"Profile photo ${i+1}\" onerror=\"this.style.display='none';\">`;
      }
    }
  }
  // Modal content with scrollable area
  const modalContent = `
    <div class=\"flex flex-col h-full w-full\">
      <div class=\"flex-1 overflow-y-auto\" style=\"padding-bottom: 24px; max-height:70vh;\">
        <img src=\"${mainPhoto}\" class=\"w-full h-80 object-cover\" alt=\"Profile Photo\">
        ${profileDetails.join('')}
        ${additionalPhotos}
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

// Expose functions to global scope for HTML usage
window.goBack = goBack;
window.showProfile = showProfile;
window.handleKeyPress = handleKeyPress;
window.sendMessage = sendMessage;
window.showProfileModal = showProfileModal;
window.closeProfileModal = closeProfileModal; 
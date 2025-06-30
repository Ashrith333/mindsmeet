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
      const photos = otherUserProfile.photos || [];
      const mainPhoto = photos.length > 0 ? photos[0].url : 'https://randomuser.me/api/portraits/lego/1.jpg';
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

// Expose functions to global scope for HTML usage
window.goBack = goBack;
window.showProfile = showProfile;
window.handleKeyPress = handleKeyPress;
window.sendMessage = sendMessage; 
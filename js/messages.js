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

let displayedConversations = new Set();
let conversationsListener = null;

auth.onAuthStateChanged(function(user) {
  if (user && user.email) {
    console.log('User authenticated:', user.email);
    loadMessages();
    setupGlobalMessageNotifications();
    setTimeout(() => { checkUnreadMessages(); }, 1000);
  } else {
    console.log('No user authenticated, redirecting to login');
    window.location.href = 'login.html';
  }
});

async function loadMessages() {
  try {
    console.log('=== LOADING MESSAGES ===');
    const user = auth.currentUser;
    if (!user) return;
    const conversationsSnapshot = await db.collection('conversations').where('participants', 'array-contains', user.email).get();
    const messagesList = document.getElementById('messagesList');
    const emptyState = document.getElementById('emptyState');
    messagesList.innerHTML = '';
    displayedConversations.clear();
    let conversationsFound = 0;
    const usersSnapshot = await db.collection('users').get();
    const userProfiles = {};
    usersSnapshot.forEach(doc => { userProfiles[doc.id] = doc.data(); });
    const conversations = [];
    conversationsSnapshot.forEach(doc => {
      const conversationData = doc.data();
      const otherUserEmail = conversationData.participants.find(email => email !== user.email);
      if (otherUserEmail && userProfiles[otherUserEmail]) {
        const otherUserProfile = userProfiles[otherUserEmail];
        if (otherUserProfile.fullName && otherUserProfile.age) {
          conversations.push({
            id: doc.id,
            data: conversationData,
            otherUserEmail: otherUserEmail,
            otherUserProfile: otherUserProfile
          });
        }
      }
    });
    conversations.sort((a, b) => {
      const timeA = a.data.lastMessageTime ? a.data.lastMessageTime.toDate() : new Date(0);
      const timeB = b.data.lastMessageTime ? b.data.lastMessageTime.toDate() : new Date(0);
      return timeB - timeA;
    });
    conversations.forEach(conversation => {
      conversationsFound++;
      displayedConversations.add(conversation.id);
      createMessageItem(conversation.id, conversation.data, conversation.otherUserEmail, conversation.otherUserProfile, user);
    });
    if (conversationsFound === 0) {
      messagesList.classList.add('hidden');
      emptyState.classList.remove('hidden');
    } else {
      messagesList.classList.remove('hidden');
      emptyState.classList.add('hidden');
    }
    checkUnreadMessages();
    setupConversationsListener();
  } catch (error) {
    console.error('Error loading messages:', error);
    const messagesList = document.getElementById('messagesList');
    const emptyState = document.getElementById('emptyState');
    messagesList.classList.add('hidden');
    emptyState.classList.add('hidden');
    const emptyStateTitle = emptyState.querySelector('h3');
    const emptyStateDesc = emptyState.querySelector('p');
    if (emptyStateTitle) emptyStateTitle.textContent = 'Error loading messages';
    if (emptyStateDesc) emptyStateDesc.textContent = 'Please try again later';
  }
}

function createMessageItem(conversationId, conversationData, otherUserEmail, otherUserProfile, currentUser) {
  const messagesList = document.getElementById('messagesList');
  let mainPhoto = 'https://randomuser.me/api/portraits/lego/1.jpg';
  if (otherUserProfile.photos && Array.isArray(otherUserProfile.photos) && otherUserProfile.photos.length > 0 && otherUserProfile.photos[0].url) {
    mainPhoto = otherUserProfile.photos[0].url;
  } else if (otherUserProfile.photo1Url) {
    mainPhoto = otherUserProfile.photo1Url;
  }
  let age = otherUserProfile.age;
  if (otherUserProfile.birthDate) {
    const birthDate = new Date(otherUserProfile.birthDate);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) { age--; }
  }
  const lastMessageTime = conversationData.lastMessageTime ? formatTimeAgo(conversationData.lastMessageTime) : 'recently';
  const hasUnreadMessages = checkIfUnread(conversationData);
  const messageItem = document.createElement('div');
  messageItem.className = `message-item flex items-center p-4 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors ${hasUnreadMessages ? 'bg-blue-50' : ''}`;
  messageItem.dataset.conversationId = conversationId;
  messageItem.dataset.otherUser = otherUserEmail;
  messageItem.onclick = () => handleMessageClick(conversationId, otherUserEmail, otherUserProfile.fullName);
  messageItem.innerHTML = `
    <div class="relative">
      <img src="${mainPhoto}" class="w-12 h-12 rounded-full object-cover" alt="Profile">
    </div>
    <div class="ml-3 flex-1 min-w-0">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-primary truncate">${otherUserProfile.fullName}, ${age}</h3>
        <span class="text-xs text-gray-500">${lastMessageTime}</span>
      </div>
      <p class="text-sm ${hasUnreadMessages ? 'text-primary font-semibold' : 'text-gray-600'} truncate">${conversationData.lastMessage || 'Start a conversation!'}</p>
    </div>
    <div class="ml-2">
      ${hasUnreadMessages ? '<div class="w-3 h-3 bg-blue-500 rounded-full"></div>' : ''}
    </div>
  `;
  messagesList.appendChild(messageItem);
  if (hasUnreadMessages) { updateMessagesIndicator(true); }
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

function handleMessageClick(conversationId, otherUserEmail, otherUserName) {
  window.location.href = `chat.html?conversationId=${encodeURIComponent(conversationId)}&user=${encodeURIComponent(otherUserEmail)}`;
}

function setupConversationsListener() {
  const user = auth.currentUser;
  if (!user) return;
  if (conversationsListener) { conversationsListener(); }
  conversationsListener = db.collection('conversations').where('participants', 'array-contains', user.email)
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'modified') {
          updateConversationInUI(change.doc.id, change.doc.data());
        } else if (change.type === 'added') {
          if (displayedConversations.has(change.doc.id)) return;
          displayedConversations.add(change.doc.id);
          const conversationData = change.doc.data();
          const otherUserEmail = conversationData.participants.find(email => email !== user.email);
          if (otherUserEmail) {
            db.collection('users').doc(otherUserEmail).get().then(userDoc => {
              if (userDoc.exists) {
                const otherUserProfile = userDoc.data();
                if (otherUserProfile.fullName && otherUserProfile.age) {
                  createMessageItem(change.doc.id, conversationData, otherUserEmail, otherUserProfile, user);
                  const messagesList = document.getElementById('messagesList');
                  const emptyState = document.getElementById('emptyState');
                  messagesList.classList.remove('hidden');
                  emptyState.classList.add('hidden');
                  checkUnreadMessages();
                }
              }
            });
          }
        } else if (change.type === 'removed') {
          displayedConversations.delete(change.doc.id);
          const messageItem = document.querySelector(`[data-conversation-id="${change.doc.id}"]`);
          if (messageItem) { messageItem.remove(); }
          const messagesList = document.getElementById('messagesList');
          const emptyState = document.getElementById('emptyState');
          if (messagesList.children.length === 0) {
            messagesList.classList.add('hidden');
            emptyState.classList.remove('hidden');
          }
          checkUnreadMessages();
        }
      });
      setTimeout(() => { checkUnreadMessages(); }, 100);
    }, error => { console.error('Error setting up conversations listener:', error); });
}

async function updateConversationInUI(conversationId, conversationData) {
  const user = auth.currentUser;
  if (!user) return;
  const messageItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
  if (!messageItem) return;
  const otherUserEmail = conversationData.participants.find(email => email !== user.email);
  const userDoc = await db.collection('users').doc(otherUserEmail).get();
  if (!userDoc.exists) return;
  const otherUserProfile = userDoc.data();
  let age = otherUserProfile.age;
  if (otherUserProfile.birthDate) {
    const birthDate = new Date(otherUserProfile.birthDate);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) { age--; }
  }
  const lastMessageTime = conversationData.lastMessageTime ? formatTimeAgo(conversationData.lastMessageTime) : 'recently';
  const hasUnreadMessages = checkIfUnread(conversationData);
  let mainPhoto = 'https://randomuser.me/api/portraits/lego/1.jpg';
  if (otherUserProfile.photos && Array.isArray(otherUserProfile.photos) && otherUserProfile.photos.length > 0 && otherUserProfile.photos[0].url) {
    mainPhoto = otherUserProfile.photos[0].url;
  } else if (otherUserProfile.photo1Url) {
    mainPhoto = otherUserProfile.photo1Url;
  }
  messageItem.className = `message-item flex items-center p-4 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors ${hasUnreadMessages ? 'bg-blue-50' : ''}`;
  messageItem.innerHTML = `
    <div class="relative">
      <img src="${mainPhoto}" class="w-12 h-12 rounded-full object-cover" alt="Profile">
    </div>
    <div class="ml-3 flex-1 min-w-0">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-primary truncate">${otherUserProfile.fullName}, ${age}</h3>
        <span class="text-xs text-gray-500">${lastMessageTime}</span>
      </div>
      <p class="text-sm ${hasUnreadMessages ? 'text-primary font-semibold' : 'text-gray-600'} truncate">${conversationData.lastMessage || 'Start a conversation!'}</p>
    </div>
    <div class="ml-2">
      ${hasUnreadMessages ? '<div class="w-3 h-3 bg-blue-500 rounded-full"></div>' : ''}
    </div>
  `;
  messageItem.onclick = () => handleMessageClick(conversationId, otherUserEmail, otherUserProfile.fullName);
  const messagesList = document.getElementById('messagesList');
  messagesList.insertBefore(messageItem, messagesList.firstChild);
  if (hasUnreadMessages) { updateMessagesIndicator(true); }
}

window.addEventListener('beforeunload', function() {
  if (conversationsListener) { conversationsListener(); }
});

document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    setTimeout(() => { checkUnreadMessages(); }, 500);
  }
});

function updateMessagesIndicator(hasUnread) {
  const messagesNavButton = document.querySelector('[onclick*="messages.html"]');
  if (messagesNavButton) {
    messagesNavButton.style.position = 'relative';
    const existingIndicator = messagesNavButton.querySelector('.unread-indicator');
    if (hasUnread && !existingIndicator) {
      const indicator = document.createElement('div');
      indicator.className = 'unread-indicator absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full z-10';
      messagesNavButton.appendChild(indicator);
    } else if (!hasUnread && existingIndicator) {
      existingIndicator.remove();
    }
  }
  if (hasUnread) {
    document.title = 'Messages (1) - Minds Meet';
  } else {
    document.title = 'Messages - Minds Meet';
  }
}

async function checkUnreadMessages() {
  const user = auth.currentUser;
  if (!user) return;
  try {
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
        }
      }
    });
    updateMessagesIndicator(hasUnread);
  } catch (error) {
    console.error('Error checking for unread messages:', error);
  }
}

function setupGlobalMessageNotifications() {
  const user = auth.currentUser;
  if (!user) return;
  db.collection('conversations').where('participants', 'array-contains', user.email)
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'modified') {
          const conversationData = change.doc.data();
          if (conversationData.lastMessage && 
              conversationData.lastMessageSender && 
              conversationData.lastMessageSender !== 'system' &&
              conversationData.lastMessageSender !== user.email) {
            const otherUserEmail = conversationData.participants.find(email => email !== user.email);
            if (otherUserEmail) {
              db.collection('users').doc(otherUserEmail).get().then(userDoc => {
                if (userDoc.exists) {
                  updateMessagesIndicator(true);
                }
              });
            }
          } else if (conversationData.lastMessageSender === user.email) {
            setTimeout(() => { checkUnreadMessages(); }, 100);
          }
        }
      });
    }, error => { console.error('Error setting up global message notifications:', error); });
}

function checkIfUnread(conversationData) {
  const currentUser = auth.currentUser;
  if (!currentUser || !conversationData.lastMessageSender) return false;
  const isFromOtherPerson = conversationData.lastMessageSender !== 'system' && 
                           conversationData.lastMessageSender !== currentUser.email;
  const hasReadTimestamp = conversationData.readBy && 
                          conversationData.readBy[currentUser.email];
  return isFromOtherPerson && !hasReadTimestamp;
} 
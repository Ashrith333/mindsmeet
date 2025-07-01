// profile.js - All logic from profile.html moved here

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
const storage = firebase.storage();
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => { console.log('Firebase persistence set to LOCAL'); })
  .catch((error) => { console.error('Error setting persistence:', error); });

let userProfileData = {};

document.addEventListener('DOMContentLoaded', function() {
  auth.onAuthStateChanged(function(user) {
    if (user && user.email) {
      loadUserProfile();
      checkEmailVerificationStatus(user);
    } else {
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
    resendBtn.style.display = '';
  } else {
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
    await user.sendEmailVerification();
    alert('Verification email sent! Please check your inbox and spam folder.');
    resendBtn.textContent = originalText;
    resendBtn.disabled = false;
  } catch (error) {
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
    if (!userData.fullName || !userData.age) {
      window.location.href = 'profile-setup.html';
      return;
    }
    loadProfileData(userData);
    setupMessageNotifications();
  } catch (error) {
    window.location.href = 'profile-setup.html';
  }
}

// Load profile data into the UI
function loadProfileData(userData) {
  window.userProfileData = userData;
  const mainPhoto = userData.photo1Url || 'https://randomuser.me/api/portraits/lego/1.jpg';
  const mainPhotoEl = document.getElementById('mainProfilePhoto');
  if (mainPhotoEl) mainPhotoEl.src = mainPhoto;
  const profileNameEl = document.getElementById('profileName');
  if (profileNameEl) profileNameEl.textContent = userData.fullName || 'Not set';
  const profileAge = document.getElementById('profileAge');
  if (profileAge) profileAge.textContent = userData.age || 'Not set';
  const profileLocation = document.getElementById('profileLocation');
  if (profileLocation) profileLocation.textContent = userData.currentLocation || 'Not set';
  const profileBio = document.getElementById('profileBio');
  if (profileBio) profileBio.textContent = userData.bio || 'Not set';
  const profileInterests = document.getElementById('profileInterests');
  if (profileInterests) profileInterests.textContent = userData.interests || 'Not set';
  populateEditForm();
  if (userData.photo1Url) {
    displayEditPhoto('photo1', 'editPhoto1Preview', 'editPhoto1Placeholder', 'editPhoto1Img', userData.photo1Url);
  }
  if (userData.photo2Url) {
    displayEditPhoto('photo2', 'editPhoto2Preview', 'editPhoto2Placeholder', 'editPhoto2Img', userData.photo2Url);
  }
}

function setupMessageNotifications() {
  const user = auth.currentUser;
  if (!user) return;
  db.collection('conversations').where('participants', 'array-contains', user.email)
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'modified') {
          const conversationData = change.doc.data();
          if (conversationData.lastMessage && conversationData.lastMessageSender && conversationData.lastMessageSender !== 'system' && conversationData.lastMessageSender !== user.email) {
            setTimeout(() => { checkForUnreadMessages(); }, 100);
          }
        }
      });
      setTimeout(() => { checkForUnreadMessages(); }, 100);
    }, error => { console.error('Error setting up message notifications:', error); });
}

async function checkForUnreadMessages() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const conversationsSnapshot = await db.collection('conversations').where('participants', 'array-contains', user.email).get();
    let hasUnread = false;
    conversationsSnapshot.forEach(doc => {
      const conversationData = doc.data();
      if (conversationData.lastMessage && conversationData.lastMessageSender && conversationData.lastMessageSender !== 'system' && conversationData.lastMessageSender !== user.email) {
        const readBy = conversationData.readBy || {};
        const lastMessageTime = conversationData.lastMessageTime;
        const userReadTime = readBy[user.email];
        const isUnread = !userReadTime || (lastMessageTime && userReadTime.toDate && lastMessageTime.toDate && userReadTime.toDate() < lastMessageTime.toDate());
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

function showNewMessageNotification(senderName) {
  // Notification popup removed - using blue dot indicator in messages section
}

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
    document.title = 'Profile (1) - Minds Meet';
  } else {
    document.title = 'Profile - Minds Meet';
  }
}

function populateEditForm() {
  if (!window.userProfileData) return;
  const userData = window.userProfileData;
  document.getElementById('editName').value = userData.fullName || '';
  document.getElementById('editAge').value = userData.age || '';
  document.getElementById('editGender').value = userData.gender || '';
  document.getElementById('editDatingPreferences').value = userData.datingPreferences || '';
  document.getElementById('editRelationshipStatus').value = userData.relationshipStatus || '';
  document.getElementById('editLocation').value = userData.currentLocation || '';
  document.getElementById('editHometown').value = userData.hometown || '';
  document.getElementById('editDatingIntentions').value = userData.datingIntentions || '';
  document.getElementById('editHeightFeet').value = userData.heightFeet || '';
  document.getElementById('editHeightInches').value = userData.heightInches || '';
  document.getElementById('editOccupation').value = userData.occupation || '';
  document.getElementById('editJobTitle').value = userData.jobTitle || '';
  document.getElementById('editSchool').value = userData.school || '';
  document.getElementById('editHighestDegree').value = userData.highestDegree || '';
  document.getElementById('editReligion').value = userData.religion || '';
  document.getElementById('editSmoking').value = userData.smoking || '';
  document.getElementById('editDrinking').value = userData.drinking || '';
}

function updateProfileDisplay() {
  function safeUpdateElement(id, text) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
    }
  }
  safeUpdateElement('profileName', userProfileData.fullName || 'No name set');
  safeUpdateElement('profileAge', userProfileData.age ? `${userProfileData.age} years old` : 'Age not set');
  safeUpdateElement('profileBio', userProfileData.bio || 'No bio set');
  safeUpdateElement('profileLocation', userProfileData.currentLocation || 'Location not set');
  safeUpdateElement('profileInterests', userProfileData.interests || 'No interests set');
}

function displayEditPhoto(photoKey, previewId, placeholderId, imgId, photoUrl) {
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);
  const img = document.getElementById(imgId);
  if (!preview || !placeholder || !img) return;
  if (photoUrl) {
    img.src = photoUrl;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
  } else {
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }
}

function previewEditPhoto(input, previewId, placeholderId, imgId) {
  const file = input.files[0];
  if (file) {
    const photoKey = input.id.replace('edit', '').toLowerCase();
    uploadPhotoAndSaveUrl(file, photoKey);
  }
}

async function uploadPhotoAndSaveUrl(file, photoKey) {
  const currentUser = auth.currentUser;
  if (!file || !currentUser || !currentUser.email) return;
  showEditUploadStatus(photoKey, 'uploading', 0);
  try {
    if (!firebase.storage) {
      showEditUploadStatus(photoKey, 'error');
      alert('Firebase Storage not available. Please refresh the page and try again.');
      return;
    }
    const storage = firebase.storage();
    const optimizedFile = await optimizeImageForUpload(file);
    const storagePath = `users/${currentUser.email}/${photoKey}_${Date.now()}.jpg`;
    const fileRef = storage.ref(storagePath);
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadTask = fileRef.put(optimizedFile, {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000'
      });
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          showEditUploadStatus(photoKey, 'uploading', progress);
        },
        (error) => {
          showEditUploadStatus(photoKey, 'error');
          reject(error);
        },
        () => {
          showEditUploadStatus(photoKey, 'success');
          resolve(uploadTask);
        }
      );
    });
    await uploadPromise;
    const url = await fileRef.getDownloadURL();
    const photoUrlField = photoKey + 'Url';
    if (!window.userProfileData) {
      window.userProfileData = {};
    }
    window.userProfileData[photoUrlField] = url;
    window.userProfileData[photoKey + 'FileName'] = file.name;
    window.userProfileData[photoKey + 'FileType'] = 'image/jpeg';
    window.userProfileData[photoKey + 'FileSize'] = optimizedFile.size;
    window.userProfileData[photoKey + 'UploadedAt'] = new Date();
    const userDocRef = db.collection('users').doc(currentUser.email);
    const updateData = {
      [photoUrlField]: url,
      [photoKey + 'FileName']: file.name,
      [photoKey + 'FileType']: 'image/jpeg',
      [photoKey + 'FileSize']: optimizedFile.size,
      [photoKey + 'UploadedAt']: new Date(),
      updatedAt: new Date()
    };
    await userDocRef.set(updateData, { merge: true });
    setTimeout(() => {
      displayEditPhoto(photoKey, 'edit' + photoKey.charAt(0).toUpperCase() + photoKey.slice(1) + 'Preview', 'edit' + photoKey.charAt(0).toUpperCase() + photoKey.slice(1) + 'Placeholder', 'edit' + photoKey.charAt(0).toUpperCase() + photoKey.slice(1) + 'Img', url);
    }, 1000);
  } catch (error) {
    showEditUploadStatus(photoKey, 'error');
    let errorMessage = 'Error uploading photo. ';
    if (error.code === 'storage/unauthorized') {
      errorMessage += 'Storage access denied. Please check permissions.';
    } else if (error.code === 'storage/quota-exceeded') {
      errorMessage += 'Storage quota exceeded.';
    } else if (error.code === 'storage/invalid-format') {
      errorMessage += 'Invalid file format. Please use JPG, PNG, or GIF.';
    } else if (error.code === 'storage/network-request-failed') {
      errorMessage += 'Network error. Please check your internet connection.';
    } else {
      errorMessage += 'Please try again. Error: ' + error.message;
    }
    alert(errorMessage);
  }
}

async function saveProfileChanges() {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      alert('Please log in to save changes.');
      return;
    }
    const updatedData = {
      fullName: document.getElementById('editName').value,
      age: document.getElementById('editAge').value,
      gender: document.getElementById('editGender').value,
      datingPreferences: document.getElementById('editDatingPreferences').value,
      relationshipStatus: document.getElementById('editRelationshipStatus').value,
      currentLocation: document.getElementById('editLocation').value,
      hometown: document.getElementById('editHometown').value,
      datingIntentions: document.getElementById('editDatingIntentions').value,
      heightFeet: document.getElementById('editHeightFeet').value,
      heightInches: document.getElementById('editHeightInches').value,
      occupation: document.getElementById('editOccupation').value,
      jobTitle: document.getElementById('editJobTitle').value,
      school: document.getElementById('editSchool').value,
      highestDegree: document.getElementById('editHighestDegree').value,
      religion: document.getElementById('editReligion').value,
      smoking: document.getElementById('editSmoking').value,
      drinking: document.getElementById('editDrinking').value,
      updatedAt: new Date()
    };
    if (window.userProfileData && window.userProfileData.photo1Url) {
      updatedData.photo1Url = window.userProfileData.photo1Url;
    }
    if (window.userProfileData && window.userProfileData.photo2Url) {
      updatedData.photo2Url = window.userProfileData.photo2Url;
    }
    const userDocRef = db.collection('users').doc(currentUser.email);
    await userDocRef.set(updatedData, { merge: true });
    if (window.userProfileData) {
      Object.assign(window.userProfileData, updatedData);
    } else {
      window.userProfileData = updatedData;
    }
    alert('Profile updated successfully!');
    hideEditProfile();
    loadProfileData(window.userProfileData);
  } catch (error) {
    alert('Error saving profile changes. Please try again. Error: ' + error.message);
  }
}

function optimizeImageForUpload(file) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = function() {
      const maxSize = 800;
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        resolve(optimizedFile);
      }, 'image/jpeg', 0.8);
    };
    img.src = URL.createObjectURL(file);
  });
}

function showEditUploadStatus(photoKey, status, progress = 0) {
  const previewId = 'edit' + photoKey.charAt(0).toUpperCase() + photoKey.slice(1) + 'Preview';
  const placeholderId = 'edit' + photoKey.charAt(0).toUpperCase() + photoKey.slice(1) + 'Placeholder';
  const preview = document.getElementById(previewId);
  const placeholder = document.getElementById(placeholderId);
  if (!preview) return;
  if (status === 'uploading') {
    preview.classList.remove('hidden');
    if (placeholder) placeholder.classList.add('hidden');
  }
  preview.innerHTML = '';
  if (status === 'uploading') {
    const uploadDiv = document.createElement('div');
    uploadDiv.className = 'w-full h-32 bg-blue-50 border-2 border-blue-200 rounded-lg mb-2 flex items-center justify-center';
    uploadDiv.innerHTML = `
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p class="text-sm text-blue-600 font-medium">Uploading...</p>
        <p class="text-xs text-blue-500">${progress}%</p>
      </div>
    `;
    preview.appendChild(uploadDiv);
  } else if (status === 'success') {
    const successDiv = document.createElement('div');
    successDiv.className = 'w-full h-32 bg-green-50 border-2 border-green-200 rounded-lg mb-2 flex items-center justify-center';
    successDiv.innerHTML = `
      <div class="text-center">
        <svg class="mx-auto h-8 w-8 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <p class="text-sm text-green-600 font-medium">Uploaded!</p>
      </div>
    `;
    preview.appendChild(successDiv);
  } else if (status === 'error') {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'w-full h-32 bg-red-50 border-2 border-red-200 rounded-lg mb-2 flex items-center justify-center';
    errorDiv.innerHTML = `
      <div class="text-center">
        <svg class="mx-auto h-8 w-8 text-red-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        <p class="text-sm text-red-600 font-medium">Upload Failed</p>
      </div>
    `;
    preview.appendChild(errorDiv);
  }
}

function signOutUser() {
  auth.signOut().then(() => {
    window.location.href = 'login.html';
  }).catch((error) => {
    console.error('Error signing out:', error);
  });
}

function updateVerificationStatus() {
  // This function is called but doesn't need to do anything specific
}

function showEditProfile() {
  const viewSection = document.getElementById('profileViewSection');
  const editSection = document.getElementById('profileEditSection');
  if (viewSection && editSection) {
    viewSection.classList.add('hidden');
    editSection.classList.remove('hidden');
    populateEditForm();
  }
}

function hideEditProfile() {
  const viewSection = document.getElementById('profileViewSection');
  const editSection = document.getElementById('profileEditSection');
  if (viewSection && editSection) {
    editSection.classList.add('hidden');
    viewSection.classList.remove('hidden');
  }
}

// Expose functions to window for HTML usage
window.showEditProfile = showEditProfile;
window.hideEditProfile = hideEditProfile;
window.saveProfileChanges = saveProfileChanges;
window.previewEditPhoto = previewEditPhoto;
window.signOutUser = signOutUser;
window.resendVerificationEmail = resendVerificationEmail; 
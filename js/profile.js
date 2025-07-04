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
  document.getElementById('editHeightFeet').value = userData.heightFeet || '';
  document.getElementById('editHeightInches').value = userData.heightInches || '';
  document.getElementById('editDatingPreferences').value = userData.datingPreferences || '';
  document.getElementById('editRelationshipStatus').value = userData.relationshipStatus || '';
  document.getElementById('editDatingIntentions').value = userData.datingIntentions || '';
  document.getElementById('editLocation').value = userData.currentLocation || '';
  document.getElementById('editHometown').value = userData.hometown || '';
  document.getElementById('editJobTitle').value = userData.jobTitle || '';
  document.getElementById('editCompany').value = userData.company || '';
  document.getElementById('editSchool').value = userData.school || '';
  document.getElementById('editGraduationYear').value = userData.graduationYear || '';
  document.getElementById('editHighestDegree').value = userData.highestDegree || '';
  document.getElementById('editReligion').value = userData.religion || '';
  document.getElementById('editSmoking').value = userData.smoking || '';
  document.getElementById('editDrinking').value = userData.drinking || '';
  document.getElementById('editBio').value = userData.bio || '';
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
      heightFeet: document.getElementById('editHeightFeet').value,
      heightInches: document.getElementById('editHeightInches').value,
      datingPreferences: document.getElementById('editDatingPreferences').value,
      relationshipStatus: document.getElementById('editRelationshipStatus').value,
      datingIntentions: document.getElementById('editDatingIntentions').value,
      currentLocation: document.getElementById('editLocation').value,
      hometown: document.getElementById('editHometown').value,
      jobTitle: document.getElementById('editJobTitle').value,
      company: document.getElementById('editCompany').value,
      school: document.getElementById('editSchool').value,
      graduationYear: document.getElementById('editGraduationYear').value,
      highestDegree: document.getElementById('editHighestDegree').value,
      religion: document.getElementById('editReligion').value,
      smoking: document.getElementById('editSmoking').value,
      drinking: document.getElementById('editDrinking').value,
      bio: document.getElementById('editBio').value,
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
        // Fix: handle case where file.name is undefined (e.g. cropped blob)
        const fileName = file.name ? file.name.replace(/\.[^/.]+$/, '.jpg') : 'photo.jpg';
        const optimizedFile = new File([blob], fileName, {
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
    document.querySelector('.bottom-nav').classList.add('hidden');
    populateEditForm();
    switchToEditTab();
    initializePhotoGridFromProfile(); // Ensure photo grid is always initialized
  }
}

function hideEditProfile() {
  const viewSection = document.getElementById('profileViewSection');
  const editSection = document.getElementById('profileEditSection');
  if (viewSection && editSection) {
    editSection.classList.add('hidden');
    viewSection.classList.remove('hidden');
    document.querySelector('.bottom-nav').classList.remove('hidden');
  }
}

// Expose functions to window for HTML usage
window.showEditProfile = showEditProfile;
window.hideEditProfile = hideEditProfile;
window.saveProfileChanges = saveProfileChanges;
window.previewEditPhoto = previewEditPhoto;
window.signOutUser = signOutUser;
window.switchToEditTab = switchToEditTab;
window.switchToViewTab = switchToViewTab;
window.resendVerificationEmail = resendVerificationEmail;

// Tab switching functions
function switchToEditTab() {
  document.getElementById('editTabBtn').classList.add('text-primary', 'border-primary', 'bg-blue-50');
  document.getElementById('editTabBtn').classList.remove('text-gray-500', 'border-transparent');
  document.getElementById('viewTabBtn').classList.remove('text-primary', 'border-primary', 'bg-blue-50');
  document.getElementById('viewTabBtn').classList.add('text-gray-500', 'border-transparent');
  
  document.getElementById('editTabContent').classList.remove('hidden');
  document.getElementById('viewTabContent').classList.add('hidden');
  initializePhotoGridFromProfile(); // Also re-initialize grid on tab switch
}

function switchToViewTab() {
  document.getElementById('viewTabBtn').classList.add('text-primary', 'border-primary', 'bg-blue-50');
  document.getElementById('viewTabBtn').classList.remove('text-gray-500', 'border-transparent');
  document.getElementById('editTabBtn').classList.remove('text-primary', 'border-primary', 'bg-blue-50');
  document.getElementById('editTabBtn').classList.add('text-gray-500', 'border-transparent');
  
  document.getElementById('viewTabContent').classList.remove('hidden');
  document.getElementById('editTabContent').classList.add('hidden');
  
  // Load the profile view
  loadProfileView();
}

function loadProfileView() {
  if (!window.userProfileData) return;
  
  const userData = window.userProfileData;
  const container = document.querySelector('.profile-view-container');
  
  // Create a profile card similar to browse.js
  const profileCard = createProfileViewCard(userData);
  container.innerHTML = '';
  container.appendChild(profileCard);
}

function createProfileViewCard(userData) {
  // Get profile photos
  let photos = [];
  if (userData.photo1Url) {
    photos.push({ url: userData.photo1Url, name: 'Photo 1' });
  }
  if (userData.photo2Url) {
    photos.push({ url: userData.photo2Url, name: 'Photo 2' });
  }
  
  // Calculate age
  let age = userData.age;
  
  const card = document.createElement('div');
  card.className = 'profile-card bg-white rounded-lg shadow-lg overflow-hidden';
  
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
      <h2 class="text-3xl font-bold text-primary mb-2">${userData.fullName || 'No name set'}, ${age || 'Age not set'}</h2>
      <div class="text-secondary text-base mb-2">${userData.currentLocation || 'Location not set'}</div>
      ${userData.gender ? `<div class="text-secondary text-base mb-2">${userData.gender}</div>` : ''}
      ${userData.datingPreferences ? `<div class="text-secondary text-base mb-2">Interested in: ${userData.datingPreferences}</div>` : ''}
    </div>
  `);
  
  // Bio
  if (userData.bio) {
    profileDetails.push(`
      <div class="px-6 py-4">
        <h4 class="text-primary font-semibold mb-3 text-lg">About</h4>
        <p class="text-secondary text-base leading-relaxed">${userData.bio}</p>
      </div>
    `);
  }
  
  // Personal Information
  let personalInfoItems = [];
  if (userData.relationshipStatus) personalInfoItems.push(`<div class="mb-2"><span class="font-medium text-primary">Relationship Status:</span> <span class="text-secondary">${userData.relationshipStatus}</span></div>`);
  if (userData.datingIntentions) personalInfoItems.push(`<div class="mb-2"><span class="font-medium text-primary">Looking for:</span> <span class="text-secondary">${userData.datingIntentions}</span></div>`);
  if (userData.heightFeet && userData.heightInches) personalInfoItems.push(`<div class="mb-2"><span class="font-medium text-primary">Height:</span> <span class="text-secondary">${userData.heightFeet}'${userData.heightInches}"</span></div>`);
  
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
  if (userData.jobTitle) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Job Designation:</span> <span class="text-secondary">${userData.jobTitle}</span></div>`);
  if (userData.company) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Company:</span> <span class="text-secondary">${userData.company}</span></div>`);
  if (userData.school) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Graduation College/School:</span> <span class="text-secondary">${userData.school}</span></div>`);
  if (userData.graduationYear) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Graduation Year:</span> <span class="text-secondary">${userData.graduationYear}</span></div>`);
  if (userData.highestDegree) workEducationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Degree Type:</span> <span class="text-secondary">${userData.highestDegree}</span></div>`);
  
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
  if (userData.currentLocation) locationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Current Location:</span> <span class="text-secondary">${userData.currentLocation}</span></div>`);
  if (userData.hometown) locationItems.push(`<div class="mb-2"><span class="font-medium text-primary">Hometown:</span> <span class="text-secondary">${userData.hometown}</span></div>`);
  
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
  
  // Lifestyle
  let lifestyleItems = [];
  if (userData.religion) lifestyleItems.push(`<div class="mb-2"><span class="font-medium text-primary">Religion:</span> <span class="text-secondary">${userData.religion}</span></div>`);
  if (userData.smoking) lifestyleItems.push(`<div class="mb-2"><span class="font-medium text-primary">Smoking:</span> <span class="text-secondary">${userData.smoking}</span></div>`);
  if (userData.drinking) lifestyleItems.push(`<div class="mb-2"><span class="font-medium text-primary">Drinking:</span> <span class="text-secondary">${userData.drinking}</span></div>`);
  
  if (lifestyleItems.length > 0) {
    profileDetails.push(`
      <div class="px-6 py-4">
        <h4 class="text-primary font-semibold mb-3 text-lg">Lifestyle</h4>
        <div class="space-y-2 text-base">
          ${lifestyleItems.join('')}
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
  
  // Set the card content
  card.innerHTML = contentSections.join('');
  
  return card;
} 

// --- Advanced Photo Grid Logic for Edit Profile ---
const NUM_PHOTOS = 6;
let photoFiles = Array(NUM_PHOTOS).fill(null); // Local File objects
let photoUrls = Array(NUM_PHOTOS).fill(null); // Uploaded URLs
let photoStatus = Array(NUM_PHOTOS).fill('empty'); // 'empty', 'uploading', 'success', 'error'
let draggingIndex = null;
let cropper = null;
let cropTargetIndex = null;

function renderPhotoGrid() {
    const grid = document.getElementById('photoGrid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < NUM_PHOTOS; i++) {
        const slot = document.createElement('div');
        slot.className = `relative group border-2 rounded-lg flex flex-col items-center justify-center aspect-square bg-white ${i === 0 ? 'border-primary' : 'border-gray-300'} cursor-pointer`;
        slot.setAttribute('draggable', 'true');
        slot.setAttribute('data-index', i);
        // Drag handle
        slot.innerHTML += `<div class="absolute top-2 left-2 z-10"><svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></div>`;
        // Main photo badge
        if (i === 0) {
            slot.innerHTML += `<div class="absolute top-2 right-2 bg-primary text-white text-xs px-2 py-0.5 rounded-full z-10">Main</div>`;
        }
        // Photo or placeholder
        if (photoUrls[i]) {
            slot.innerHTML += `<img src="${photoUrls[i]}" class="w-full h-full object-cover rounded-lg" alt="Photo ${i+1}">`;
        } else {
            slot.innerHTML += `<div class="flex flex-col items-center justify-center h-full w-full"><svg class="mx-auto h-10 w-10 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 48 48"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="text-xs text-secondary">Add Photo</span></div>`;
        }
        // Upload status
        if (photoStatus[i] === 'uploading') {
            slot.innerHTML += `
                <div class="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-20">
                    <svg class="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    <span class="text-primary text-xs font-semibold ml-2">Uploading...</span>
                </div>
            `;
        } else if (photoStatus[i] === 'error') {
            slot.innerHTML += `<div class="absolute inset-0 bg-red-50 bg-opacity-80 flex items-center justify-center z-20"><span class="text-red-600 text-xs font-semibold">Upload Failed</span></div>`;
        }
        // Remove button
        if (photoUrls[i]) {
            slot.innerHTML += `<button class="absolute bottom-2 right-2 bg-white border border-gray-300 rounded-full p-1 z-10" onclick="removePhoto(${i}); event.stopPropagation();"><svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>`;
        }
        // Click to add/change photo
        slot.addEventListener('click', (e) => {
            if (photoStatus[i] === 'uploading') return;
            openFileInput(i);
        });
        // Drag events
        slot.addEventListener('dragstart', (e) => { draggingIndex = i; });
        slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('ring-2', 'ring-primary'); });
        slot.addEventListener('dragleave', (e) => { slot.classList.remove('ring-2', 'ring-primary'); });
        slot.addEventListener('drop', (e) => { e.preventDefault(); slot.classList.remove('ring-2', 'ring-primary'); if (draggingIndex !== null && draggingIndex !== i) reorderPhotos(draggingIndex, i); draggingIndex = null; });
        grid.appendChild(slot);
    }
}

function openFileInput(index) {
    cropTargetIndex = index;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) openCropper(file);
    };
    input.click();
}

function openCropper(file) {
    const modal = document.getElementById('cropperModal');
    const img = document.getElementById('cropperImage');
    const cancelBtn = document.getElementById('cancelCropBtn');
    const confirmBtn = document.getElementById('confirmCropBtn');
    const reader = new FileReader();
    reader.onload = function(e) {
        img.src = e.target.result;
        modal.classList.remove('hidden');
        if (cropper) cropper.destroy();
        cropper = new Cropper(img, { aspectRatio: 1, viewMode: 1 });
    };
    reader.readAsDataURL(file);
    cancelBtn.onclick = () => { modal.classList.add('hidden'); if (cropper) cropper.destroy(); };
    confirmBtn.onclick = () => {
        if (!cropper) return;
        cropper.getCroppedCanvas({ width: 800, height: 800 }).toBlob(blob => {
            modal.classList.add('hidden');
            cropper.destroy();
            handlePhotoSelected(blob, cropTargetIndex);
        }, 'image/jpeg', 0.9);
    };
}

function handlePhotoSelected(file, index) {
    photoFiles[index] = file;
    photoStatus[index] = 'uploading';
    renderPhotoGrid();
    uploadPhotoAndSaveUrl(file, `photo${index+1}`).then(url => {
        photoUrls[index] = url;
        photoStatus[index] = 'success';
        renderPhotoGrid();
    }).catch(() => {
        photoStatus[index] = 'error';
        renderPhotoGrid();
    });
}

function removePhoto(index) {
    photoFiles[index] = null;
    photoUrls[index] = null;
    photoStatus[index] = 'empty';
    renderPhotoGrid();
}

function reorderPhotos(from, to) {
    [photoFiles[from], photoFiles[to]] = [photoFiles[to], photoFiles[from]];
    [photoUrls[from], photoUrls[to]] = [photoUrls[to], photoUrls[from]];
    [photoStatus[from], photoStatus[to]] = [photoStatus[to], photoStatus[from]];
    renderPhotoGrid();
}

// Patch uploadPhotoAndSaveUrl to return URL
async function uploadPhotoAndSaveUrl(file, photoKey) {
    const currentUser = auth.currentUser;
    if (!file || !currentUser || !currentUser.email) return Promise.reject();
    try {
        if (!firebase.storage) {
            alert('Firebase Storage not available. Please refresh the page and try again.');
            return Promise.reject();
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
                (snapshot) => {},
                (error) => { reject(error); },
                () => { resolve(uploadTask); }
            );
        });
        await uploadPromise;
        const url = await fileRef.getDownloadURL();
        return url;
    } catch (error) {
        return Promise.reject(error);
    }
}

// On edit profile load, initialize photo grid from userProfileData
function initializePhotoGridFromProfile() {
    if (!window.userProfileData) return;
    for (let i = 0; i < NUM_PHOTOS; i++) {
        const key = `photo${i+1}Url`;
        photoUrls[i] = window.userProfileData[key] || null;
        photoStatus[i] = photoUrls[i] ? 'success' : 'empty';
    }
    renderPhotoGrid();
}

document.addEventListener('DOMContentLoaded', () => {
    initializePhotoGridFromProfile();
});

// When saving profile, update userProfileData with all photo URLs
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
            heightFeet: document.getElementById('editHeightFeet').value,
            heightInches: document.getElementById('editHeightInches').value,
            datingPreferences: document.getElementById('editDatingPreferences').value,
            relationshipStatus: document.getElementById('editRelationshipStatus').value,
            datingIntentions: document.getElementById('editDatingIntentions').value,
            currentLocation: document.getElementById('editLocation').value,
            hometown: document.getElementById('editHometown').value,
            jobTitle: document.getElementById('editJobTitle').value,
            company: document.getElementById('editCompany').value,
            school: document.getElementById('editSchool').value,
            graduationYear: document.getElementById('editGraduationYear').value,
            highestDegree: document.getElementById('editHighestDegree').value,
            religion: document.getElementById('editReligion').value,
            smoking: document.getElementById('editSmoking').value,
            drinking: document.getElementById('editDrinking').value,
            bio: document.getElementById('editBio').value,
            updatedAt: new Date()
        };
        // Save the new photo order
        for (let i = 0; i < NUM_PHOTOS; i++) {
            updatedData[`photo${i+1}Url`] = photoUrls[i] || null;
            window.userProfileData[`photo${i+1}Url`] = photoUrls[i] || null;
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
// Firebase SDK
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

// Make Firebase available globally
window.firebaseAuth = auth;
window.firebaseDB = db;
window.firebaseStorage = storage;

// Global auth state listener for iOS Safari compatibility
firebase.auth().onAuthStateChanged(function(user) {
    console.log('=== GLOBAL AUTH STATE CHANGE ===');
    if (user) {
        console.log('✅ User signed in globally:', user.email);
        console.log('✅ Email verified:', user.emailVerified);
        console.log('✅ User ID:', user.uid);
        console.log('✅ Auth provider:', user.providerData[0]?.providerId);
    } else {
        console.log('❌ User signed out globally');
    }
});

let currentStep = 1;
const totalSteps = 6;
const profileData = {};

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const userEmail = urlParams.get('email');

// === Function Definitions ===

function cleanProfileDataForFirestore(data) {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
        if (value instanceof File) continue;
        if (typeof value === 'function') continue;
        if (value === undefined) continue;
        if (key.includes('Base64')) continue;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            cleaned[key] = cleanProfileDataForFirestore(value);
        } else {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

async function saveProfileDataToFirestore() {
    if (!userEmail) return;
    try {
        const user = await new Promise((resolve, reject) => {
            const currentUser = firebase.auth().currentUser;
            if (currentUser && currentUser.email && !currentUser.isAnonymous) {
                resolve(currentUser);
            } else {
                const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                    unsubscribe();
                    if (user && user.email && !user.isAnonymous) {
                        resolve(user);
                    } else {
                        reject(new Error('Not authenticated'));
                    }
                });
                setTimeout(() => {
                    unsubscribe();
                    reject(new Error('Auth timeout'));
                }, 3000);
            }
        });
        if (user.email.toLowerCase() !== userEmail.toLowerCase()) {
            alert('Authentication mismatch. Please log in again.');
            window.location.href = 'login.html';
            return;
        }
        const cleanedData = cleanProfileDataForFirestore(profileData);
        const userDocRef = db.collection('users').doc(userEmail);
        await userDocRef.set(cleanedData, { merge: true });
    } catch (error) {
        alert('Error saving profile data. Please try again.');
        if (error.message === 'Not authenticated' || error.message === 'Auth timeout') {
            window.location.href = 'login.html';
        }
    }
}

async function uploadPhotoAndSaveUrl(file, photoKey) {
    if (!file || !userEmail) return;
    showUploadStatus(photoKey, 'uploading', 0);
    try {
        const user = await new Promise((resolve, reject) => {
            const currentUser = firebase.auth().currentUser;
            if (currentUser && currentUser.email && !currentUser.isAnonymous) {
                resolve(currentUser);
            } else {
                const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                    unsubscribe();
                    if (user && user.email && !user.isAnonymous) {
                        resolve(user);
                    } else {
                        reject(new Error('Not authenticated'));
                    }
                });
                setTimeout(() => {
                    unsubscribe();
                    reject(new Error('Auth timeout'));
                }, 3000);
            }
        });
        if (user.email.toLowerCase() !== userEmail.toLowerCase()) {
            showUploadStatus(photoKey, 'error');
            alert('Authentication mismatch. Please log in again.');
            window.location.href = 'login.html';
            return;
        }
        if (!firebase.storage) {
            showUploadStatus(photoKey, 'error');
            alert('Firebase Storage not available. Please refresh the page and try again.');
            return;
        }
        const storage = firebase.storage();
        const optimizedFile = await optimizeImageForUpload(file);
        const storagePath = `users/${userEmail}/${photoKey}_${Date.now()}.jpg`;
        const fileRef = storage.ref(storagePath);
        const uploadPromise = new Promise((resolve, reject) => {
            const uploadTask = fileRef.put(optimizedFile, {
                contentType: 'image/jpeg',
                cacheControl: 'public, max-age=31536000'
            });
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    showUploadStatus(photoKey, 'uploading', progress);
                },
                (error) => {
                    showUploadStatus(photoKey, 'error');
                    reject(error);
                },
                () => {
                    showUploadStatus(photoKey, 'success');
                    resolve(uploadTask);
                }
            );
        });
        await uploadPromise;
        const url = await fileRef.getDownloadURL();
        profileData[photoKey + 'Url'] = url;
        profileData[photoKey + 'FileName'] = file.name;
        profileData[photoKey + 'FileType'] = 'image/jpeg';
        profileData[photoKey + 'FileSize'] = optimizedFile.size;
        profileData[photoKey + 'UploadedAt'] = new Date();
        await saveProfileDataToFirestore();
        setTimeout(() => {
            displayUploadedPhoto(photoKey, photoKey + 'Preview');
        }, 2000);
    } catch (error) {
        showUploadStatus(photoKey, 'error');
        alert('Error uploading photo. Please try again.');
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

function updateStepDisplay() {
    const stepNames = [
        'Personal Basics',
        'Location & Status', 
        'Work & Education',
        'Lifestyle & Preferences',
        'About You',
        'Photos'
    ];
    const currentStepNameElement = document.getElementById('currentStepName');
    currentStepNameElement.textContent = stepNames[currentStep - 1];
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    prevBtn.style.display = currentStep > 1 ? 'block' : 'none';
    if (currentStep === totalSteps) {
        nextBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
        `;
    } else {
        nextBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
        `;
    }
}

function saveCurrentStepData() {
    switch(currentStep) {
        case 1:
            profileData.fullName = document.getElementById('fullName').value;
            profileData.age = document.getElementById('age').value;
            profileData.gender = document.getElementById('gender').value;
            profileData.heightFeet = document.getElementById('heightFeet').value;
            profileData.heightInches = document.getElementById('heightInches').value;
            profileData.datingPreferences = document.getElementById('datingPreferences').value;
            break;
        case 2:
            profileData.relationshipStatus = document.getElementById('relationshipStatus').value;
            profileData.datingIntentions = document.getElementById('datingIntentions').value;
            profileData.currentLocation = document.getElementById('currentLocation').value;
            profileData.hometown = document.getElementById('hometown').value;
            break;
        case 3:
            profileData.jobTitle = document.getElementById('jobTitle').value;
            profileData.company = document.getElementById('company').value;
            profileData.school = document.getElementById('school').value;
            profileData.graduationYear = document.getElementById('graduationYear').value;
            profileData.highestDegree = document.getElementById('highestDegree').value;
            break;
        case 4:
            profileData.religion = document.getElementById('religion').value;
            profileData.smoking = document.getElementById('smoking').value;
            profileData.drinking = document.getElementById('drinking').value;
            break;
        case 5:
            profileData.bio = document.getElementById('bio').value;
            break;
        case 6:
            const photo1File = document.getElementById('photo1').files[0];
            const photo2File = document.getElementById('photo2').files[0];
            if (photo1File) {
                profileData.photo1FileName = photo1File.name;
                profileData.photo1FileSize = photo1File.size;
                profileData.photo1FileType = photo1File.type;
            }
            if (photo2File) {
                profileData.photo2FileName = photo2File.name;
                profileData.photo2FileSize = photo2File.size;
                profileData.photo2FileType = photo2File.type;
            }
            break;
    }
}

function loadStepData() {
    switch(currentStep) {
        case 1:
            if (profileData.fullName) document.getElementById('fullName').value = profileData.fullName;
            if (profileData.age) document.getElementById('age').value = profileData.age;
            if (profileData.gender) document.getElementById('gender').value = profileData.gender;
            if (profileData.heightFeet) document.getElementById('heightFeet').value = profileData.heightFeet;
            if (profileData.heightInches) document.getElementById('heightInches').value = profileData.heightInches;
            if (profileData.datingPreferences) document.getElementById('datingPreferences').value = profileData.datingPreferences;
            break;
        case 2:
            if (profileData.relationshipStatus) document.getElementById('relationshipStatus').value = profileData.relationshipStatus;
            if (profileData.datingIntentions) document.getElementById('datingIntentions').value = profileData.datingIntentions;
            if (profileData.currentLocation) document.getElementById('currentLocation').value = profileData.currentLocation;
            if (profileData.hometown) document.getElementById('hometown').value = profileData.hometown;
            break;
        case 3:
            if (profileData.jobTitle) document.getElementById('jobTitle').value = profileData.jobTitle;
            if (profileData.company) document.getElementById('company').value = profileData.company;
            if (profileData.school) document.getElementById('school').value = profileData.school;
            if (profileData.graduationYear) document.getElementById('graduationYear').value = profileData.graduationYear;
            if (profileData.highestDegree) document.getElementById('highestDegree').value = profileData.highestDegree;
            break;
        case 4:
            if (profileData.religion) document.getElementById('religion').value = profileData.religion;
            if (profileData.smoking) document.getElementById('smoking').value = profileData.smoking;
            if (profileData.drinking) document.getElementById('drinking').value = profileData.drinking;
            break;
        case 5:
            if (profileData.bio) document.getElementById('bio').value = profileData.bio;
            break;
        case 6:
            displayUploadedPhoto('photo1', 'photo1Preview');
            displayUploadedPhoto('photo2', 'photo2Preview');
            break;
    }
}

function validateCurrentStep() {
    switch(currentStep) {
        case 1:
            const fullName = document.getElementById('fullName').value.trim();
            const age = document.getElementById('age').value;
            const gender = document.getElementById('gender').value;
            const heightFeet = document.getElementById('heightFeet').value;
            const heightInches = document.getElementById('heightInches').value;
            if (!fullName) { alert('Please enter your full name'); return false; }
            if (!age || age < 18 || age > 100) { alert('Please enter a valid age (18-100)'); return false; }
            if (!gender) { alert('Please select your gender'); return false; }
            if (!heightFeet || !heightInches) { alert('Please select your height'); return false; }
            break;
        case 2:
            const relationshipStatus = document.getElementById('relationshipStatus').value;
            const datingIntentions = document.getElementById('datingIntentions').value;
            const currentLocation = document.getElementById('currentLocation').value;
            const hometown = document.getElementById('hometown').value;
            if (!relationshipStatus) { alert('Please select your relationship status'); return false; }
            if (!datingIntentions) { alert('Please select your dating intentions'); return false; }
            if (!currentLocation) { alert('Please enter your current location'); return false; }
            if (!hometown) { alert('Please enter your hometown'); return false; }
            break;
        case 3:
            const jobTitle = document.getElementById('jobTitle').value.trim();
            const company = document.getElementById('company').value.trim();
            const school = document.getElementById('school').value.trim();
            const graduationYear = document.getElementById('graduationYear').value;
            const highestDegree = document.getElementById('highestDegree').value;
            if (!jobTitle) { alert('Please enter your job designation'); return false; }
            if (!company) { alert('Please enter your company'); return false; }
            if (!school) { alert('Please enter your graduation college/school'); return false; }
            if (!graduationYear) { alert('Please enter your graduation year'); return false; }
            if (!highestDegree) { alert('Please select your degree type'); return false; }
            break;
        case 4:
            const religion = document.getElementById('religion').value;
            const smoking = document.getElementById('smoking').value;
            const drinking = document.getElementById('drinking').value;
            if (!religion) { alert('Please select your religion'); return false; }
            if (!smoking) { alert('Please select your smoking preference'); return false; }
            if (!drinking) { alert('Please select your drinking preference'); return false; }
            break;
        case 5:
            const bio = document.getElementById('bio').value.trim();
            if (!bio) { alert('Please write a bio about yourself'); return false; }
            break;
        case 6:
            if (!document.getElementById('photo1').files.length && !document.getElementById('photo2').files.length) { alert('Please upload at least one photo'); return false; }
            break;
    }
    return true;
}

async function nextStep() {
    if (!validateCurrentStep()) return;
    saveCurrentStepData();
    await saveProfileDataToFirestore();
    if (currentStep === totalSteps) {
        await completeProfile();
    } else {
        currentStep++;
        updateStepDisplay();
        loadStepContent();
        loadStepData();
    }
}

function previousStep() {
    if (currentStep > 1) {
        saveCurrentStepData();
        saveProfileDataToFirestore();
        currentStep--;
        updateStepDisplay();
        loadStepContent();
        loadStepData();
    }
}

function loadStepContent() {
    const stepContent = document.getElementById('stepContent');
    for (let i = 1; i <= totalSteps; i++) {
        const stepDiv = document.getElementById(`step${i}Content`);
        if (stepDiv) stepDiv.classList.add('hidden');
    }
    const currentStepDiv = document.getElementById(`step${currentStep}Content`);
    if (currentStepDiv) {
        currentStepDiv.classList.remove('hidden');
    }
}

function previewPhoto(input, previewId, placeholderId, imgId) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(previewId).classList.remove('hidden');
            document.getElementById(placeholderId).classList.add('hidden');
            document.getElementById(imgId).src = e.target.result;
        };
        reader.readAsDataURL(file);
        const photoKey = input.id;
        uploadPhotoAndSaveUrl(file, photoKey);
    }
}

async function completeProfile() {
    try {
        const nextBtn = document.getElementById('nextBtn');
        const originalText = nextBtn.textContent;
        nextBtn.textContent = 'Saving...';
        nextBtn.disabled = true;
        const finalProfileData = {
            ...profileData,
            email: userEmail,
            profileCompleted: true,
            createdAt: new Date(),
            height: `${profileData.heightFeet}'${profileData.heightInches}"`
        };
        delete finalProfileData.heightFeet;
        delete finalProfileData.heightInches;
        const userDocRef = db.collection('users').doc(userEmail);
        await userDocRef.set(finalProfileData, { merge: true });
        alert('Profile completed successfully!');
        window.location.href = 'home.html';
    } catch (error) {
        alert('Error saving profile. Please try again.');
        const nextBtn = document.getElementById('nextBtn');
        nextBtn.textContent = 'Complete Profile';
        nextBtn.disabled = false;
    }
}

function displayUploadedPhoto(photoKey, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (profileData[photoKey + 'Url']) {
        const img = document.createElement('img');
        img.src = profileData[photoKey + 'Url'];
        img.className = 'w-full h-32 object-cover rounded-lg mb-2';
        img.alt = 'Profile photo';
        container.appendChild(img);
        const note = document.createElement('p');
        note.textContent = '✓ Photo uploaded';
        note.className = 'text-xs text-green-600 text-center font-medium';
        container.appendChild(note);
        container.classList.remove('hidden');
        const placeholder = document.getElementById(photoKey + 'Placeholder');
        if (placeholder) placeholder.classList.add('hidden');
    } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'w-full h-32 bg-gray-200 rounded-lg mb-2 flex items-center justify-center';
        placeholder.innerHTML = `
            <div class="text-center">
                <svg class="mx-auto h-8 w-8 text-gray-400 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <p class="text-sm text-gray-500">No photo uploaded</p>
            </div>
        `;
        container.appendChild(placeholder);
        container.classList.remove('hidden');
    }
}

function showUploadStatus(photoKey, status, progress = 0) {
    const containerId = photoKey + 'Preview';
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
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
        container.appendChild(uploadDiv);
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
        container.appendChild(successDiv);
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
        container.appendChild(errorDiv);
    }
}

// === Main Logic ===
document.addEventListener('DOMContentLoaded', async function() {
    // Detect iOS Safari
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                       /Safari/.test(navigator.userAgent) && 
                       !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);
    
    console.log('=== PROFILE SETUP PAGE LOAD ===');
    console.log('User Agent:', navigator.userAgent);
    console.log('Is iOS Safari:', isIOSSafari);
    console.log('Email from URL:', userEmail);
    
    if (userEmail) {
        console.log('Waiting for authentication state to be established...');
        
        // Wait longer for iOS Safari
        const waitTime = isIOSSafari ? 5000 : 3000;
        console.log(`Waiting ${waitTime}ms for auth state...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        try {
            // Use auth state listener to get the most current user state
            await new Promise((resolve, reject) => {
                const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                    unsubscribe();
                    console.log('Auth state changed - User:', user);
                    
                    if (user && user.email) {
                        console.log('✅ User authenticated via listener:', user.email);
                        console.log('✅ Email verified:', user.emailVerified);
                        console.log('✅ User ID:', user.uid);
                        
                        // Verify the authenticated user matches the email in URL
                        if (user.email.toLowerCase() !== userEmail.toLowerCase()) {
                            console.log('❌ Email mismatch! Expected:', userEmail, 'Got:', user.email);
                            reject(new Error('Email mismatch'));
                            return;
                        }
                        
                        resolve(user);
                    } else {
                        console.log('❌ No user authenticated via listener');
                        reject(new Error('No user authenticated'));
                    }
                });
                
                // Timeout after 5 seconds
                setTimeout(() => {
                    unsubscribe();
                    reject(new Error('Auth state timeout'));
                }, 5000);
            });
            
            // Double-check with currentUser as backup
            const currentUser = firebase.auth().currentUser;
            console.log('Current user backup check:', currentUser);
            
            if (!currentUser || !currentUser.email || currentUser.isAnonymous) {
                console.log('❌ Current user check failed, but listener succeeded - continuing anyway');
            }
            
            console.log('✅ Authentication successful, loading profile data...');
            
            const userDocRef = db.collection('users').doc(userEmail);
            const userSnap = await userDocRef.get();
            if (userSnap.exists) {
                Object.assign(profileData, userSnap.data());
                console.log('✅ Profile data loaded successfully');
                console.log('Profile data:', profileData);
                
                // Check if profile has essential data (name, age, etc.)
                const hasEssentialData = profileData.fullName && profileData.age;
                console.log('Has essential profile data:', hasEssentialData);
                console.log('fullName:', profileData.fullName);
                console.log('age:', profileData.age);
                
                if (hasEssentialData) {
                    // Profile exists with essential data - redirect to home page
                    console.log('Profile has essential data, redirecting to home page');
                    alert('Profile already exists! Redirecting to home page...');
                    window.location.href = 'home.html';
                    return;
                }
            }
            
            // Load step data if available
            loadStepData();
        } catch (error) {
            console.error('Error during authentication or profile loading:', error);
        }
    }
    
    // Initialize step display and content
    updateStepDisplay();
    loadStepContent();
    loadStepData();
});

// === Expose Functions Globally ===
window.nextStep = nextStep;
window.previousStep = previousStep;
window.previewPhoto = previewPhoto; 
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
let cityList = [];
let stateList = [];
let currentLocationMode = 'city'; // or 'state'
let hometownMode = 'city'; // or 'state'

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

// --- Modern Photo Grid Logic for Step 6 ---
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
        console.log('[Cropper] Confirmed crop, getting blob...');
        cropper.getCroppedCanvas({ width: 800, height: 800 }).toBlob(blob => {
            modal.classList.add('hidden');
            cropper.destroy();
            console.log('[Cropper] Got cropped blob, calling handlePhotoSelected', blob, cropTargetIndex);
            handlePhotoSelected(blob, cropTargetIndex);
        }, 'image/jpeg', 0.9);
    };
}

function handlePhotoSelected(file, index) {
    console.log('[handlePhotoSelected] Called with file:', file, 'index:', index);
    photoFiles[index] = file;
    photoStatus[index] = 'uploading';
    renderPhotoGrid();
    uploadPhotoAndSaveUrl(file, `photo${index+1}`).then(url => {
        console.log('[handlePhotoSelected] Upload success, url:', url);
        photoUrls[index] = url;
        photoStatus[index] = 'success';
        renderPhotoGrid();
    }).catch((err) => {
        console.log('[handlePhotoSelected] Upload failed:', err);
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
    // Move photo data
    [photoFiles[from], photoFiles[to]] = [photoFiles[to], photoFiles[from]];
    [photoUrls[from], photoUrls[to]] = [photoUrls[to], photoUrls[from]];
    [photoStatus[from], photoStatus[to]] = [photoStatus[to], photoStatus[from]];
    renderPhotoGrid();
}

// Patch uploadPhotoAndSaveUrl to return URL
async function uploadPhotoAndSaveUrl(file, photoKey) {
    console.log('[uploadPhotoAndSaveUrl] Called with file:', file, 'photoKey:', photoKey);
    if (!file || !userEmail) { console.log('[uploadPhotoAndSaveUrl] No file or userEmail'); return Promise.reject(); }
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
            return Promise.reject();
        }
        if (!firebase.storage) {
            showUploadStatus(photoKey, 'error');
            alert('Firebase Storage not available. Please refresh the page and try again.');
            return Promise.reject();
        }
        const storage = firebase.storage();
        const optimizedFile = await optimizeImageForUpload(file);
        const storagePath = `users/${userEmail}/${photoKey}_${Date.now()}.jpg`;
        const fileRef = storage.ref(storagePath);
        console.log('[uploadPhotoAndSaveUrl] Starting upload to:', storagePath);
        const uploadPromise = new Promise((resolve, reject) => {
            const uploadTask = fileRef.put(optimizedFile, {
                contentType: 'image/jpeg',
                cacheControl: 'public, max-age=31536000'
            });
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    console.log('[uploadPhotoAndSaveUrl] Upload progress:', progress);
                },
                (error) => {
                    showUploadStatus(photoKey, 'error');
                    alert('Upload failed: ' + (error && error.message ? error.message : error));
                    console.log('[uploadPhotoAndSaveUrl] Upload error:', error);
                    reject(error);
                },
                () => {
                    showUploadStatus(photoKey, 'success');
                    console.log('[uploadPhotoAndSaveUrl] Upload success');
                    resolve(uploadTask);
                }
            );
        });
        await uploadPromise;
        const url = await fileRef.getDownloadURL();
        profileData[photoKey + 'Url'] = url;
        profileData[photoKey + 'GsPath'] = `gs://mindsmeet-a8945.firebasestorage.app/${storagePath}`;
        profileData[photoKey + 'FileName'] = file.name;
        profileData[photoKey + 'FileType'] = 'image/jpeg';
        profileData[photoKey + 'FileSize'] = optimizedFile.size;
        profileData[photoKey + 'UploadedAt'] = new Date();
        await saveProfileDataToFirestore();
        return url;
    } catch (error) {
        showUploadStatus(photoKey, 'error');
        alert('Error uploading photo. ' + (error && error.message ? error.message : error));
        console.log('[uploadPhotoAndSaveUrl] Caught error:', error);
        return Promise.reject(error);
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

function updateStepDisplay() {
    const stepNames = [
        'Basics',
        'Status',
        'Work',
        'Lifestyle',
        'About',
        'Photos'
    ];
    // Update minimal step indicator
    const circle = document.getElementById('currentStepCircle');
    const heading = document.getElementById('currentStepHeading');
    if (circle) circle.textContent = currentStep;
    if (heading) heading.textContent = stepNames[currentStep - 1];
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
            // No longer use photo1/photo2 file inputs; handled by photo grid
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
            // No longer use photo1/photo2 preview logic; handled by photo grid
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
            // Only validate using new photo grid logic (handled in nextStep patch)
            break;
    }
    return true;
}

// On step 6 show, render grid
function showStep6PhotoGrid() {
    if (document.getElementById('step6Content')) renderPhotoGrid();
}

// Patch nextStep to prevent continue if no photo or uploading
async function nextStep() {
    // Step 6 photo validation
    if (currentStep === 6) {
        if (!photoUrls[0]) { alert('Please upload at least one photo (main photo)'); return; }
        if (photoStatus.some(s => s === 'uploading')) { alert('Please wait for all uploads to finish'); return; }
        // Save photo order to profileData
        for (let i = 0; i < NUM_PHOTOS; i++) {
            profileData[`photo${i+1}Url`] = photoUrls[i] || null;
        }
    }
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
window.nextStep = nextStep;

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
window.previousStep = previousStep;

// On step change, render grid if step 6
const origLoadStepContent = loadStepContent;
loadStepContent = function() {
    origLoadStepContent.apply(this, arguments);
    if (currentStep === 6) showStep6PhotoGrid();
};

// Remove global previewPhoto
window.previewPhoto = undefined;

// Remove old displayUploadedPhoto logic for new grid

async function fetchCitiesAndStates() {
    // Fetch cities
    db.collection('indian_cities').orderBy('name').onSnapshot(snapshot => {
        cityList = snapshot.docs.map(doc => doc.data().name);
        updateLocationDropdowns();
    });
    // Fetch states
    db.collection('indian_states').orderBy('name').onSnapshot(snapshot => {
        stateList = snapshot.docs.map(doc => doc.data().name);
        updateLocationDropdowns();
    });
}

function updateLocationDropdown(field) {
    // field: 'currentLocation' or 'hometown'
    let select, mode, value, list;
    if (field === 'currentLocation') {
        select = document.getElementById('currentLocation');
        mode = currentLocationMode;
        value = select ? select.value : '';
        list = mode === 'city' ? cityList : stateList;
    } else if (field === 'hometown') {
        select = document.getElementById('hometown');
        mode = hometownMode;
        value = select ? select.value : '';
        list = mode === 'city' ? cityList : stateList;
    }
    if (select) {
        let options = '<option value="">Select a ' + (mode === 'city' ? 'city/place' : 'state') + '</option>';
        for (const item of list) {
            options += `<option value="${item}">${item}</option>`;
        }
        select.innerHTML = options;
        // Restore previous selection if present in new list
        if (value && list.includes(value)) {
            select.value = value;
        } else {
            select.value = '';
        }
    }
}

function updateLocationDropdowns() {
    updateLocationDropdown('currentLocation');
    updateLocationDropdown('hometown');
}

function setupLocationToggles() {
    const currentLocationToggle = document.getElementById('currentLocationToggle');
    const hometownToggle = document.getElementById('hometownToggle');
    if (currentLocationToggle) {
        currentLocationToggle.addEventListener('click', () => {
            currentLocationMode = currentLocationMode === 'city' ? 'state' : 'city';
            currentLocationToggle.textContent = currentLocationMode === 'city' ? 'Show States' : 'Show Cities';
            updateLocationDropdown('currentLocation');
        });
    }
    if (hometownToggle) {
        hometownToggle.addEventListener('click', () => {
            hometownMode = hometownMode === 'city' ? 'state' : 'city';
            hometownToggle.textContent = hometownMode === 'city' ? 'Show States' : 'Show Cities';
            updateLocationDropdown('hometown');
        });
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
    await fetchCitiesAndStates();
    setupLocationToggles();
});

// === Expose Functions Globally ===
window.previewPhoto = previewPhoto;

function loadStepContent() {
    for (let i = 1; i <= totalSteps; i++) {
        const stepDiv = document.getElementById(`step${i}Content`);
        if (stepDiv) stepDiv.classList.add('hidden');
    }
    const currentStepDiv = document.getElementById(`step${currentStep}Content`);
    if (currentStepDiv) currentStepDiv.classList.remove('hidden');
}

// Dummy showUploadStatus to prevent ReferenceError
function showUploadStatus(photoKey, status, progress) {
    // No-op: prevents ReferenceError. You can add UI updates here if you want.
    // Example: console.log(`[showUploadStatus] ${photoKey} - ${status} (${progress}%)`);
}

// Add a simple completeProfile function to allow step 6 to finish
async function completeProfile() {
    alert('Profile setup complete! Redirecting to home...');
    window.location.href = 'home.html'; // or wherever you want to send the user
} 
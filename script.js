import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { marked } from 'https://esm.sh/marked@12';

// --- SUPABASE KEYS ---
const SUPABASE_URL = 'https://uujccxawxkefiosujota.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1amNjeGF3eGtlZmlvc3Vqb3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNTIyMTYsImV4cCI6MjA3NTkyODIxNn0.aBGv9XfA5jWdbyJN8v-bWFJI6uIojmCABIlTdbNFQow';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM Elements ---
const dom = {
    authContainer: document.getElementById('auth-container'),
    emailFormContainer: document.getElementById('email-form-container'),
    emailForm: document.getElementById('email-form'),
    emailInput: document.getElementById('email-input'),
    otpFormContainer: document.getElementById('otp-form-container'),
    otpForm: document.getElementById('otp-form'),
    otpEmailDisplay: document.getElementById('otp-email-display'),
    otpInputs: document.querySelectorAll('.otp-digit'),
    changeEmailButton: document.getElementById('change-email-button'),
    profileFormContainer: document.getElementById('profile-form-container'),
    profileForm: document.getElementById('profile-form'),
    usernameInput: document.getElementById('username-input'),
    usernameError: document.getElementById('username-error'),
    chatContainer: document.getElementById('chat-container'),
    onlineUsersBar: document.getElementById('online-users-bar'),
    messagesContainer: document.getElementById('messages-container'),
    messageForm: document.getElementById('message-form'),
    messageInput: document.getElementById('message-input'),
    sendButton: document.getElementById('send-button'),
    voiceButton: document.getElementById('voice-button'),
    attachmentButton: document.getElementById('attachment-button'),
    fileUploadInput: document.getElementById('file-upload-input'),
    attachmentPreviewContainer: document.getElementById('attachment-preview-container'),
    modalBackdrop: document.getElementById('modal-backdrop'),
    settingsButton: document.getElementById('settings-button'),
    settingsModal: document.getElementById('settings-modal'),
    userProfileModal: document.getElementById('user-profile-modal'),
    closeModalButtons: document.querySelectorAll('.close-modal-button'),
    settingsAvatarPreview: document.getElementById('settings-avatar-preview'),
    avatarUploadInput: document.getElementById('avatar-upload-input'),
    updateProfileForm: document.getElementById('update-profile-form'),
    updateUsernameInput: document.getElementById('update-username-input'),
    updateBioInput: document.getElementById('update-bio-input'),
    updateLocationInput: document.getElementById('update-location-input'),
    updateWebsiteInput: document.getElementById('update-website-input'),
    updateDobInput: document.getElementById('update-dob-input'),
    logoutButton: document.getElementById('logout-button'),
    profileModalAvatar: document.getElementById('profile-modal-avatar'),
    profileModalUsername: document.getElementById('profile-modal-username'),
    profileModalVerified: document.getElementById('profile-modal-verified'),
    profileModalBadges: document.getElementById('profile-modal-badges'),
    profileModalBioContainer: document.getElementById('profile-modal-bio-container'),
    profileModalBio: document.getElementById('profile-modal-bio'),
    profileModalLocationContainer: document.getElementById('profile-modal-location-container'),
    profileModalLocation: document.getElementById('profile-modal-location'),
    profileModalWebsiteContainer: document.getElementById('profile-modal-website-container'),
    profileModalWebsite: document.getElementById('profile-modal-website'),
    profileModalDobContainer: document.getElementById('profile-modal-dob-container'),
    profileModalDob: document.getElementById('profile-modal-dob'),
    profileModalJoinDate: document.getElementById('profile-modal-joindate'),
    confirmDeleteModal: document.getElementById('confirm-delete-modal'),
    cancelDeleteButton: document.getElementById('cancel-delete-button'),
    confirmDeleteButton: document.getElementById('confirm-delete-button'),
    privacyToggles: document.querySelectorAll('#profile-privacy-settings input[type="checkbox"]'),
};

// --- App State ---
let currentUser = null;
let messagesSubscription = null;
let presenceChannel = null;
let messageToDelete = null;
let filesToUpload = [];
let mediaRecorder, audioChunks = [];

// --- Utility & Modal Functions ---
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');
const escapeHTML = (str) => String(str || '').replace(/[&<>"']/g, (match) => ({'&': '&amp;','<': '&lt;','>': '&gt;','"': '&quot;',"'": '&#39;'}[match]));
function showModal(modal) { show(dom.modalBackdrop); show(modal); }
function hideAllModals() { hide(dom.modalBackdrop); document.querySelectorAll('.modal').forEach(hide); }

// --- Authentication & Profile Setup ---
async function handleEmailLogin(e) {
    e.preventDefault();
    const email = dom.emailInput.value.trim();
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
        console.error('Error sending OTP:', error.message);
        alert('Error sending OTP. Please try again.');
    } else {
        dom.otpEmailDisplay.textContent = email;
        hide(dom.emailFormContainer);
        show(dom.otpFormContainer);
        dom.otpInputs[0].focus();
    }
}

async function verifyOtp() {
    let otp = '';
    dom.otpInputs.forEach(input => otp += input.value);
    if (otp.length !== 6) return;
    const email = dom.emailInput.value.trim();
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if (error) {
        console.error('Error verifying OTP:', error.message);
        alert('Invalid OTP. Please try again.');
        dom.otpInputs.forEach(i => i.value = '');
        dom.otpInputs[0].focus();
    } else if (data.session) {
        await initializeApp(data.session);
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const newUsername = dom.usernameInput.value.trim();
    if (!newUsername || newUsername.length < 3) return;
    const { error } = await supabase.from('users').update({ username: newUsername }).eq('id', currentUser.id);
    if (error) {
        dom.usernameError.textContent = 'Username might be taken.';
    } else {
        currentUser.username = newUsername;
        hide(dom.authContainer);
        show(dom.chatContainer);
        await loadInitialMessages();
        setupSubscriptions();
    }
}

async function handleLogout() {
    if (presenceChannel) await presenceChannel.untrack();
    await supabase.auth.signOut();
    if (messagesSubscription) messagesSubscription.unsubscribe();
    currentUser = null;
    dom.messagesContainer.innerHTML = '';
    dom.onlineUsersBar.innerHTML = '';
    hide(dom.chatContainer);
    hideAllModals();
    show(dom.authContainer);
    show(dom.emailFormContainer);
    hide(dom.otpFormContainer);
    hide(dom.profileFormContainer);
    dom.emailInput.value = '';
    dom.otpInputs.forEach(i => i.value = '');
}

async function initializeApp(session) {
    if (!session) {
        hide(dom.chatContainer);
        show(dom.authContainer);
        return;
    }
    const { data: userProfile, error } = await supabase.from('users').select('*').eq('id', session.user.id).single();
    if (error) {
        console.error("Error fetching user profile:", error.message);
        alert("Error loading your profile. This can happen if your profile wasn't created correctly. Please try logging in again.");
        await handleLogout();
        return;
    }
    currentUser = { ...session.user, ...userProfile };
    if (currentUser.username && currentUser.username.startsWith('user_')) {
        hide(dom.otpFormContainer);
        hide(dom.emailFormContainer);
        show(dom.profileFormContainer);
        dom.usernameInput.focus();
    } else {
        hide(dom.authContainer);
        show(dom.chatContainer);
        await loadInitialMessages();
        setupSubscriptions();
    }
}

// --- Real-time Subscriptions (ONLINE USERS FIX) ---
function setupSubscriptions() {
    if (messagesSubscription) messagesSubscription.unsubscribe();
    messagesSubscription = supabase.channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
          loadInitialMessages();
      }).subscribe();

    if (presenceChannel) presenceChannel.unsubscribe();
    // Use a unique channel name for presence
    presenceChannel = supabase.channel('online-users', {
        config: {
            presence: {
                key: currentUser.id,
            },
        },
    });

    presenceChannel.on('presence', { event: 'sync' }, () => {
        const presenceState = presenceChannel.presenceState();
        updateOnlineUsers(presenceState);
    });

    presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
                user_id: currentUser.id,
                username: currentUser.username,
                avatar_url: currentUser.avatar_url
            });
        }
    });
}


// --- UI Rendering ---
async function loadInitialMessages() {
    const { data, error } = await supabase.from('messages').select(`*, user:users(*)`).order('created_at', { ascending: true }).limit(100);
    if (error) { console.error('Error loading messages:', error.message); return; }
    dom.messagesContainer.innerHTML = '';
    data.forEach(renderMessage);
    setTimeout(() => { dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight; }, 100);
}

function renderMessage(message) {
    if (!message.user) return;
    const isSelf = message.user.id === currentUser.id;
    const container = document.createElement('div');
    container.className = 'message-container';
    
    const time = new Date(message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const defaultAvatar = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(message.user.username)}`;
    const avatarUrl = message.user.avatar_url || defaultAvatar;
    
    container.innerHTML = `
        <div class="message ${isSelf ? 'self' : 'other'}">
            ${renderMessageContent(message)}
        </div>
        <div class="message-footer">
            <img src="${avatarUrl}" alt="avatar" class="avatar" data-user-id="${message.user.id}">
            <span>${isSelf ? 'You' : escapeHTML(message.user.username)}</span>
            ${message.user.is_verified ? `<i class='bx bxs-badge-check verified-badge' title="Verified User"></i>` : ''}
            <span>• ${time}</span>
        </div>
    `;
    if (isSelf) {
        container.querySelector('.message').addEventListener('dblclick', () => {
            messageToDelete = message.id;
            showModal(dom.confirmDeleteModal);
        });
    }
    container.querySelector('.message-footer .avatar').addEventListener('click', () => showUserProfile(message.user.id));
    dom.messagesContainer.appendChild(container);
}

function renderMessageContent(message) {
    const content = message.content || {};
    let html = '';
    if (content.image_url) {
        html += `<img src="${content.image_url}" alt="User upload" class="message-image">`;
    }
    if (content.text) {
        html += `<div class="message-bubble">${marked.parse(escapeHTML(content.text))}</div>`;
    }
    if (message.type === 'voice_message' && content.voice_url) {
        return `<div class="message-bubble voice-card" data-src="${content.voice_url}"><i class='bx bx-play'></i> Voice Message</div>`;
    }
    if (!html) return `<div class="message-bubble">Unsupported message format</div>`;
    return html;
}

function updateOnlineUsers(presenceState) {
    dom.onlineUsersBar.innerHTML = '';
    const uniqueUsers = {};
    Object.values(presenceState).forEach(userPresence => {
        const user = userPresence[0];
        if (user && user.user_id && !uniqueUsers[user.user_id]) {
            uniqueUsers[user.user_id] = user;
        }
    });
    Object.values(uniqueUsers).forEach(user => {
        const defaultAvatar = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(user.username)}`;
        const avatarUrl = user.avatar_url || defaultAvatar;
        const userEl = document.createElement('img');
        userEl.src = avatarUrl;
        userEl.alt = escapeHTML(user.username);
        userEl.className = 'avatar';
        userEl.title = escapeHTML(user.username);
        userEl.onclick = () => showUserProfile(user.user_id);
        dom.onlineUsersBar.appendChild(userEl);
    });
}

// --- User Actions ---
async function handleMessageSubmit(e) {
    e.preventDefault();
    const text = dom.messageInput.value.trim();
    const files = [...filesToUpload];
    if (!text && files.length === 0) return;
    filesToUpload = [];
    dom.attachmentPreviewContainer.innerHTML = '';
    dom.messageInput.value = '';
    dom.messageInput.style.height = 'auto';
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        const file = files[0];
        const filePath = `${currentUser.id}/${Date.now()}_${file.name}`;
        await supabase.storage.from('uploads').upload(filePath, file);
        const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(filePath);
        await supabase.from('messages').insert({
            user_id: currentUser.id,
            type: 'text',
            content: { text: text || null, image_url: publicUrl }
        });
    } else if (text) {
        await supabase.from('messages').insert({ user_id: currentUser.id, type: 'text', content: { text: text } });
    }
}

async function handleVoiceButtonClick() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        dom.voiceButton.innerHTML = `<i class='bx bxs-microphone'></i>`;
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunks = [];
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorder.start();
            dom.voiceButton.innerHTML = `<i class='bx bxs-stop-circle' style="color: var(--danger);"></i>`;
            mediaRecorder.addEventListener("dataavailable", event => {
                audioChunks.push(event.data);
            });
            mediaRecorder.addEventListener("stop", async () => {
                dom.voiceButton.innerHTML = `<i class='bx bxs-microphone'></i>`;
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const filePath = `${currentUser.id}/${Date.now()}.webm`;
                await supabase.storage.from('voice_messages').upload(filePath, audioBlob);
                const { data: { publicUrl } } = supabase.storage.from('voice_messages').getPublicUrl(filePath);
                await supabase.from('messages').insert({ user_id: currentUser.id, type: 'voice_message', content: { voice_url: publicUrl } });
                stream.getTracks().forEach(track => track.stop());
            });
        } catch (err) {
            console.error("Microphone access denied:", err.message);
            alert("Microphone access is required to send voice messages.");
            dom.voiceButton.innerHTML = `<i class='bx bxs-microphone'></i>`;
        }
    }
}

// --- Profile Modals & Editing ---
function openSettingsModal() {
    const defaultAvatar = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(currentUser.username)}`;
    dom.settingsAvatarPreview.src = currentUser.avatar_url || defaultAvatar;
    dom.updateUsernameInput.value = currentUser.username;
    dom.updateBioInput.value = currentUser.bio || '';
    dom.updateLocationInput.value = currentUser.location || '';
    dom.updateWebsiteInput.value = currentUser.website || '';
    dom.updateDobInput.value = currentUser.dob || '';
    const privacy = currentUser.profile_privacy || {};
    dom.privacyToggles.forEach(toggle => {
        const key = toggle.dataset.privacyKey;
        toggle.checked = privacy[key] !== false;
    });
    showModal(dom.settingsModal);
}

async function handleProfileSettingsUpdate(e) {
    e.preventDefault();
    const privacySettings = {};
    dom.privacyToggles.forEach(toggle => { privacySettings[toggle.dataset.privacyKey] = toggle.checked; });
    let updates = {
        username: dom.updateUsernameInput.value.trim(),
        bio: dom.updateBioInput.value.trim(),
        location: dom.updateLocationInput.value.trim(),
        website: dom.updateWebsiteInput.value.trim(),
        dob: dom.updateDobInput.value || null,
        profile_privacy: privacySettings,
    };
    const file = dom.avatarUploadInput.files[0];
    if (file) {
        const filePath = `${currentUser.id}/${Date.now()}_${file.name}`;
        await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        updates.avatar_url = `${publicUrl}?t=${new Date().getTime()}`;
    }
    const { data, error } = await supabase.from('users').update(updates).eq('id', currentUser.id).select().single();
    if (error) { alert('Failed to update profile. Username might be taken.'); } 
    else {
        currentUser = { ...currentUser, ...data };
        hideAllModals();
        presenceChannel.track({ user_id: currentUser.id, username: currentUser.username, avatar_url: currentUser.avatar_url });
    }
}

async function showUserProfile(userId) {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!data) return;
    const defaultAvatar = `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(data.username)}`;
    dom.profileModalAvatar.src = data.avatar_url || defaultAvatar;
    dom.profileModalUsername.textContent = data.username;
    data.is_verified ? show(dom.profileModalVerified) : hide(dom.profileModalVerified);
    const badges = data.badges || [];
    const accountAge = (new Date() - new Date(data.created_at)) / (1000 * 60 * 60 * 24);
    if (accountAge < 7 && !badges.includes('newbie')) { badges.push('newbie'); }
    dom.profileModalBadges.innerHTML = '';
    badges.forEach(badge => {
        const badgeEl = document.createElement('span');
        badgeEl.className = `badge badge-${badge}`;
        badgeEl.textContent = badge;
        dom.profileModalBadges.appendChild(badgeEl);
    });
    const privacy = data.profile_privacy || {};
    (data.bio && privacy.show_bio) ? (show(dom.profileModalBioContainer), dom.profileModalBio.textContent = data.bio) : hide(dom.profileModalBioContainer);
    (data.location && privacy.show_location) ? (show(dom.profileModalLocationContainer), dom.profileModalLocation.textContent = data.location) : hide(dom.profileModalLocationContainer);
    (data.website && privacy.show_website) ? (show(dom.profileModalWebsiteContainer), dom.profileModalWebsite.textContent = data.website.replace(/^(https?:\/\/)?(www\.)?/, ''), dom.profileModalWebsite.href = data.website) : hide(dom.profileModalWebsiteContainer);
    (data.dob && privacy.show_dob) ? (show(dom.profileModalDobContainer), dom.profileModalDob.textContent = new Date(data.dob + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })) : hide(dom.profileModalDobContainer);
    dom.profileModalJoinDate.textContent = new Date(data.created_at).toLocaleDateString();
    showModal(dom.userProfileModal);
}

async function confirmMessageDelete() {
    if (!messageToDelete) return;
    await supabase.from('messages').delete().eq('id', messageToDelete);
    messageToDelete = null;
    hideAllModals();
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    dom.emailForm.addEventListener('submit', handleEmailLogin);
    dom.otpForm.addEventListener('submit', (e) => { e.preventDefault(); verifyOtp(); });
    dom.changeEmailButton.addEventListener('click', () => { hide(dom.otpFormContainer); show(dom.emailFormContainer); });
    dom.otpInputs.forEach((input, index) => {
        input.addEventListener('keyup', (e) => {
            const isDigit = e.key >= 0 && e.key <= 9;
            if (isDigit && index < 5 && input.value) { dom.otpInputs[index + 1].focus(); }
            if (e.key === 'Backspace' && index > 0 && !input.value) { dom.otpInputs[index - 1].focus(); }
        });
        input.addEventListener('input', () => { const otp = Array.from(dom.otpInputs).map(i => i.value).join(''); if (otp.length === 6) { verifyOtp(); } });
    });
    dom.profileForm.addEventListener('submit', handleProfileUpdate);
    dom.messageForm.addEventListener('submit', handleMessageSubmit);
    dom.messageInput.addEventListener('input', () => { dom.messageInput.style.height = 'auto'; dom.messageInput.style.height = `${dom.messageInput.scrollHeight}px`; });
    dom.voiceButton.addEventListener('click', handleVoiceButtonClick);
    dom.attachmentButton.addEventListener('click', () => dom.fileUploadInput.click());
    dom.fileUploadInput.addEventListener('change', (e) => {
        filesToUpload = Array.from(e.target.files);
        dom.attachmentPreviewContainer.innerHTML = '';
        filesToUpload.forEach((file, index) => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const preview = document.createElement('div');
                    preview.className = 'preview-item';
                    preview.innerHTML = `<img src="${event.target.result}" alt="${file.name}"><button class="preview-remove" data-index="${index}">&times;</button>`;
                    dom.attachmentPreviewContainer.appendChild(preview);
                };
                reader.readAsDataURL(file);
            }
        });
    });
    dom.attachmentPreviewContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('preview-remove')) {
            const indexToRemove = parseInt(e.target.dataset.index, 10);
            filesToUpload.splice(indexToRemove, 1);
            dom.fileUploadInput.value = '';
            e.target.parentElement.remove();
        }
    });
    dom.messagesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('voice-card')) {
            const audio = new Audio(e.target.dataset.src);
            audio.play();
        }
    });
    dom.settingsButton.addEventListener('click', openSettingsModal);
    dom.closeModalButtons.forEach(btn => btn.addEventListener('click', hideAllModals));
    dom.updateProfileForm.addEventListener('submit', handleProfileSettingsUpdate);
    dom.avatarUploadInput.addEventListener('change', () => { if (dom.avatarUploadInput.files[0]) dom.settingsAvatarPreview.src = URL.createObjectURL(dom.avatarUploadInput.files[0]); });
    dom.logoutButton.addEventListener('click', handleLogout);
    dom.confirmDeleteButton.addEventListener('click', confirmMessageDelete);
    dom.cancelDeleteButton.addEventListener('click', hideAllModals);
}

// --- Main Execution ---
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    const { data: { session } } = await supabase.auth.getSession();
    await initializeApp(session);
    supabase.auth.onAuthStateChange((_event, session) => {
        if (_event === 'SIGNED_OUT') { handleLogout(); } 
        else if (session && !currentUser) { initializeApp(session); }
    });
});
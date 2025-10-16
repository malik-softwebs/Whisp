// script.js (FINAL STABLE VERSION - FROM SCRATCH)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { marked } from 'https://esm.sh/marked@4';

// --- SUPABASE CLIENT SETUP ---
const SUPABASE_URL = 'https://zrtlacegsdlpykjkouzu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzIŠNiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpydGxhY2Vnc2RscHlramtvdXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAxOTExMTEsImV4cCI6MjA3NTc2NzExMX0.vhtS_zU5rymyyf0RN7nOp4ERl0Xbn96W3qKlKVyzIdA';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM ELEMENT REFERENCES ---
const screens = { auth: document.getElementById('auth-screen'), chat: document.getElementById('chat-screen') };
const authForms = { login: document.getElementById('login-form'), otp: document.getElementById('otp-form'), profile: document.getElementById('complete-profile-form') };
const formSwitchers = { backToLogin: document.getElementById('back-to-login') };
const authNotification = document.getElementById('auth-notification');
const messagesContainer = document.getElementById('messages-container');
const skeletonLoader = document.getElementById('skeleton-loader');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const fileUpload = document.getElementById('file-upload');
const logoutButton = document.getElementById('logout-button');
const settingsButton = document.getElementById('settings-button');
const loginEmailInput = document.getElementById('login-email');
const otpEmailDisplay = document.getElementById('otp-email-display');
const onlineUsersContainer = document.getElementById('online-users-container');
const settingsModal = document.getElementById('settings-modal');
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const profileViewModal = document.getElementById('profile-view-modal');
const closeSettingsModalButton = document.getElementById('close-settings-modal-button');
const closeProfileModalButton = document.getElementById('close-profile-modal-button');
const cancelDeleteButton = document.getElementById('cancel-delete-button');
const confirmDeleteButton = document.getElementById('confirm-delete-button');
const settingsForm = document.getElementById('settings-form');
const settingsAvatarPreview = document.getElementById('settings-avatar-preview');
const avatarUpload = document.getElementById('avatar-upload');
const settingsUsername = document.getElementById('settings-username');
const profileAvatar = document.getElementById('profile-avatar');
const profileUsername = document.getElementById('profile-username');
const profileBadges = document.getElementById('profile-badges');
const profileJoined = document.getElementById('profile-joined');
const voiceRecordButton = document.getElementById('voice-record-button');
const sendButton = document.getElementById('send-button');
const recordingIndicator = document.getElementById('recording-indicator');
const recordingTimerSpan = document.getElementById('recording-timer');

// --- APP STATE ---
let currentUser = null;
let usersCache = {};
let presenceChannel = null;
let messageChannel = null;
let messageToDelete = null;
let mediaRecorder, audioChunks = [], recordingStartTime, recordingTimerInterval, isRecording = false;

// --- UTILITY FUNCTIONS ---
const showScreen = (screenName) => {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
};
const showAuthForm = (formName) => Object.values(authForms).forEach(f => f.classList.toggle('active', f.id === `${formName}-form`));
const displayAuthNotification = (message, type = 'error') => {
    authNotification.textContent = message;
    authNotification.className = `notification ${type}`;
    authNotification.style.display = 'block';
};
const formatTime = (dateString) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const getAvatarUrl = (user) => user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`;
const openModal = (modal) => modal.classList.add('active');
const closeModal = (modal) => modal.classList.remove('active');

messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = `${messageInput.scrollHeight}px`;
    const hasText = messageInput.value.trim().length > 0;
    sendButton.style.display = hasText ? 'flex' : 'none';
    voiceRecordButton.style.display = hasText ? 'none' : 'flex';
});

// --- RENDER FUNCTIONS ---
const renderOnlineUsers = (presences) => {
    onlineUsersContainer.innerHTML = '';
    const userIds = Object.keys(presences);
    userIds.forEach(id => {
        const user = usersCache[id];
        if (user) {
            const avatarImg = document.createElement('img');
            avatarImg.src = getAvatarUrl(user);
            avatarImg.className = 'online-user-avatar';
            avatarImg.title = user.username;
            avatarImg.addEventListener('click', () => viewUserProfile(user.id));
            onlineUsersContainer.appendChild(avatarImg);
        }
    });
};

const renderMessages = async (messagesToRender = []) => {
    const userIds = new Set(messagesToRender.map(msg => msg.sender_id));
    const usersToFetch = [...userIds].filter(id => !usersCache[id]);

    if (usersToFetch.length > 0) {
        const { data: users, error } = await supabase.from('users').select('*').in('id', usersToFetch);
        if (error) console.error('Error fetching user profiles:', error);
        else users.forEach(user => usersCache[user.id] = user);
    }

    const fragment = document.createDocumentFragment();
    for (const msg of messagesToRender) {
        if (msg.deleted) continue;
        const user = usersCache[msg.sender_id] || { username: 'Unknown', avatar_url: null };
        const isSent = currentUser && msg.sender_id === currentUser.id;

        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isSent ? 'sent' : 'received'}`;
        wrapper.id = `message-${msg.id}`;
        
        if (isSent) wrapper.addEventListener('dblclick', () => promptDeleteMessage(msg.id));

        const meta = document.createElement('div');
        meta.className = 'meta';
        if (!isSent) {
            const avatar = document.createElement('img');
            avatar.className = 'avatar';
            avatar.src = getAvatarUrl(user);
            avatar.addEventListener('click', () => viewUserProfile(user.id));
            meta.appendChild(avatar);
        }
        meta.innerHTML += `<span class="username">${isSent ? 'You' : user.username}</span><span class="time">• ${formatTime(msg.timestamp)}</span>`;
        wrapper.appendChild(meta);

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerHTML = getMessageContentHTML(msg);
        wrapper.appendChild(bubble);
        fragment.appendChild(wrapper);
    }
    
    const innerContainer = messagesContainer.querySelector('.messages-inner');
    innerContainer.prepend(fragment);
};

const getMessageContentHTML = (msg) => {
    switch(msg.type) {
        case 'text': return msg.content_html || marked.parse(msg.content);
        case 'voice':
            return `<div class="voice-player" data-audio-src="${msg.file_url}"><button class="voice-player-button"><i class='bx bx-play'></i></button><div class="voice-player-waveform">${Array(30).fill(0).map(() => `<div class="bar"></div>`).join('')}</div><span class="voice-player-duration">${(msg.file_duration || 0).toFixed(1)}s</span></div>`;
        case 'file':
             return `<div class="file-card"><div class="file-info"><i class='bx bxs-file-blank file-icon'></i><div><a href="${msg.file_url}" target="_blank" rel="noopener noreferrer">${msg.file_name}</a><p>${msg.file_type}</p></div></div></div>`;
        case 'command': return renderCommand(msg.command_name, msg.command_data);
        default: return '';
    }
};

const renderCommand = (command, data) => {
    if (!data) return '<p>Command data is missing.</p>';
    switch(command) {
        case 'wiki':
            return `<div class="command-card"><div class="command-content"><h4><a href="${data.url}" target="_blank">${data.title}</a></h4><p>${data.extract}</p></div></div>`;
        case 'weather':
            return `<div class="command-card"><div class="command-content"><h4>Weather in ${data.location}</h4><p><strong>${data.temp_c} / ${data.temp_f}</strong> - ${data.condition}</p><p>Wind: ${data.wind_mph} | Humidity: ${data.humidity}</p></div></div>`;
        case 'pexels':
            return `<div class="command-card"><a href="${data.photographer_url}" target="_blank"><img src="${data.url}" alt="${data.alt}" class="pexels-img"></a><p class="pexels-by">Photo by ${data.photographer}</p></div>`;
        default: return `<p>Unknown command output.</p>`;
    }
};

// --- REALTIME ---
const setupRealtimeChannels = () => {
    if (presenceChannel) supabase.removeChannel(presenceChannel);
    presenceChannel = supabase.channel('online-users', { config: { presence: { key: currentUser.id } } });
    presenceChannel.on('presence', { event: 'sync' }, () => renderOnlineUsers(presenceChannel.presenceState())).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await presenceChannel.track({ online_at: new Date().toISOString() });
    });

    if (messageChannel) return;
    messageChannel = supabase.channel('public:messages').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') handleNewMessage(payload.new);
        else if (payload.eventType === 'UPDATE' && payload.new.deleted) handleDeletedMessage(payload.new.id);
    }).subscribe();
};

const cleanupRealtimeChannels = async () => {
    if (presenceChannel) {
        await presenceChannel.untrack();
        supabase.removeChannel(presenceChannel);
        presenceChannel = null;
    }
    if (messageChannel) {
        supabase.removeChannel(messageChannel);
        messageChannel = null;
    }
};

const handleNewMessage = (newMessage) => {
    renderMessages([newMessage]);
    if (messagesContainer.scrollTop > -200) messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

const handleDeletedMessage = (messageId) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
        messageElement.style.transition = 'opacity 0.5s, transform 0.5s';
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'scale(0.8)';
        setTimeout(() => messageElement.remove(), 500);
    }
};

// --- AUTHENTICATION & APP STATE MANAGEMENT ---
const handleAuthStateChange = async (session) => {
    if (session && currentUser?.id === session.user.id) {
        return; // Avoid re-initializing if the user is already set
    }
    if (session) {
        const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).single();
        if (profile) {
            if (profile.username.startsWith('user_')) {
                skeletonLoader.style.display = 'none';
                showScreen('auth'); 
                showAuthForm('profile');
            } else {
                currentUser = profile;
                await loadInitialChat();
            }
        }
    } else {
        currentUser = null;
        await cleanupRealtimeChannels();
        skeletonLoader.style.display = 'none';
        showScreen('auth');
        showAuthForm('login');
    }
};

const loadInitialChat = async () => {
    showScreen('chat');
    skeletonLoader.style.display = 'flex';
    
    const { data, error } = await supabase.from('messages').select('*').order('timestamp', { ascending: false }).limit(50);
    
    skeletonLoader.style.display = 'none';
    if (error) { console.error('Error fetching initial messages:', error); return; }
    
    const innerContainer = messagesContainer.querySelector('.messages-inner');
    innerContainer.innerHTML = '';
    
    await renderMessages(data.reverse());
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    setupRealtimeChannels();
};

authForms.login.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value;
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) displayAuthNotification(error.message);
    else { otpEmailDisplay.textContent = email; showAuthForm('otp'); }
});

authForms.otp.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmailInput.value;
    const token = document.getElementById('otp-code').value;
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) displayAuthNotification(error.message);
});

authForms.profile.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('profile-username').value;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('users').update({ username }).eq('id', user.id);
    if (error) displayAuthNotification(`Username update failed: ${error.message}.`);
});

logoutButton.addEventListener('click', async () => await supabase.auth.signOut());
formSwitchers.backToLogin.addEventListener('click', (e) => { e.preventDefault(); showAuthForm('login'); });

// --- PROFILE & SETTINGS ---
const viewUserProfile = (userId) => {
    const user = usersCache[userId];
    if (!user) return;
    profileAvatar.src = getAvatarUrl(user);
    profileUsername.textContent = user.username;
    profileJoined.textContent = new Date(user.created_at).toLocaleDateString();
    profileBadges.innerHTML = '';
    if (user.is_verified) profileBadges.innerHTML += `<i class='bx bxs-check-circle verified-tick' title="Verified"></i>`;
    if (user.badge) {
        const badgeEl = document.createElement('span');
        badgeEl.className = `badge ${user.badge}`;
        badgeEl.textContent = user.badge;
        profileBadges.appendChild(badgeEl);
    }
    openModal(profileViewModal);
};

avatarUpload.addEventListener('change', () => {
    const file = avatarUpload.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { settingsAvatarPreview.src = e.target.result; };
        reader.readAsDataURL(file);
    }
});

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newUsername = settingsUsername.value.trim();
    const avatarFile = avatarUpload.files[0];
    if (newUsername === currentUser.username && !avatarFile) { closeModal(settingsModal); return; }
    let newAvatarUrl = currentUser.avatar_url;
    if (avatarFile) {
        const filePath = `${currentUser.id}/${Date.now()}.${avatarFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
        if (uploadError) { alert(`Avatar upload failed: ${uploadError.message}`); return; }
        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        newAvatarUrl = data.publicUrl;
    }
    const { data: updatedUser, error: updateError } = await supabase
        .from('users').update({ username: newUsername, avatar_url: newAvatarUrl }).eq('id', currentUser.id).select().single();
    if (updateError) { alert(`Profile update failed: ${updateError.message}`); return; }
    currentUser = updatedUser;
    usersCache[currentUser.id] = updatedUser;
    if (presenceChannel) renderOnlineUsers(presenceChannel.presenceState());
    closeModal(settingsModal);
});

// --- MESSAGING ---
const sendMessage = async (content) => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;
    if (trimmedContent.startsWith('/')) { await handleCommand(trimmedContent); return; }
    await supabase.from('messages').insert({ sender_id: currentUser.id, content: trimmedContent, content_html: marked.parse(trimmedContent), type: 'text' });
};

const handleCommand = async (fullCommand) => {
    const parts = fullCommand.slice(1).split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1).join(' ');
    if (!command) return;
    try {
        const { data, error } = await supabase.functions.invoke('command-handler', { body: { command, args } });
        if (error || data.error) throw new Error(error?.message || data.error);
        await supabase.from('messages').insert({ sender_id: currentUser.id, content: `/${command} ${args}`, type: 'command', command_name: command, command_data: data.data });
    } catch (e) {
        await supabase.from('messages').insert({ sender_id: currentUser.id, content: `Error: ${e.message}`, content_html: `<p><strong>Error:</strong> ${e.message}</p>`, type: 'text' });
    }
};

const handleFileUpload = async (file) => {
    if (!file) return;
    const filePath = `public/${currentUser.id}/${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from('uploads').upload(filePath, file);
    if (uploadError) { alert(`File upload error: ${uploadError.message}`); return; }
    const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(filePath);
    await supabase.from('messages').insert({ sender_id: currentUser.id, content: `File: ${file.name}`, type: 'file', file_url: publicUrl, file_type: file.type, file_name: file.name });
};

messageForm.addEventListener('submit', (e) => { 
    e.preventDefault(); 
    sendMessage(messageInput.value); 
    messageInput.value=''; messageInput.style.height='auto'; 
    sendButton.style.display='none'; voiceRecordButton.style.display='flex'; 
});
fileUpload.addEventListener('change', (e) => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); });

// --- MESSAGE DELETION ---
const promptDeleteMessage = (id) => { messageToDelete = id; openModal(deleteConfirmModal); };
confirmDeleteButton.addEventListener('click', async () => {
    if (!messageToDelete) return;
    await supabase.from('messages').update({ deleted: true }).eq('id', messageToDelete);
    closeModal(deleteConfirmModal);
    messageToDelete = null;
});

// --- VOICE MESSAGING ---
const startRecording = async () => {
    if (isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true;
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.start();
        recordingIndicator.classList.add('active');
        recordingStartTime = Date.now();
        recordingTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            recordingTimerSpan.textContent = `${Math.floor(elapsed/60)}:${(elapsed%60).toString().padStart(2,'0')}`;
        }, 1000);
        mediaRecorder.addEventListener('dataavailable', e => audioChunks.push(e.data));
        voiceRecordButton.innerHTML = "<i class='bx bxs-send'></i>";
        voiceRecordButton.onclick = stopRecording;
    } catch (err) { alert("Microphone access denied."); }
};

const stopRecording = async () => {
    if (!isRecording) return;
    mediaRecorder.stop();
    isRecording = false;
    clearInterval(recordingTimerInterval);
    recordingIndicator.classList.remove('active');
    const duration = (Date.now() - recordingStartTime) / 1000;
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const filePath = `${currentUser.id}/${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage.from('voice_messages').upload(filePath, audioBlob);
    if (uploadError) { alert('Voice upload failed.'); return; }
    const { data: { publicUrl } } = supabase.storage.from('voice_messages').getPublicUrl(filePath);
    await supabase.from('messages').insert({ sender_id: currentUser.id, content: `Voice Message`, type: 'voice', file_url: publicUrl, file_duration: duration, file_name: "Voice Message" });
    voiceRecordButton.innerHTML = "<i class='bx bxs-microphone'></i>";
    voiceRecordButton.onclick = startRecording;
};

messagesContainer.addEventListener('click', e => {
    const player = e.target.closest('.voice-player');
    if (player && player.dataset.audioSrc) {
        const audio = new Audio(player.dataset.audioSrc);
        const button = player.querySelector('.voice-player-button i');
        const bars = player.querySelectorAll('.bar');
        button.className = 'bx bx-pause';
        audio.play();
        audio.addEventListener('timeupdate', () => {
            const progress = audio.currentTime / audio.duration;
            bars.forEach((bar, i) => bar.classList.toggle('played', i < Math.floor(bars.length * progress)));
        });
        audio.onended = () => { button.className = 'bx bx-play'; bars.forEach(bar => bar.classList.remove('played')); };
    }
});

// --- INITIALIZATION ---
const init = () => {
    // Wire up all static, non-auth-dependent event listeners first
    settingsButton.addEventListener('click', () => {
        if (currentUser) {
             settingsUsername.value = currentUser.username;
             settingsAvatarPreview.src = getAvatarUrl(currentUser);
             openModal(settingsModal);
        }
    });
    closeSettingsModalButton.addEventListener('click', () => closeModal(settingsModal));
    closeProfileModalButton.addEventListener('click', () => closeModal(profileViewModal));
    cancelDeleteButton.addEventListener('click', () => closeModal(deleteConfirmModal));
    window.addEventListener('click', (e) => { if (e.target.classList.contains('modal-overlay')) closeModal(e.target); });

    // This is the definitive, robust initialization flow.
    // It relies on onAuthStateChange as the single source of truth.
    // The added check for `currentUser` prevents the race condition on refresh.
    supabase.auth.onAuthStateChange(async (_event, session) => {
        await handleAuthStateChange(session);
    });
};

init();
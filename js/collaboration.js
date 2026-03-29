// CollabFlow - Firebase Realtime Database collaboration

import AppState, { emitStateChange, onStateChange } from './state.js';
import { generateRoomCode, deepClone, randomColor, randomUserName, getPortPositions } from './utils.js';
import { renderAllElements, renderElement, addElement } from './elements.js';
import { renderAllConnections, renderConnection, addConnection } from './connectors.js';
import { createSvgElement } from './utils.js';

// Firebase SDK imports (loaded via CDN in index.html)
let firebaseApp, database, auth;
let roomRef, elementsRef, connectionsRef, presenceRef, myPresenceRef;
let isInitialized = false;
let isSyncing = false; // Prevent re-entrant sync loops

// Firebase configuration - loaded from external file (gitignored)
let FIREBASE_CONFIG = null;

async function loadFirebaseConfig() {
    try {
        const module = await import('./firebase-config.js');
        FIREBASE_CONFIG = module.FIREBASE_CONFIG;
        return true;
    } catch (e) {
        console.log('firebase-config.js not found. Running in offline mode.');
        return false;
    }
}

// Check if Firebase config is set
function isConfigured() {
    return FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY";
}

// Initialize Firebase
export async function initFirebase() {
    await loadFirebaseConfig();

    if (!isConfigured()) {
        console.log('Firebase not configured. Running in offline mode.');
        updateConnectionStatus(false);
        return false;
    }

    try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js');
        const { getDatabase, ref, set, get, onValue, onChildAdded, onChildChanged, onChildRemoved, remove, onDisconnect, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js');
        const { getAuth, signInAnonymously } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js');

        firebaseApp = initializeApp(FIREBASE_CONFIG);
        database = getDatabase(firebaseApp);
        auth = getAuth(firebaseApp);

        // Sign in anonymously
        const cred = await signInAnonymously(auth);
        AppState.localUser.id = cred.user.uid;

        // Store Firebase functions on module scope for reuse
        window.__fb = { ref, set, get, onValue, onChildAdded, onChildChanged, onChildRemoved, remove, onDisconnect, serverTimestamp, database };

        isInitialized = true;
        updateConnectionStatus(true);

        // Set up state change listeners to sync local changes to Firebase
        setupLocalToFirebaseSync();

        return true;
    } catch (err) {
        console.error('Firebase initialization failed:', err);
        updateConnectionStatus(false);
        return false;
    }
}

// Create a new room
export async function createRoom() {
    if (!isInitialized) {
        showToast('Firebase not configured. See setup instructions.');
        return null;
    }

    const roomCode = generateRoomCode();
    const { ref, set, serverTimestamp } = window.__fb;

    roomRef = ref(database, `rooms/${roomCode}`);
    await set(ref(database, `rooms/${roomCode}/meta`), {
        createdAt: Date.now(),
        createdBy: AppState.localUser.name
    });

    AppState.roomCode = roomCode;
    AppState.isCollaborating = true;

    // Sync current state to room
    await syncStateToFirebase();

    // Start listening
    setupFirebaseListeners(roomCode);
    setupPresence(roomCode);

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('room', roomCode);
    window.history.replaceState({}, '', url);

    showToast(`Room created: ${roomCode}`);
    return roomCode;
}

// Join an existing room
export async function joinRoom(roomCode) {
    if (!isInitialized) {
        showToast('Firebase not configured. See setup instructions.');
        return false;
    }

    const { ref, get } = window.__fb;
    const snapshot = await get(ref(database, `rooms/${roomCode}/meta`));

    if (!snapshot.exists()) {
        showToast('Room not found!');
        return false;
    }

    AppState.roomCode = roomCode;
    AppState.isCollaborating = true;

    // Load room state
    await loadStateFromFirebase(roomCode);

    // Start listening
    setupFirebaseListeners(roomCode);
    setupPresence(roomCode);

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('room', roomCode);
    window.history.replaceState({}, '', url);

    showToast(`Joined room: ${roomCode}`);
    return true;
}

// Leave the current room
export function leaveRoom() {
    if (!AppState.isCollaborating) return;

    // Clean up presence
    if (myPresenceRef) {
        const { remove } = window.__fb;
        remove(myPresenceRef);
    }

    // Detach listeners (in practice we'd store listener refs)
    AppState.isCollaborating = false;
    AppState.roomCode = null;
    AppState.remoteUsers.clear();

    // Remove remote cursors
    const cursorLayer = document.getElementById('layer-cursors');
    if (cursorLayer) cursorLayer.innerHTML = '';

    // Update URL
    const url = new URL(window.location);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url);

    updateUsersDisplay();
    showToast('Left room');
}

// Sync entire local state to Firebase
async function syncStateToFirebase() {
    if (!AppState.isCollaborating || !isInitialized) return;

    const { ref, set } = window.__fb;

    const elements = {};
    for (const [id, el] of AppState.elements) {
        elements[id] = deepClone(el);
    }

    const connections = {};
    for (const [id, conn] of AppState.connections) {
        connections[id] = deepClone(conn);
    }

    await set(ref(database, `rooms/${AppState.roomCode}/elements`), elements);
    await set(ref(database, `rooms/${AppState.roomCode}/connections`), connections);
}

// Load state from Firebase
async function loadStateFromFirebase(roomCode) {
    const { ref, get } = window.__fb;

    const elemSnap = await get(ref(database, `rooms/${roomCode}/elements`));
    const connSnap = await get(ref(database, `rooms/${roomCode}/connections`));

    isSyncing = true;

    AppState.elements.clear();
    if (elemSnap.exists()) {
        const data = elemSnap.val();
        for (const [id, el] of Object.entries(data)) {
            AppState.elements.set(id, el);
        }
    }

    AppState.connections.clear();
    if (connSnap.exists()) {
        const data = connSnap.val();
        for (const [id, conn] of Object.entries(data)) {
            AppState.connections.set(id, conn);
        }
    }

    renderAllElements();
    renderAllConnections();

    isSyncing = false;
}

// Set up listeners for remote changes
function setupFirebaseListeners(roomCode) {
    const { ref, onChildAdded, onChildChanged, onChildRemoved } = window.__fb;

    elementsRef = ref(database, `rooms/${roomCode}/elements`);
    connectionsRef = ref(database, `rooms/${roomCode}/connections`);

    // Elements
    onChildAdded(elementsRef, (snapshot) => {
        if (isSyncing) return;
        const id = snapshot.key;
        const el = snapshot.val();
        if (!AppState.elements.has(id)) {
            isSyncing = true;
            AppState.elements.set(id, el);
            renderElement(id);
            isSyncing = false;
        }
    });

    onChildChanged(elementsRef, (snapshot) => {
        if (isSyncing) return;
        const id = snapshot.key;
        const el = snapshot.val();
        isSyncing = true;
        AppState.elements.set(id, el);
        renderElement(id);
        isSyncing = false;
    });

    onChildRemoved(elementsRef, (snapshot) => {
        if (isSyncing) return;
        const id = snapshot.key;
        isSyncing = true;
        AppState.elements.delete(id);
        AppState.selection.delete(id);
        const svgGroup = document.querySelector(`#layer-elements [data-id="${id}"]`);
        if (svgGroup) svgGroup.remove();
        isSyncing = false;
    });

    // Connections
    onChildAdded(connectionsRef, (snapshot) => {
        if (isSyncing) return;
        const id = snapshot.key;
        const conn = snapshot.val();
        if (!AppState.connections.has(id)) {
            isSyncing = true;
            AppState.connections.set(id, conn);
            renderConnection(id);
            isSyncing = false;
        }
    });

    onChildChanged(connectionsRef, (snapshot) => {
        if (isSyncing) return;
        const id = snapshot.key;
        const conn = snapshot.val();
        isSyncing = true;
        AppState.connections.set(id, conn);
        renderConnection(id);
        isSyncing = false;
    });

    onChildRemoved(connectionsRef, (snapshot) => {
        if (isSyncing) return;
        const id = snapshot.key;
        isSyncing = true;
        AppState.connections.delete(id);
        const group = document.querySelector(`#layer-connections [data-conn-id="${id}"]`);
        if (group) group.remove();
        isSyncing = false;
    });
}

// Set up presence tracking
function setupPresence(roomCode) {
    const { ref, set, onValue, onDisconnect, remove } = window.__fb;

    presenceRef = ref(database, `rooms/${roomCode}/presence`);
    myPresenceRef = ref(database, `rooms/${roomCode}/presence/${AppState.localUser.id}`);

    // Set my presence
    set(myPresenceRef, {
        name: AppState.localUser.name,
        color: AppState.localUser.color,
        cursor: { x: 0, y: 0 },
        joinedAt: Date.now()
    });

    // Remove my presence on disconnect
    onDisconnect(myPresenceRef).remove();

    // Listen for all presence changes
    onValue(presenceRef, (snapshot) => {
        AppState.remoteUsers.clear();
        if (snapshot.exists()) {
            const data = snapshot.val();
            for (const [uid, user] of Object.entries(data)) {
                if (uid !== AppState.localUser.id) {
                    AppState.remoteUsers.set(uid, user);
                }
            }
        }
        updateUsersDisplay();
        renderRemoteCursors();
    });
}

// Sync local changes to Firebase
function setupLocalToFirebaseSync() {
    // Listen for element changes
    onStateChange('element:added', (el) => {
        if (isSyncing || !AppState.isCollaborating) return;
        const { ref, set } = window.__fb;
        set(ref(database, `rooms/${AppState.roomCode}/elements/${el.id}`), deepClone(el));
    });

    onStateChange('element:moved', (data) => {
        if (isSyncing || !AppState.isCollaborating) return;
        const el = AppState.elements.get(data.id);
        if (el) {
            const { ref, set } = window.__fb;
            set(ref(database, `rooms/${AppState.roomCode}/elements/${el.id}`), deepClone(el));
        }
    });

    onStateChange('element:textChanged', (data) => {
        if (isSyncing || !AppState.isCollaborating) return;
        const el = AppState.elements.get(data.id);
        if (el) {
            const { ref, set } = window.__fb;
            set(ref(database, `rooms/${AppState.roomCode}/elements/${el.id}`), deepClone(el));
        }
    });

    onStateChange('element:styleChanged', (data) => {
        if (isSyncing || !AppState.isCollaborating) return;
        const el = AppState.elements.get(data.id);
        if (el) {
            const { ref, set } = window.__fb;
            set(ref(database, `rooms/${AppState.roomCode}/elements/${el.id}`), deepClone(el));
        }
    });

    onStateChange('element:removed', (data) => {
        if (isSyncing || !AppState.isCollaborating) return;
        const { ref, remove } = window.__fb;
        remove(ref(database, `rooms/${AppState.roomCode}/elements/${data.id}`));
    });

    onStateChange('connection:added', (conn) => {
        if (isSyncing || !AppState.isCollaborating) return;
        const { ref, set } = window.__fb;
        set(ref(database, `rooms/${AppState.roomCode}/connections/${conn.id}`), deepClone(conn));
    });

    onStateChange('connection:removed', (data) => {
        if (isSyncing || !AppState.isCollaborating) return;
        const { ref, remove } = window.__fb;
        remove(ref(database, `rooms/${AppState.roomCode}/connections/${data.id}`));
    });

    onStateChange('connection:labelChanged', (data) => {
        if (isSyncing || !AppState.isCollaborating) return;
        const conn = AppState.connections.get(data.id);
        if (conn) {
            const { ref, set } = window.__fb;
            set(ref(database, `rooms/${AppState.roomCode}/connections/${conn.id}`), deepClone(conn));
        }
    });

    // Cursor position updates
    onStateChange('cursor:moved', (pos) => {
        if (!AppState.isCollaborating || !myPresenceRef) return;
        const { ref, set } = window.__fb;
        // Throttled updates (we rely on the throttle in drag.js)
        set(ref(database, `rooms/${AppState.roomCode}/presence/${AppState.localUser.id}/cursor`), pos);
    });

    // Full state restore (undo/redo)
    onStateChange('state:restored', () => {
        if (!AppState.isCollaborating) return;
        syncStateToFirebase();
    });
}

// Render remote user cursors on the canvas
function renderRemoteCursors() {
    const layer = document.getElementById('layer-cursors');
    if (!layer) return;
    layer.innerHTML = '';

    for (const [uid, user] of AppState.remoteUsers) {
        if (!user.cursor) continue;

        const group = createSvgElement('g', {
            class: 'remote-cursor',
            transform: `translate(${user.cursor.x}, ${user.cursor.y})`
        });

        // Cursor arrow
        const pointer = createSvgElement('path', {
            d: 'M 0 0 L 0 16 L 4.5 12.5 L 8.5 20 L 11 19 L 7 11 L 12.5 11 Z',
            fill: user.color,
            stroke: 'white',
            'stroke-width': 1,
            class: 'remote-cursor-pointer'
        });
        group.appendChild(pointer);

        // Name label
        const labelBg = createSvgElement('rect', {
            x: 14,
            y: 14,
            width: user.name.length * 7 + 12,
            height: 20,
            fill: user.color,
            class: 'remote-cursor-label-bg'
        });
        group.appendChild(labelBg);

        const label = createSvgElement('text', {
            x: 20,
            y: 28,
            class: 'remote-cursor-label'
        });
        label.textContent = user.name;
        group.appendChild(label);

        layer.appendChild(group);
    }
}

// Update the user avatars display in toolbar
function updateUsersDisplay() {
    const container = document.getElementById('users-display');
    if (!container) return;

    container.innerHTML = '';

    // Local user
    const localAvatar = createUserAvatar(AppState.localUser.name, AppState.localUser.color, 'You');
    container.appendChild(localAvatar);

    // Remote users
    for (const [uid, user] of AppState.remoteUsers) {
        const avatar = createUserAvatar(user.name, user.color, user.name);
        container.appendChild(avatar);
    }
}

function createUserAvatar(name, color, tooltip) {
    const div = document.createElement('div');
    div.className = 'user-avatar';
    div.style.backgroundColor = color;
    div.textContent = name.charAt(0).toUpperCase();
    div.title = tooltip;

    const tip = document.createElement('span');
    tip.className = 'user-tooltip';
    tip.textContent = tooltip;
    div.appendChild(tip);

    return div;
}

// Connection status indicator
function updateConnectionStatus(online) {
    const dot = document.getElementById('connection-dot');
    if (dot) {
        dot.classList.toggle('offline', !online);
    }
    const label = document.getElementById('connection-label');
    if (label) {
        label.textContent = online ? 'Online' : 'Offline';
    }
}

// Show a toast notification
function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 200);
    }, 3000);
}

// Auto-join room from URL
export async function checkAutoJoin() {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
        if (isInitialized) {
            await joinRoom(roomCode);
        }
    }
}

// Get share URL for current room
export function getRoomShareUrl() {
    if (!AppState.roomCode) return null;
    const url = new URL(window.location);
    url.searchParams.set('room', AppState.roomCode);
    return url.toString();
}

export { showToast };

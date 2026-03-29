// CollabFlow - Central state store

import { randomColor, randomUserName } from './utils.js';

const AppState = {
    // Data (synced with Firebase when collaborative)
    elements: new Map(),
    connections: new Map(),

    // UI state (local only)
    selection: new Set(),
    mode: 'idle', // idle | dragging | connecting | rubber_band | editing | panning | placing
    viewport: { panX: 0, panY: 0, zoom: 1.0 },
    theme: localStorage.getItem('collabflow-theme') || 'dark',
    clipboard: [],
    activeTool: 'select', // select | process | decision | start_end | text_label | connector

    // Placing state (when dropping a new shape)
    placingType: null,

    // Drag state
    dragStartX: 0,
    dragStartY: 0,
    dragOffsets: new Map(), // id -> { dx, dy } offset from cursor to element origin

    // Rubber band state
    rubberBand: null, // { startX, startY, currentX, currentY }

    // Connecting state
    connectingFrom: null, // { elementId, port }
    connectingTo: null,   // { x, y } current cursor position

    // Editing state
    editingElementId: null,

    // Collaboration state
    isCollaborating: false,
    roomCode: null,
    localUser: {
        id: null,
        name: randomUserName(),
        color: randomColor()
    },
    remoteUsers: new Map(),

    // History
    undoStack: [],
    redoStack: [],
    maxHistorySize: 50,

    // Grid
    gridSize: 20,
    snapToGrid: true,
    showGrid: true,

    // Listeners for state changes
    _listeners: new Map(),
};

// Simple event system for state changes
export function onStateChange(event, callback) {
    if (!AppState._listeners.has(event)) {
        AppState._listeners.set(event, []);
    }
    AppState._listeners.get(event).push(callback);
}

export function emitStateChange(event, data) {
    const listeners = AppState._listeners.get(event) || [];
    for (const cb of listeners) {
        cb(data);
    }
}

export default AppState;

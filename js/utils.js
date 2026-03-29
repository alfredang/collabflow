// CollabFlow - Utility functions

// Generate a short unique ID
export function generateId(prefix = 'el') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}_${result}`;
}

// Generate a room code (6 chars, uppercase alphanumeric)
export function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Snap a value to grid
export function snap(value, gridSize = 20) {
    return Math.round(value / gridSize) * gridSize;
}

// Clamp a value between min and max
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Debounce function
export function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// Throttle function
export function throttle(fn, limit) {
    let inThrottle = false;
    return (...args) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => { inThrottle = false; }, limit);
        }
    };
}

// Distance between two points
export function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Check if point is inside a rect
export function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

// Check if two rects overlap
export function rectsOverlap(r1, r2) {
    return !(r1.x + r1.width < r2.x ||
             r2.x + r2.width < r1.x ||
             r1.y + r1.height < r2.y ||
             r2.y + r2.height < r1.y);
}

// Check if point is inside a diamond (decision shape)
export function pointInDiamond(px, py, cx, cy, hw, hh) {
    // hw = half width, hh = half height
    const dx = Math.abs(px - cx) / hw;
    const dy = Math.abs(py - cy) / hh;
    return (dx + dy) <= 1;
}

// Get center of an element
export function getCenter(el) {
    return {
        x: el.x + el.width / 2,
        y: el.y + el.height / 2
    };
}

// Get port positions for an element
export function getPortPositions(el) {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    return {
        top: { x: cx, y: el.y },
        bottom: { x: cx, y: el.y + el.height },
        left: { x: el.x, y: cy },
        right: { x: el.x + el.width, y: cy }
    };
}

// Find the best port pair for connecting two elements
export function bestPorts(sourceEl, targetEl) {
    const sc = getCenter(sourceEl);
    const tc = getCenter(targetEl);
    const dx = tc.x - sc.x;
    const dy = tc.y - sc.y;

    if (Math.abs(dy) > Math.abs(dx)) {
        return dy > 0
            ? { from: 'bottom', to: 'top' }
            : { from: 'top', to: 'bottom' };
    } else {
        return dx > 0
            ? { from: 'right', to: 'left' }
            : { from: 'left', to: 'right' };
    }
}

// Random color from a curated palette
const PALETTE = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6'
];

export function randomColor() {
    return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

// Random user name
export function randomUserName() {
    const adjectives = ['Swift', 'Bright', 'Cool', 'Bold', 'Calm', 'Epic', 'Keen', 'Wise'];
    const nouns = ['Fox', 'Owl', 'Bear', 'Wolf', 'Hawk', 'Lynx', 'Deer', 'Hare'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj} ${noun}`;
}

// SVG namespace
export const SVG_NS = 'http://www.w3.org/2000/svg';

// Create SVG element helper
export function createSvgElement(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, val] of Object.entries(attrs)) {
        el.setAttribute(key, val);
    }
    return el;
}

// Deep clone an object (simple JSON-based)
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

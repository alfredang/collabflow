// CollabFlow - Shape factory and SVG rendering

import AppState, { emitStateChange } from './state.js';
import { generateId, createSvgElement, getPortPositions, snap } from './utils.js';

// Default styles per element type
const DEFAULT_STYLES = {
    process: {
        fill: 'var(--shape-fill)',
        stroke: 'var(--shape-stroke)',
        strokeWidth: 2,
        fontSize: 14,
        textColor: 'var(--text-primary)',
        borderRadius: 8
    },
    decision: {
        fill: 'var(--shape-fill-alt)',
        stroke: 'var(--shape-stroke)',
        strokeWidth: 2,
        fontSize: 13,
        textColor: 'var(--text-primary)',
        borderRadius: 0
    },
    start_end: {
        fill: 'var(--shape-fill-accent)',
        stroke: 'var(--accent)',
        strokeWidth: 2,
        fontSize: 14,
        textColor: 'var(--text-primary)',
        borderRadius: 999
    },
    text_label: {
        fill: 'none',
        stroke: 'none',
        strokeWidth: 0,
        fontSize: 14,
        textColor: 'var(--text-primary)',
        borderRadius: 0
    }
};

// Default dimensions per type
const DEFAULT_DIMENSIONS = {
    process: { width: 160, height: 80 },
    decision: { width: 140, height: 100 },
    start_end: { width: 140, height: 50 },
    text_label: { width: 120, height: 40 }
};

// Create a new element data object
export function createElement(type, x, y) {
    const dims = DEFAULT_DIMENSIONS[type];
    const style = { ...DEFAULT_STYLES[type] };
    const defaultTexts = {
        process: 'Process',
        decision: 'Decision?',
        start_end: type === 'start_end' ? 'Start' : 'Start',
        text_label: 'Label'
    };

    return {
        id: generateId('el'),
        type,
        x: AppState.snapToGrid ? snap(x - dims.width / 2) : x - dims.width / 2,
        y: AppState.snapToGrid ? snap(y - dims.height / 2) : y - dims.height / 2,
        width: dims.width,
        height: dims.height,
        text: defaultTexts[type],
        style,
        zIndex: AppState.elements.size + 1,
        locked: false
    };
}

// Add element to state and render
export function addElement(element) {
    AppState.elements.set(element.id, element);
    renderElement(element.id);
    emitStateChange('element:added', element);
    return element;
}

// Remove element from state and DOM
export function removeElement(id) {
    const el = AppState.elements.get(id);
    if (!el) return;

    // Remove SVG
    const svgGroup = document.querySelector(`#layer-elements [data-id="${id}"]`);
    if (svgGroup) svgGroup.remove();

    // Remove from state
    AppState.elements.delete(id);
    AppState.selection.delete(id);

    emitStateChange('element:removed', { id });
}

// Render or update a single element's SVG
export function renderElement(id) {
    const el = AppState.elements.get(id);
    const layer = document.getElementById('layer-elements');

    if (!el) {
        // Element was deleted, remove SVG
        const existing = layer.querySelector(`[data-id="${id}"]`);
        if (existing) existing.remove();
        return;
    }

    let group = layer.querySelector(`[data-id="${id}"]`);
    const isNew = !group;

    if (isNew) {
        group = createSvgElement('g', { 'data-id': id, 'data-type': el.type });
        group.classList.add('flowchart-element');
        layer.appendChild(group);
    } else {
        // Clear existing children for re-render
        group.innerHTML = '';
    }

    // Render shape based on type
    switch (el.type) {
        case 'process':
            renderProcess(group, el);
            break;
        case 'decision':
            renderDecision(group, el);
            break;
        case 'start_end':
            renderStartEnd(group, el);
            break;
        case 'text_label':
            renderTextLabel(group, el);
            break;
    }

    // Add text
    if (el.type !== 'text_label') {
        renderText(group, el);
    } else {
        renderLabelText(group, el);
    }

    // Render ports (hidden until hover)
    renderPorts(group, el);

    // Set z-index via order
    group.style.order = el.zIndex;
}

function renderProcess(group, el) {
    const rect = createSvgElement('rect', {
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        rx: el.style.borderRadius,
        ry: el.style.borderRadius,
        fill: el.style.fill,
        stroke: el.style.stroke,
        'stroke-width': el.style.strokeWidth,
        class: 'shape-body'
    });
    group.appendChild(rect);
}

function renderDecision(group, el) {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const points = `${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`;

    const polygon = createSvgElement('polygon', {
        points,
        fill: el.style.fill,
        stroke: el.style.stroke,
        'stroke-width': el.style.strokeWidth,
        class: 'shape-body'
    });
    group.appendChild(polygon);
}

function renderStartEnd(group, el) {
    const rect = createSvgElement('rect', {
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        rx: el.height / 2,
        ry: el.height / 2,
        fill: el.style.fill,
        stroke: el.style.stroke,
        'stroke-width': el.style.strokeWidth,
        class: 'shape-body'
    });
    group.appendChild(rect);
}

function renderTextLabel(group, el) {
    // Text labels have no shape background, but we add an invisible hit area
    const rect = createSvgElement('rect', {
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        fill: 'transparent',
        stroke: 'none',
        class: 'shape-body'
    });
    group.appendChild(rect);
}

function renderText(group, el) {
    const text = createSvgElement('text', {
        x: el.x + el.width / 2,
        y: el.y + el.height / 2,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        fill: el.style.textColor,
        'font-size': el.style.fontSize,
        'font-family': 'Inter, system-ui, sans-serif',
        class: 'shape-text',
        'pointer-events': 'none'
    });
    text.textContent = el.text;
    group.appendChild(text);
}

function renderLabelText(group, el) {
    const text = createSvgElement('text', {
        x: el.x + el.width / 2,
        y: el.y + el.height / 2,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        fill: el.style.textColor,
        'font-size': el.style.fontSize,
        'font-family': 'Inter, system-ui, sans-serif',
        'font-weight': '500',
        class: 'shape-text',
        'pointer-events': 'none'
    });
    text.textContent = el.text;
    group.appendChild(text);
}

function renderPorts(group, el) {
    const ports = getPortPositions(el);
    for (const [name, pos] of Object.entries(ports)) {
        const circle = createSvgElement('circle', {
            cx: pos.x,
            cy: pos.y,
            r: 6,
            fill: 'var(--accent)',
            stroke: 'var(--bg-primary)',
            'stroke-width': 2,
            class: 'port',
            'data-port': name,
            'data-element-id': el.id
        });
        group.appendChild(circle);
    }
}

// Re-render all elements
export function renderAllElements() {
    const layer = document.getElementById('layer-elements');
    layer.innerHTML = '';
    for (const id of AppState.elements.keys()) {
        renderElement(id);
    }
}

// Update element position (for drag)
export function updateElementPosition(id, x, y) {
    const el = AppState.elements.get(id);
    if (!el) return;
    el.x = AppState.snapToGrid ? snap(x) : x;
    el.y = AppState.snapToGrid ? snap(y) : y;
    renderElement(id);
    emitStateChange('element:moved', { id, x: el.x, y: el.y });
}

// Update element text
export function updateElementText(id, text) {
    const el = AppState.elements.get(id);
    if (!el) return;
    el.text = text;
    renderElement(id);
    emitStateChange('element:textChanged', { id, text });
}

// Update element style property
export function updateElementStyle(id, prop, value) {
    const el = AppState.elements.get(id);
    if (!el) return;
    el.style[prop] = value;
    renderElement(id);
    emitStateChange('element:styleChanged', { id, prop, value });
}

// Resize element
export function resizeElement(id, width, height) {
    const el = AppState.elements.get(id);
    if (!el) return;
    el.width = Math.max(60, width);
    el.height = Math.max(40, height);
    renderElement(id);
    emitStateChange('element:resized', { id, width: el.width, height: el.height });
}

// Get element at canvas position
export function getElementAtPosition(canvasX, canvasY) {
    // Check elements in reverse z-order (topmost first)
    const sorted = [...AppState.elements.values()].sort((a, b) => b.zIndex - a.zIndex);

    for (const el of sorted) {
        if (el.type === 'decision') {
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            const dx = Math.abs(canvasX - cx) / (el.width / 2);
            const dy = Math.abs(canvasY - cy) / (el.height / 2);
            if (dx + dy <= 1) return el;
        } else {
            if (canvasX >= el.x && canvasX <= el.x + el.width &&
                canvasY >= el.y && canvasY <= el.y + el.height) {
                return el;
            }
        }
    }
    return null;
}

// Get port at canvas position
export function getPortAtPosition(canvasX, canvasY, excludeElementId = null) {
    const hitRadius = 12;
    for (const el of AppState.elements.values()) {
        if (el.id === excludeElementId) continue;
        const ports = getPortPositions(el);
        for (const [name, pos] of Object.entries(ports)) {
            const dx = canvasX - pos.x;
            const dy = canvasY - pos.y;
            if (dx * dx + dy * dy <= hitRadius * hitRadius) {
                return { elementId: el.id, port: name, x: pos.x, y: pos.y };
            }
        }
    }
    return null;
}

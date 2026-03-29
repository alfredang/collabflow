// CollabFlow - Minimap

import AppState from './state.js';
import { createSvgElement } from './utils.js';

let minimapSvg, minimapViewport;
const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 120;

export function initMinimap() {
    const container = document.getElementById('minimap');
    if (!container) return;

    minimapSvg = createSvgElement('svg', {
        width: MINIMAP_WIDTH,
        height: MINIMAP_HEIGHT,
        viewBox: '0 0 1000 700'
    });

    // Background
    const bg = createSvgElement('rect', {
        width: '100%',
        height: '100%',
        fill: 'var(--bg-secondary)'
    });
    minimapSvg.appendChild(bg);

    // Content group
    const contentGroup = createSvgElement('g', { id: 'minimap-content' });
    minimapSvg.appendChild(contentGroup);

    // Viewport indicator
    minimapViewport = createSvgElement('rect', {
        class: 'minimap-viewport',
        x: 0, y: 0,
        width: 200, height: 140
    });
    minimapSvg.appendChild(minimapViewport);

    container.appendChild(minimapSvg);

    // Click on minimap to navigate
    minimapSvg.addEventListener('click', (e) => {
        const rect = minimapSvg.getBoundingClientRect();
        const ratioX = (e.clientX - rect.left) / rect.width;
        const ratioY = (e.clientY - rect.top) / rect.height;

        const bounds = getContentBounds();
        if (!bounds) return;

        const canvasEl = document.getElementById('canvas');
        const canvasRect = canvasEl.getBoundingClientRect();

        const targetX = bounds.x + ratioX * bounds.totalWidth;
        const targetY = bounds.y + ratioY * bounds.totalHeight;

        AppState.viewport.panX = -(targetX * AppState.viewport.zoom) + canvasRect.width / 2;
        AppState.viewport.panY = -(targetY * AppState.viewport.zoom) + canvasRect.height / 2;

        const { applyTransform } = require_canvas();
        applyTransform();
    });

    // Update periodically
    setInterval(updateMinimap, 500);
}

export function updateMinimap() {
    if (!minimapSvg) return;

    const contentGroup = minimapSvg.querySelector('#minimap-content');
    if (!contentGroup) return;
    contentGroup.innerHTML = '';

    const bounds = getContentBounds();
    if (!bounds) return;

    // Set viewBox to content area
    const padding = 50;
    minimapSvg.setAttribute('viewBox',
        `${bounds.x - padding} ${bounds.y - padding} ${bounds.totalWidth + padding * 2} ${bounds.totalHeight + padding * 2}`
    );

    // Draw elements as small rectangles
    for (const el of AppState.elements.values()) {
        let shape;
        if (el.type === 'decision') {
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            shape = createSvgElement('polygon', {
                points: `${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`,
                fill: 'var(--accent-soft)',
                stroke: 'var(--accent)',
                'stroke-width': 2
            });
        } else {
            shape = createSvgElement('rect', {
                x: el.x, y: el.y,
                width: el.width, height: el.height,
                rx: el.type === 'start_end' ? el.height / 2 : 4,
                fill: 'var(--accent-soft)',
                stroke: 'var(--accent)',
                'stroke-width': 2
            });
        }
        contentGroup.appendChild(shape);
    }

    // Draw connections as lines
    for (const conn of AppState.connections.values()) {
        const fromEl = AppState.elements.get(conn.fromElementId);
        const toEl = AppState.elements.get(conn.toElementId);
        if (!fromEl || !toEl) continue;

        const line = createSvgElement('line', {
            x1: fromEl.x + fromEl.width / 2,
            y1: fromEl.y + fromEl.height / 2,
            x2: toEl.x + toEl.width / 2,
            y2: toEl.y + toEl.height / 2,
            stroke: 'var(--text-tertiary)',
            'stroke-width': 1
        });
        contentGroup.appendChild(line);
    }

    // Update viewport indicator
    if (minimapViewport) {
        const canvasEl = document.getElementById('canvas');
        const canvasRect = canvasEl.getBoundingClientRect();

        const vpX = (-AppState.viewport.panX) / AppState.viewport.zoom;
        const vpY = (-AppState.viewport.panY) / AppState.viewport.zoom;
        const vpW = canvasRect.width / AppState.viewport.zoom;
        const vpH = canvasRect.height / AppState.viewport.zoom;

        minimapViewport.setAttribute('x', vpX);
        minimapViewport.setAttribute('y', vpY);
        minimapViewport.setAttribute('width', vpW);
        minimapViewport.setAttribute('height', vpH);
    }
}

function getContentBounds() {
    if (AppState.elements.size === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const el of AppState.elements.values()) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
    }

    return {
        x: minX,
        y: minY,
        totalWidth: maxX - minX || 500,
        totalHeight: maxY - minY || 350
    };
}

function require_canvas() {
    return { applyTransform: window.__collabflow_applyTransform || (() => {}) };
}

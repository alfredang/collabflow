// CollabFlow - SVG Canvas management (zoom, pan, grid)

import AppState from './state.js';
import { clamp, createSvgElement } from './utils.js';

let svgCanvas, viewportGroup, gridPattern, gridBg;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.05;

export function initCanvas() {
    svgCanvas = document.getElementById('canvas');
    viewportGroup = document.getElementById('viewport-transform');

    setupGrid();
    setupZoom();
    setupPan();
    applyTransform();
}

function setupGrid() {
    const defs = svgCanvas.querySelector('defs');

    // Small grid pattern
    gridPattern = createSvgElement('pattern', {
        id: 'grid-small',
        width: AppState.gridSize,
        height: AppState.gridSize,
        patternUnits: 'userSpaceOnUse'
    });
    const gridPath = createSvgElement('path', {
        d: `M ${AppState.gridSize} 0 L 0 0 0 ${AppState.gridSize}`,
        fill: 'none',
        stroke: 'var(--grid-line)',
        'stroke-width': '0.5'
    });
    gridPattern.appendChild(gridPath);
    defs.appendChild(gridPattern);

    // Large grid pattern (5x)
    const largeSize = AppState.gridSize * 5;
    const gridPatternLarge = createSvgElement('pattern', {
        id: 'grid-large',
        width: largeSize,
        height: largeSize,
        patternUnits: 'userSpaceOnUse'
    });
    const gridRect = createSvgElement('rect', {
        width: largeSize,
        height: largeSize,
        fill: 'url(#grid-small)'
    });
    const gridPathLarge = createSvgElement('path', {
        d: `M ${largeSize} 0 L 0 0 0 ${largeSize}`,
        fill: 'none',
        stroke: 'var(--grid-line-bold)',
        'stroke-width': '1'
    });
    gridPatternLarge.appendChild(gridRect);
    gridPatternLarge.appendChild(gridPathLarge);
    defs.appendChild(gridPatternLarge);

    // Grid background rect
    gridBg = document.getElementById('grid-bg');
    gridBg.setAttribute('fill', 'url(#grid-large)');
}

function setupZoom() {
    svgCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();

        const rect = svgCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Point in canvas space before zoom
        const beforeX = (mouseX - AppState.viewport.panX) / AppState.viewport.zoom;
        const beforeY = (mouseY - AppState.viewport.panY) / AppState.viewport.zoom;

        // Apply zoom
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const newZoom = clamp(AppState.viewport.zoom * (1 + delta * 3), MIN_ZOOM, MAX_ZOOM);
        AppState.viewport.zoom = newZoom;

        // Adjust pan so the point under cursor stays fixed
        AppState.viewport.panX = mouseX - beforeX * newZoom;
        AppState.viewport.panY = mouseY - beforeY * newZoom;

        applyTransform();
        updateZoomDisplay();
    }, { passive: false });
}

function setupPan() {
    let isPanning = false;
    let panStartX, panStartY, panOriginX, panOriginY;

    svgCanvas.addEventListener('pointerdown', (e) => {
        // Middle mouse button or space+left click
        if (e.button === 1 || (e.button === 0 && AppState.mode === 'panning')) {
            isPanning = true;
            panStartX = e.clientX;
            panStartY = e.clientY;
            panOriginX = AppState.viewport.panX;
            panOriginY = AppState.viewport.panY;
            svgCanvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (isPanning) {
            AppState.viewport.panX = panOriginX + (e.clientX - panStartX);
            AppState.viewport.panY = panOriginY + (e.clientY - panStartY);
            applyTransform();
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (isPanning) {
            isPanning = false;
            svgCanvas.style.cursor = '';
            if (AppState.mode === 'panning') {
                AppState.mode = 'idle';
            }
        }
    });

    // Space key for pan mode
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat && AppState.mode === 'idle' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            AppState.mode = 'panning';
            svgCanvas.style.cursor = 'grab';
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && AppState.mode === 'panning') {
            AppState.mode = 'idle';
            svgCanvas.style.cursor = '';
        }
    });
}

export function applyTransform() {
    const { panX, panY, zoom } = AppState.viewport;
    viewportGroup.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoom})`);

    // Update grid pattern to compensate for zoom
    if (gridPattern) {
        const size = AppState.gridSize;
        gridPattern.setAttribute('width', size);
        gridPattern.setAttribute('height', size);
        gridPattern.setAttribute('patternTransform', `translate(${panX}, ${panY}) scale(${zoom})`);

        const largePattern = document.getElementById('grid-large');
        if (largePattern) {
            largePattern.setAttribute('patternTransform', `translate(${panX}, ${panY}) scale(${zoom})`);
        }
    }
}

function updateZoomDisplay() {
    const display = document.getElementById('zoom-level');
    if (display) {
        display.textContent = `${Math.round(AppState.viewport.zoom * 100)}%`;
    }
}

// Convert screen coordinates to canvas (SVG) coordinates
export function screenToCanvas(screenX, screenY) {
    const rect = svgCanvas.getBoundingClientRect();
    return {
        x: (screenX - rect.left - AppState.viewport.panX) / AppState.viewport.zoom,
        y: (screenY - rect.top - AppState.viewport.panY) / AppState.viewport.zoom
    };
}

// Convert canvas coordinates to screen coordinates
export function canvasToScreen(canvasX, canvasY) {
    const rect = svgCanvas.getBoundingClientRect();
    return {
        x: canvasX * AppState.viewport.zoom + AppState.viewport.panX + rect.left,
        y: canvasY * AppState.viewport.zoom + AppState.viewport.panY + rect.top
    };
}

// Zoom to fit all elements in view
export function zoomToFit() {
    if (AppState.elements.size === 0) return;

    const padding = 80;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const el of AppState.elements.values()) {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
    }

    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;
    const rect = svgCanvas.getBoundingClientRect();

    const zoom = Math.min(
        rect.width / contentWidth,
        rect.height / contentHeight,
        2
    );

    AppState.viewport.zoom = zoom;
    AppState.viewport.panX = (rect.width - contentWidth * zoom) / 2 - minX * zoom + padding * zoom;
    AppState.viewport.panY = (rect.height - contentHeight * zoom) / 2 - minY * zoom + padding * zoom;

    applyTransform();
    updateZoomDisplay();
}

export function zoomIn() {
    const rect = svgCanvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const beforeX = (cx - AppState.viewport.panX) / AppState.viewport.zoom;
    const beforeY = (cy - AppState.viewport.panY) / AppState.viewport.zoom;

    AppState.viewport.zoom = clamp(AppState.viewport.zoom * 1.2, MIN_ZOOM, MAX_ZOOM);

    AppState.viewport.panX = cx - beforeX * AppState.viewport.zoom;
    AppState.viewport.panY = cy - beforeY * AppState.viewport.zoom;

    applyTransform();
    updateZoomDisplay();
}

export function zoomOut() {
    const rect = svgCanvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const beforeX = (cx - AppState.viewport.panX) / AppState.viewport.zoom;
    const beforeY = (cy - AppState.viewport.panY) / AppState.viewport.zoom;

    AppState.viewport.zoom = clamp(AppState.viewport.zoom / 1.2, MIN_ZOOM, MAX_ZOOM);

    AppState.viewport.panX = cx - beforeX * AppState.viewport.zoom;
    AppState.viewport.panY = cy - beforeY * AppState.viewport.zoom;

    applyTransform();
    updateZoomDisplay();
}

export function resetZoom() {
    AppState.viewport = { panX: 0, panY: 0, zoom: 1.0 };
    applyTransform();
    updateZoomDisplay();
}

export function getSvgCanvas() {
    return svgCanvas;
}

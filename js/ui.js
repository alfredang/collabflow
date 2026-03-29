// CollabFlow - UI management (toolbar, modals, sidebar)

import AppState from './state.js';
import { setActiveTool } from './drag.js';
import { createRoom, joinRoom, leaveRoom, getRoomShareUrl, showToast } from './collaboration.js';
import { exportPNG, exportPDF, exportJSON, importJSON } from './export.js';
import { toggleTheme } from './theme.js';
import { zoomIn, zoomOut, resetZoom, zoomToFit } from './canvas.js';
import { undo, redo } from './history.js';
import { updatePropertiesPanel } from './editor.js';
import { onStateChange } from './state.js';

export function initUI() {
    bindToolbarButtons();
    bindSidebarTools();
    bindExportButtons();
    bindRoomButtons();
    bindModalControls();
    bindFileInput();

    // Update properties panel when selection changes
    onStateChange('selection:changed', updatePropertiesPanel);
}

function bindToolbarButtons() {
    // Undo/Redo
    document.getElementById('btn-undo')?.addEventListener('click', undo);
    document.getElementById('btn-redo')?.addEventListener('click', redo);

    // Zoom
    document.getElementById('btn-zoom-in')?.addEventListener('click', zoomIn);
    document.getElementById('btn-zoom-out')?.addEventListener('click', zoomOut);
    document.getElementById('btn-zoom-reset')?.addEventListener('click', resetZoom);
    document.getElementById('btn-zoom-fit')?.addEventListener('click', zoomToFit);

    // Theme
    document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);

    // Grid toggle
    document.getElementById('btn-grid')?.addEventListener('click', () => {
        AppState.showGrid = !AppState.showGrid;
        const gridBg = document.getElementById('grid-bg');
        if (gridBg) {
            gridBg.style.display = AppState.showGrid ? '' : 'none';
        }
        document.getElementById('btn-grid')?.classList.toggle('active', AppState.showGrid);
    });

    // Snap toggle
    document.getElementById('btn-snap')?.addEventListener('click', () => {
        AppState.snapToGrid = !AppState.snapToGrid;
        document.getElementById('btn-snap')?.classList.toggle('active', AppState.snapToGrid);
        showToast(AppState.snapToGrid ? 'Snap to grid enabled' : 'Snap to grid disabled');
    });
}

function bindSidebarTools() {
    document.querySelectorAll('.shape-item[data-tool]').forEach(item => {
        item.addEventListener('click', () => {
            setActiveTool(item.dataset.tool);
        });
    });

    // Also set select tool as active initially
    const selectTool = document.querySelector('[data-tool="select"]');
    if (selectTool) selectTool.classList.add('active');
}

function bindExportButtons() {
    const dropdown = document.getElementById('export-dropdown');

    // Toggle dropdown
    document.getElementById('btn-export')?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown?.classList.toggle('visible');
    });

    // Close dropdown on outside click or Escape
    document.addEventListener('click', () => dropdown?.classList.remove('visible'));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dropdown?.classList.remove('visible');
    });

    // Close dropdown after selecting an action
    const closeAndRun = (fn) => () => { dropdown?.classList.remove('visible'); fn(); };

    document.getElementById('btn-export-png')?.addEventListener('click', closeAndRun(exportPNG));
    document.getElementById('btn-export-pdf')?.addEventListener('click', closeAndRun(exportPDF));
    document.getElementById('btn-export-json')?.addEventListener('click', closeAndRun(exportJSON));
    document.getElementById('btn-import-json')?.addEventListener('click', closeAndRun(() => {
        document.getElementById('file-input')?.click();
    }));
}

function bindFileInput() {
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                importJSON(file);
                fileInput.value = ''; // Reset
            }
        });
    }
}

function bindRoomButtons() {
    // Create room
    document.getElementById('btn-create-room')?.addEventListener('click', async () => {
        const code = await createRoom();
        if (code) {
            showShareModal(code);
        }
    });

    // Join room
    document.getElementById('btn-join-room')?.addEventListener('click', () => {
        showJoinModal();
    });

    // Share room
    document.getElementById('btn-share')?.addEventListener('click', () => {
        if (AppState.roomCode) {
            showShareModal(AppState.roomCode);
        } else {
            showToast('Create or join a room first');
        }
    });

    // Leave room
    document.getElementById('btn-leave-room')?.addEventListener('click', () => {
        leaveRoom();
        hideAllModals();
    });
}

function bindModalControls() {
    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('visible');
            }
        });
    });

    // Close modal buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            hideAllModals();
        });
    });

    // Join room submit
    document.getElementById('btn-join-submit')?.addEventListener('click', async () => {
        const input = document.getElementById('join-room-input');
        const code = input?.value.trim().toUpperCase();
        if (code && code.length >= 4) {
            await joinRoom(code);
            hideAllModals();
        } else {
            showToast('Enter a valid room code');
        }
    });

    // Copy link button
    document.getElementById('btn-copy-link')?.addEventListener('click', () => {
        const url = getRoomShareUrl();
        if (url) {
            navigator.clipboard.writeText(url).then(() => {
                showToast('Link copied!');
            });
        }
    });
}

// Show the share/QR modal
async function showShareModal(roomCode) {
    const modal = document.getElementById('modal-share');
    if (!modal) return;

    // Update room code display
    const codeEl = modal.querySelector('.room-code');
    if (codeEl) codeEl.textContent = roomCode;

    // Update link
    const linkEl = modal.querySelector('.room-link');
    const url = getRoomShareUrl();
    if (linkEl && url) linkEl.textContent = url;

    // Generate QR code
    const qrContainer = document.getElementById('qr-container');
    if (qrContainer && url) {
        qrContainer.innerHTML = '';
        // Load QR code library if needed
        if (!window.QRCode) {
            try {
                await loadScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js');
            } catch (e) {
                qrContainer.innerHTML = '<p style="color: #666; font-size: 12px;">QR code library failed to load</p>';
            }
        }
        if (window.QRCode) {
            new QRCode(qrContainer, {
                text: url,
                width: 160,
                height: 160,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    }

    modal.classList.add('visible');
}

// Show join room modal
function showJoinModal() {
    const modal = document.getElementById('modal-join');
    if (!modal) return;

    const input = document.getElementById('join-room-input');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
    }

    modal.classList.add('visible');
}

function hideAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('visible'));
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

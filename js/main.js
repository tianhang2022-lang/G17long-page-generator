// ===== MAIN ENTRY POINT =====

// Canvas element references (assigned in init)
// These are declared in state.js as: let mainCanvas, ctx, overlayCanvas, octx;

async function init() {
  // 1. Assign canvas globals
  mainCanvas = document.getElementById('main-canvas');
  ctx = mainCanvas.getContext('2d');
  overlayCanvas = document.getElementById('overlay-canvas');
  octx = overlayCanvas.getContext('2d');

  // 2. Init IndexedDB
  await initDB();

  // 3. Load project from URL param or last project
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('project');
  if (projectId) {
    await loadProjectById(projectId);
  } else {
    // Try to load last project from IndexedDB
    try {
      const projects = await listProjects();
      if (projects && projects.length > 0) {
        projects.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        await loadProjectById(projects[0].id);
      } else {
        await loadAllFromStorage(); // fallback to localStorage
      }
    } catch(e) {
      await loadAllFromStorage();
    }
  }

  // 4. Load history
  loadHistoryFromStorage();
  if (history.stack.length === 0) historyPush();
  updateHistoryUI();

  // 5. Build module Y map
  moduleYMap = buildModuleYMap();

  // 6. Update toolbar state
  document.getElementById('btn-guides').classList.toggle('active', appState.showGuides);

  // 7. Render module list and canvas
  renderModuleList();
  await renderAll();

  // 8. Init canvas interaction
  initCanvasInteraction();

  // 9. Render slice overlay
  renderSliceOverlay();

  // 10. Set initial view
  setView('page');

  // 11. Apply canvas scale
  applyCanvasScale();

  // 12. Canvas scale on window resize
  window.addEventListener('resize', () => { applyCanvasScale(); });

  // 13. Ctrl+wheel zoom on canvas area
  document.getElementById('canvas-area').addEventListener('wheel', function(e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setEditorZoom(appState.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
  }, { passive: false });
  setEditorZoom(1);

  // 14. Register overlay mousemove cursor handler
  overlayCanvas.addEventListener('mousemove', e => {
    const rect = overlayCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (overlayCanvas.width / rect.width);
    const my = (e.clientY - rect.top) * (overlayCanvas.height / rect.height);
    const hit = hitTest(mx, my);
    if (appState.dragging || appState.resizing) return;
    if (hit && hit.type === 'handle') {
      const cursors = ['nw-resize','n-resize','ne-resize','w-resize','e-resize','sw-resize','s-resize','se-resize'];
      overlayCanvas.style.cursor = cursors[hit.index] || 'pointer';
    } else if (hit && hit.element) {
      overlayCanvas.style.cursor = 'move';
    } else {
      overlayCanvas.style.cursor = 'default';
    }
  });

  // 15. Preview mode keyboard shortcut and wheel zoom
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('preview-overlay');
      if (overlay && !overlay.classList.contains('hidden')) togglePreview();
    }
    if (e.key === 'p' && !e.ctrlKey && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
      togglePreview();
    }
  });
  const _pvBody = document.getElementById('preview-body');
  if (_pvBody) _pvBody.addEventListener('wheel', function(e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    previewZoom(e.deltaY < 0 ? 0.1 : -0.1);
  }, { passive: false });

  // 16. Modal backdrop click to close
  document.querySelectorAll('.modal-backdrop').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target === el) hideModal(el.closest('.modal')?.id);
    });
  });

  // 17. Update project name display
  const nameEl = document.getElementById('project-name-display');
  if (nameEl) nameEl.textContent = appState.projectName || '未命名项目';
}

init();

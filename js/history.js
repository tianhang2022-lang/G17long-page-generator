// ===== HISTORY (UNDO/REDO) =====

function historyPush() {
  if (history.isPaused) return;
  history.stack = history.stack.slice(0, history.cursor + 1);
  const snapshot = JSON.stringify(appState.modules);
  history.stack.push(snapshot);
  if (history.stack.length > history.maxSize) {
    history.stack.shift();
  }
  history.cursor = history.stack.length - 1;
  saveHistoryToStorage();
  updateHistoryUI();
}

function saveHistoryToStorage() {
  try {
    const limited = history.stack.slice(-20);
    localStorage.setItem('lpg4-history', JSON.stringify({
      stack: limited,
      cursor: Math.min(history.cursor, limited.length - 1)
    }));
  } catch(e) {}
}

function loadHistoryFromStorage() {
  try {
    const raw = localStorage.getItem('lpg4-history');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.stack)) {
      history.stack = data.stack;
      history.cursor = data.cursor ?? data.stack.length - 1;
    }
  } catch(e) {}
}

function historyUndo() {
  if (history.cursor <= 0) return;
  history.cursor--;
  history.isPaused = true;
  appState.modules = JSON.parse(history.stack[history.cursor]);
  appState.selectedElementId = null;
  renderAll();
  renderModuleList();
  renderPropsPanel();
  renderOverlay();
  saveConfig();
  history.isPaused = false;
  saveHistoryToStorage();
  updateHistoryUI();
}

function historyRedo() {
  if (history.cursor >= history.stack.length - 1) return;
  history.cursor++;
  history.isPaused = true;
  appState.modules = JSON.parse(history.stack[history.cursor]);
  appState.selectedElementId = null;
  renderAll();
  renderModuleList();
  renderPropsPanel();
  renderOverlay();
  saveConfig();
  history.isPaused = false;
  saveHistoryToStorage();
  updateHistoryUI();
}

function updateHistoryUI() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  const historyInfo = document.getElementById('history-info');
  if (undoBtn) undoBtn.disabled = history.cursor <= 0;
  if (redoBtn) redoBtn.disabled = history.cursor >= history.stack.length - 1;
  if (historyInfo) historyInfo.textContent = `${history.cursor + 1}/${history.stack.length}`;
}

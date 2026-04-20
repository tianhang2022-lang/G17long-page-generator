// ===== 4. PERSISTENCE =====
const LS_CONFIG_KEY = 'lpg4-config';
const LS_ASSET_IDX = 'lpg4-asset-index';
const IDB_PREFIX = 'lpg4-asset-';

// idb-keyval wrappers
function idbSet(key, val) {
  try { return idbKeyval.set(key, val); } catch(e) { return Promise.resolve(); }
}
function idbGet(key) {
  try { return idbKeyval.get(key); } catch(e) { return Promise.resolve(null); }
}
function idbDel(key) {
  try { return idbKeyval.del(key); } catch(e) { return Promise.resolve(); }
}

function saveConfig() {
  historyPush(); // record state before saving
  const data = {
    version: appState.version,
    canvas: appState.canvas,
    modules: appState.modules,
    sliceLines: appState.sliceLines,
    showGuides: appState.showGuides,
    pageBg: appState.pageBg,
    pageMargin: appState.pageMargin,
    bgColor: appState.bgColor,
  };
  try { localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(data)); } catch(e) {}
  // Save asset index (no dataUrl)
  const idx = {};
  for (const cat of ASSET_CATS) {
    idx[cat.key] = appState.assets[cat.key].map(a => ({id:a.id, name:a.name}));
  }
  try { localStorage.setItem(LS_ASSET_IDX, JSON.stringify(idx)); } catch(e) {}
}

async function saveAssetData(assetId, dataUrl) {
  await idbSet(IDB_PREFIX + assetId, dataUrl);
}

async function loadAssetData(assetId) {
  return await idbGet(IDB_PREFIX + assetId);
}

async function deleteAssetData(assetId) {
  await idbDel(IDB_PREFIX + assetId);
}

async function loadAllFromStorage() {
  const raw = localStorage.getItem(LS_CONFIG_KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (data.canvas) appState.canvas = data.canvas;
      if (data.modules) appState.modules = data.modules;
      if (data.sliceLines) appState.sliceLines = data.sliceLines;
      if (typeof data.showGuides === 'boolean') appState.showGuides = data.showGuides;
      if (data.pageBg) appState.pageBg = data.pageBg;
      if (data.pageMargin) appState.pageMargin = data.pageMargin;
      if (data.bgColor) appState.bgColor = data.bgColor;
    } catch(e) {}
  }
  // Load asset index + dataUrls from IDB
  const idxRaw = localStorage.getItem(LS_ASSET_IDX);
  if (idxRaw) {
    try {
      const idx = JSON.parse(idxRaw);
      for (const cat of ASSET_CATS) {
        const entries = idx[cat.key] || [];
        if (cat.three) {
          for (const entry of entries) {
            const headUrl = await loadAssetData(entry.id + '_head');
            const midUrl  = await loadAssetData(entry.id + '_mid');
            const tailUrl = await loadAssetData(entry.id + '_tail');
            appState.assets[cat.key].push({
              id: entry.id, name: entry.name,
              head: headUrl ? {dataUrl: headUrl} : null,
              mid:  midUrl  ? {dataUrl: midUrl}  : null,
              tail: tailUrl ? {dataUrl: tailUrl} : null,
            });
          }
        } else {
          for (const entry of entries) {
            const dataUrl = await loadAssetData(entry.id);
            if (dataUrl) appState.assets[cat.key].push({id:entry.id, name:entry.name, dataUrl});
          }
        }
      }
    } catch(e) {}
  }
}

// ===== PROJECT DB (IndexedDB) =====
const DB_NAME = 'LongPageDB';
const DB_VERSION = 2;
let db = null;

async function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('projects')) {
        d.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('assets')) {
        d.createObjectStore('assets', { keyPath: 'id' });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = e => reject(e);
  });
}

async function saveProject(projectData) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put(projectData);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

async function loadProject(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readonly');
    const req = tx.objectStore('projects').get(id);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = reject;
  });
}

async function listProjects() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readonly');
    const req = tx.objectStore('projects').getAll();
    req.onsuccess = e => resolve(e.target.result || []);
    req.onerror = reject;
  });
}

async function deleteProjectFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').delete(id);
    tx.oncomplete = resolve;
    tx.onerror = reject;
  });
}

// Load asset data for all modules (after loading a project)
async function loadAssetDataForModules() {
  // Reload assets from idb-keyval for the current state
  appState.assets = {backgrounds:[], titleBars:[], textBoxes:[], images:[], others:[]};
  await loadAllFromStorage();
}

// Save current project to DB
async function saveCurrentProject() {
  if (!db) await initDB();
  if (!appState.projectId) appState.projectId = uid();
  const project = {
    id: appState.projectId,
    name: appState.projectName || '未命名项目',
    updatedAt: Date.now(),
    modules: appState.modules,
    canvas: appState.canvas,
    pageBg: appState.pageBg,
    pageMargin: appState.pageMargin,
    bgColor: appState.bgColor,
    thumbnail: null,
  };
  // Generate thumbnail
  try {
    await renderAll();
    project.thumbnail = mainCanvas.toDataURL('image/jpeg', 0.3);
  } catch(e) {}
  await saveProject(project);
  // Update project name display
  const nameEl = document.getElementById('project-name-display');
  if (nameEl) nameEl.textContent = project.name;
  showSaveToast('✅ 项目已保存');
  // Also save to localStorage as fallback
  saveConfig();
}

function showSaveToast(msg) {
  let toast = document.getElementById('save-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'save-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f3060;color:#4a8af0;padding:8px 20px;border-radius:6px;font-size:13px;z-index:9999;border:1px solid #4a8af0;transition:opacity .3s';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.style.opacity = '0', 2000);
}

// Load project into editor
async function loadProjectById(id) {
  if (!db) await initDB();
  const project = await loadProject(id);
  if (!project) return;
  appState.projectId = project.id;
  appState.projectName = project.name || '未命名项目';
  appState.modules = project.modules || [];
  if (project.canvas) appState.canvas = project.canvas;
  appState.pageBg = project.pageBg || { type: 'color', color: '#0a0a18' };
  appState.pageMargin = project.pageMargin || {};
  appState.bgColor = project.bgColor || '#0a0a18';
  appState.selectedModuleId = null;
  appState.selectedElementId = null;
  // Update project name display
  const nameEl = document.getElementById('project-name-display');
  if (nameEl) nameEl.textContent = appState.projectName;
  renderAll(); renderPageView(); renderModuleList(); renderPropsPanel();
}

function renameCurrentProject() {
  const name = prompt('项目名称：', appState.projectName || '未命名项目');
  if (!name) return;
  appState.projectName = name;
  const el = document.getElementById('project-name-display');
  if (el) el.textContent = name;
  saveCurrentProject();
}

// Export project as .json file
function exportProjectFile() {
  const data = {
    version: '2.0',
    id: appState.projectId,
    name: appState.projectName || '未命名项目',
    exportedAt: new Date().toISOString(),
    modules: appState.modules,
    canvas: appState.canvas,
    pageBg: appState.pageBg,
    pageMargin: appState.pageMargin
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, (appState.projectName || 'project') + '.json');
}

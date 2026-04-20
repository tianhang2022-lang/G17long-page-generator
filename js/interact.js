// ===== 6. OVERLAY + INTERACTION =====
const HANDLE_SIZE = 8;
let activeGuideLines = [];

function renderOverlay() {
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (appState.showGuides) {
    moduleYMap = buildModuleYMap();
    octx.strokeStyle = 'rgba(100,160,255,0.15)';
    octx.lineWidth = 1;
    octx.setLineDash([4,4]);
    for (const mod of appState.modules) {
      const info = moduleYMap[mod.id];
      if (!info) continue;
      octx.strokeRect(0, info.y, appState.canvas.width, info.height);
      octx.fillStyle = 'rgba(100,160,255,0.4)';
      octx.font = '11px Arial';
      octx.textAlign = 'left';
      octx.textBaseline = 'top';
      octx.setLineDash([]);
      octx.fillText(mod.name, 4, info.y + 3);
      octx.setLineDash([4,4]);
    }
    octx.setLineDash([]);
  }
  for (const line of activeGuideLines) {
    octx.strokeStyle = '#ff3344';
    octx.lineWidth = 1;
    octx.setLineDash([]);
    octx.beginPath();
    if (line.axis === 'v') { octx.moveTo(line.pos, 0); octx.lineTo(line.pos, overlayCanvas.height); }
    else { octx.moveTo(0, line.pos); octx.lineTo(overlayCanvas.width, line.pos); }
    octx.stroke();
  }
  const el = getSelectedElement();
  if (!el) return;
  const mod = getSelectedModule();
  if (!mod) return;
  const mInfo = moduleYMap[mod.id];
  if (!mInfo) return;
  const ex = el.x, ey = mInfo.y + el.y, ew = el.width, eh = el.height;
  octx.strokeStyle = '#4a8af0';
  octx.lineWidth = 1.5;
  octx.setLineDash([4,3]);
  octx.strokeRect(ex-0.5, ey-0.5, ew+1, eh+1);
  octx.setLineDash([]);
  octx.fillStyle = '#4a8af0';
  octx.font = '10px Arial';
  octx.textAlign = 'right';
  octx.textBaseline = 'bottom';
  octx.fillText(Math.round(ew)+'x'+Math.round(eh), ex+ew, ey-2);
  const hps = getHandlePositions(ex, ey, ew, eh);
  for (const [, hx, hy] of hps) {
    octx.fillStyle = '#fff';
    octx.strokeStyle = '#4a8af0';
    octx.lineWidth = 1.5;
    octx.fillRect(hx-HANDLE_SIZE/2, hy-HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    octx.strokeRect(hx-HANDLE_SIZE/2, hy-HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
  }
}

function getHandlePositions(x, y, w, h) {
  return [
    ['tl',x,y],['tc',x+w/2,y],['tr',x+w,y],
    ['ml',x,y+h/2],['mr',x+w,y+h/2],
    ['bl',x,y+h],['bc',x+w/2,y+h],['br',x+w,y+h],
  ];
}

function screenToCanvas(screenX, screenY) {
  const rect = overlayCanvas.getBoundingClientRect();
  const scaleX = overlayCanvas.width / rect.width;
  const scaleY = overlayCanvas.height / rect.height;
  return { x: (screenX - rect.left)*scaleX, y: (screenY - rect.top)*scaleY };
}

function hitTest(cx, cy) {
  const el = getSelectedElement();
  if (el) {
    const mod = getSelectedModule();
    const mInfo = moduleYMap[mod.id];
    if (mInfo) {
      const ex=el.x, ey=mInfo.y+el.y, ew=el.width, eh=el.height;
      const hps = getHandlePositions(ex,ey,ew,eh);
      for (const [name,hx,hy] of hps) {
        if (Math.abs(cx-hx)<=HANDLE_SIZE && Math.abs(cy-hy)<=HANDLE_SIZE)
          return {type:'handle',handle:name,modId:mod.id,elId:el.id};
      }
      if (cx>=ex && cx<=ex+ew && cy>=ey && cy<=ey+eh)
        return {type:'move',modId:mod.id,elId:el.id};
    }
  }
  const mod = getSelectedModule();
  if (!mod) return null;
  const mInfo = moduleYMap[mod.id];
  if (!mInfo) return null;
  const sorted = [...mod.elements].sort((a,b)=>(b.zIndex||0)-(a.zIndex||0));
  for (const e of sorted) {
    if (!e.visible) continue;
    if (appState.view === 'page') continue;
    if (appState.view === 'assets') continue;
    if (appState.view === 'block' && !isDesignEl(e)) continue;
    if (appState.view === 'content' && isDesignEl(e)) continue;
    if (cx>=e.x && cx<=e.x+e.width && cy>=mInfo.y+e.y && cy<=mInfo.y+e.y+e.height)
      return {type:'element',modId:mod.id,elId:e.id};
  }
  return null;
}

let dragState = null;
const SNAP_DIST = 6;

// ===== CONTEXT MENU =====
let ctxMenu = null;
function showContextMenu(x, y, items) {
  removeContextMenu();
  ctxMenu = document.createElement('div');
  ctxMenu.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:#16213e;border:1px solid #0f3460;border-radius:6px;padding:4px 0;z-index:9000;min-width:140px;box-shadow:0 4px 16px rgba(0,0,0,.6)`;
  for (const item of items) {
    if (item === '-') {
      const sep = document.createElement('div');
      sep.style.cssText = 'height:1px;background:#0f3460;margin:3px 0';
      ctxMenu.appendChild(sep);
    } else {
      const btn = document.createElement('div');
      btn.textContent = item.label;
      btn.style.cssText = `padding:6px 14px;cursor:pointer;font-size:12px;color:${item.danger?'#ff6666':'#c0c8e0'};transition:background .1s`;
      btn.onmouseenter = () => btn.style.background = '#0f3460';
      btn.onmouseleave = () => btn.style.background = '';
      btn.onclick = () => { removeContextMenu(); item.action(); };
      ctxMenu.appendChild(btn);
    }
  }
  document.body.appendChild(ctxMenu);
  setTimeout(() => document.addEventListener('click', removeContextMenu, {once:true}), 10);
}
function removeContextMenu() {
  if (ctxMenu) { ctxMenu.remove(); ctxMenu = null; }
}

function initCanvasInteraction() {
  overlayCanvas.classList.add('interactive');
  overlayCanvas.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  overlayCanvas.addEventListener('contextmenu', onCanvasContextMenu);
  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    // Ctrl+S save
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveCurrentProject();
      return;
    }
    // Undo/Redo shortcuts
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      historyUndo();
      return;
    }
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
      e.preventDefault();
      historyRedo();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
      const el = getSelectedElement();
      if (el) { deleteElementById(el.id); }
    }
    // Ctrl+D duplicate
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      duplicateSelectedElement();
    }
    // Arrow keys nudge
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
      const el = getSelectedElement();
      if (!el || el.locked) return;
      const d = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') el.x -= d;
      if (e.key === 'ArrowRight') el.x += d;
      if (e.key === 'ArrowUp') el.y -= d;
      if (e.key === 'ArrowDown') el.y += d;
      renderAll(); updatePropsTransform(); renderOverlay(); saveConfig();
    }
  });
}

function onCanvasContextMenu(e) {
  e.preventDefault();
  const cp = screenToCanvas(e.clientX, e.clientY);
  const hit = hitTest(cp.x, cp.y);
  const mod = getSelectedModule();
  const items = [];
  if (hit && hit.type === 'element') {
    const el = getElement(hit.modId, hit.elId);
    items.push({label:`📌 ${el?.type||'元素'}`, action:()=>{}});
    items.push('-');
    items.push({label:'⧉ 复制元素', action: duplicateSelectedElement});
    items.push({label:'⬆ 上移层级', action:()=>layerOp('up')});
    items.push({label:'⬇ 下移层级', action:()=>layerOp('down')});
    items.push('-');
    items.push({label:'🗑 删除元素', danger:true, action:()=>deleteElementById(hit.elId)});
  } else if (mod) {
    items.push({label:`📦 ${mod.name}`, action:()=>{}});
    items.push('-');
    items.push({label:'＋ 添加标题栏', action:()=>addElementToModule('title-bar')});
    items.push({label:'＋ 添加文本框', action:()=>addElementToModule('text-box')});
    items.push({label:'＋ 添加文字', action:()=>addElementToModule('text')});
    items.push({label:'＋ 添加图片', action:()=>addElementToModule('image')});
    items.push('-');
    items.push({label:'⧉ 复制模块', action:()=>duplicateModule(mod.id)});
    items.push({label:'🗑 删除模块', danger:true, action:()=>deleteModule(mod.id)});
  } else {
    items.push({label:'＋ 添加新模块', action: showTemplateModal});
  }
  showContextMenu(e.clientX, e.clientY, items);
}

function duplicateSelectedElement() {
  const mod = getSelectedModule();
  if (!mod) return;
  const el = getSelectedElement();
  if (!el) return;
  const clone = deepClone(el);
  clone.id = uid();
  clone.x += 10; clone.y += 10;
  mod.elements.push(clone);
  appState.selectedElementId = clone.id;
  renderAll(); renderPropsPanel(); renderOverlay(); saveConfig();
}

function onMouseDown(e) {
  if (e.button !== 0) return;
  const cp = screenToCanvas(e.clientX, e.clientY);
  if (appState.sliceMode) {
    appState.sliceLines.push(Math.round(cp.y));
    appState.sliceLines.sort((a,b)=>a-b);
    renderSliceOverlay();
    saveConfig();
    return;
  }
  const hit = hitTest(cp.x, cp.y);
  if (!hit) {
    moduleYMap = buildModuleYMap();
    let clickedMod = null;
    for (const mod of appState.modules) {
      const info = moduleYMap[mod.id];
      if (cp.y >= info.y && cp.y < info.y + info.height) { clickedMod = mod; break; }
    }
    if (clickedMod && clickedMod.id !== appState.selectedModuleId) {
      appState.selectedModuleId = clickedMod.id;
      appState.selectedElementId = null;
      renderModuleList();
    } else {
      appState.selectedElementId = null;
    }
    renderOverlay();
    renderPropsPanel();
    return;
  }
  if (hit.type === 'element') {
    appState.selectedElementId = hit.elId;
    renderOverlay();
    renderPropsPanel();
  }
  const elId = hit.elId || (appState.selectedElementId);
  const el = getElement(hit.modId, elId);
  const mod = getModule(hit.modId);
  const mInfo = moduleYMap[mod.id];
  if (!el || !mInfo) return;
  if (hit.type === 'handle') {
    dragState = { mode:'resize', handle:hit.handle, modId:hit.modId, elId:elId,
      startCX:cp.x, startCY:cp.y, origX:el.x, origY:el.y, origW:el.width, origH:el.height, modY:mInfo.y };
  } else {
    dragState = { mode:'move', modId:hit.modId, elId:elId,
      startCX:cp.x, startCY:cp.y, origX:el.x, origY:el.y, origW:el.width, origH:el.height, modY:mInfo.y };
  }
  e.preventDefault();
}

function getSnapGuides(el, modId) {
  const cw = appState.canvas.width;
  const mod = getModule(modId);
  const mInfo = moduleYMap[modId];
  const guides = [{axis:'v',pos:0},{axis:'v',pos:cw/2},{axis:'v',pos:cw}];
  guides.push({axis:'h',pos:mInfo.y},{axis:'h',pos:mInfo.y+mInfo.height});
  for (const e of mod.elements) {
    if (e.id === el.id || !e.visible) continue;
    const ey = mInfo.y + e.y;
    guides.push({axis:'v',pos:e.x},{axis:'v',pos:e.x+e.width/2},{axis:'v',pos:e.x+e.width});
    guides.push({axis:'h',pos:ey},{axis:'h',pos:ey+e.height/2},{axis:'h',pos:ey+e.height});
  }
  return guides;
}

function trySnap(val, guides, axis, offsets) {
  const filtered = guides.filter(g=>g.axis===axis);
  let best = null, bestD = SNAP_DIST+1;
  for (const off of offsets) {
    for (const g of filtered) {
      const d = Math.abs((val+off) - g.pos);
      if (d < bestD) { bestD = d; best = {snapped: g.pos - off, guide: g.pos}; }
    }
  }
  return best;
}

function onMouseMove(e) {
  if (!dragState) return;
  const cp = screenToCanvas(e.clientX, e.clientY);
  const dx = cp.x - dragState.startCX;
  const dy = cp.y - dragState.startCY;
  const el = getElement(dragState.modId, dragState.elId);
  if (!el) { dragState=null; return; }
  activeGuideLines = [];

  if (dragState.mode === 'move') {
    let nx = dragState.origX + dx;
    let ny = dragState.origY + dy;
    if (appState.showGuides) {
      const guides = getSnapGuides(el, dragState.modId);
      const sx = trySnap(nx, guides, 'v', [0, el.width/2, el.width]);
      if (sx) { nx = sx.snapped; activeGuideLines.push({axis:'v',pos:sx.guide}); }
      const mY = dragState.modY;
      const sy = trySnap(mY+ny, guides, 'h', [0, el.height/2, el.height]);
      if (sy) { ny = sy.snapped - mY; activeGuideLines.push({axis:'h',pos:sy.guide}); }
    }
    el.x = Math.round(nx); el.y = Math.round(ny);
    overlayCanvas.style.cursor = 'move';
  } else {
    let x=dragState.origX, y=dragState.origY, w=dragState.origW, h=dragState.origH;
    const hn = dragState.handle;
    if (hn.includes('r')) { w = Math.max(20, dragState.origW+dx); }
    if (hn.includes('l')) { const nw=Math.max(20,dragState.origW-dx); x=dragState.origX+(dragState.origW-nw); w=nw; }
    if (hn.includes('b')) { h = Math.max(20, dragState.origH+dy); }
    if (hn.includes('t')) { const nh=Math.max(20,dragState.origH-dy); y=dragState.origY+(dragState.origH-nh); h=nh; }
    el.x=Math.round(x); el.y=Math.round(y); el.width=Math.round(w); el.height=Math.round(h);
    const cursors = {tl:'nwse-resize',tc:'ns-resize',tr:'nesw-resize',ml:'ew-resize',mr:'ew-resize',bl:'nesw-resize',bc:'ns-resize',br:'nwse-resize'};
    overlayCanvas.style.cursor = cursors[hn]||'default';
  }
  renderAll();
  updatePropsTransform();
}

function onMouseUp(e) {
  if (dragState) { activeGuideLines=[]; dragState=null; renderOverlay(); saveConfig(); }
}

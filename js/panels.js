// ===== PANELS: MODULE LIST & THREE-VIEW =====

let leftTab = 'modules';
function switchLeftTab(tab) {
  leftTab = tab;
  const tm = document.getElementById('tab-modules'); if (tm) tm.classList.toggle('active', tab==='modules');
  const ta = document.getElementById('tab-assets'); if (ta) ta.classList.toggle('active', tab==='assets');
  const pm = document.getElementById('panel-modules'); if (pm) pm.classList.toggle('hidden', tab!=='modules');
  const pa = document.getElementById('panel-assets'); if (pa) pa.classList.toggle('hidden', tab!=='assets');
  if (tab==='assets') renderAssetPanel();
}

function renderModuleList() {
  if (typeof renderPageView === 'function') renderPageView();
  const list = document.getElementById('module-list');
  if (!list) return;
  list.innerHTML = '';
  appState.modules.forEach((mod, idx) => {
    const card = document.createElement('div');
    card.className = 'module-card' + (mod.id===appState.selectedModuleId?' selected':'');
    card.draggable = true;
    card.dataset.id = mod.id;
    card.innerHTML = `
      <span class="mod-num">${idx+1}</span>
      <span class="mod-name" ondblclick="startRenameModule('${mod.id}',this);event.stopPropagation()">${escHtml(mod.name)}</span>
      <span class="mode-badge ${appState.mode === 'design' ? 'design' : 'content'}">${appState.mode === 'design' ? '🎨' : '📝'}</span>
      <div class="mod-actions">
        <button class="mod-btn" title="复制" onclick="duplicateModule('${mod.id}');event.stopPropagation()">⧉</button>
        <button class="mod-btn" title="删除" onclick="deleteModule('${mod.id}');event.stopPropagation()">✕</button>
      </div>`;
    card.addEventListener('click', () => selectModule(mod.id));
    card.addEventListener('dragstart', e => { e.dataTransfer.setData('modId', mod.id); });
    card.addEventListener('dragover', e => { e.preventDefault(); card.style.borderColor='#e94560'; });
    card.addEventListener('dragleave', () => { card.style.borderColor=''; });
    card.addEventListener('drop', e => {
      e.preventDefault(); card.style.borderColor='';
      const fromId = e.dataTransfer.getData('modId');
      reorderModule(fromId, mod.id);
    });
    list.appendChild(card);
  });
}

function selectModule(id) {
  appState.selectedModuleId = id;
  appState.selectedElementId = null;
  renderModuleList();
  renderOverlay();
  renderPropsPanel();
}

function deleteModule(id) {
  if (!confirm('删除该模块？')) return;
  const idx = appState.modules.findIndex(m=>m.id===id);
  if (idx >= 0) appState.modules.splice(idx, 1);
  if (appState.selectedModuleId===id) {
    appState.selectedModuleId = appState.modules[0]?.id||null;
    appState.selectedElementId = null;
  }
  renderModuleList(); renderAll(); renderPropsPanel(); saveConfig();
}

function duplicateModule(id) {
  const mod = getModule(id);
  if (!mod) return;
  const clone = deepClone(mod);
  clone.id = uid();
  clone.name = mod.name + ' (副本)';
  clone.elements.forEach(e=>e.id=uid());
  const idx = appState.modules.findIndex(m=>m.id===id);
  appState.modules.splice(idx+1, 0, clone);
  renderModuleList(); renderAll(); saveConfig();
}

function reorderModule(fromId, toId) {
  if (fromId===toId) return;
  const fi = appState.modules.findIndex(m=>m.id===fromId);
  const ti = appState.modules.findIndex(m=>m.id===toId);
  if (fi<0||ti<0) return;
  const [mod] = appState.modules.splice(fi, 1);
  appState.modules.splice(ti, 0, mod);
  renderModuleList(); renderAll(); saveConfig();
}

function renameSelectedModule(name) {
  const mod = getSelectedModule();
  if (!mod) return;
  mod.name = name;
  renderModuleList();
  saveConfig();
}

function startRenameModule(id, spanEl) {
  const inp = document.createElement('input');
  inp.className = 'mod-name-input';
  inp.value = getModule(id)?.name || '';
  inp.style.cssText = 'flex:1;background:#0a1830;color:#fff;border:1px solid #4a8af0;border-radius:2px;padding:1px 4px;font-size:12px;min-width:0';
  spanEl.replaceWith(inp);
  inp.focus(); inp.select();
  const save = () => { const m = getModule(id); if(m) m.name = inp.value||m.name; renderModuleList(); saveConfig(); };
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', e => { if(e.key==='Enter') inp.blur(); if(e.key==='Escape') renderModuleList(); });
}

function updateModProp(prop, val) {
  const mod = getSelectedModule();
  if (!mod) return;
  mod[prop] = val;
  renderAll();
  renderPropsPanel();
  saveConfig();
}

function addElementToModule(type) {
  const mod = getSelectedModule();
  if (!mod) return;
  const cw = appState.canvas.width;
  const modH = calcModuleHeight(mod);
  let el;
  if (type === 'title-bar') el = makeTitleBar(cw, 0, modH, 60);
  else if (type === 'text-box') el = makeTextBox(20, modH, cw - 40, 120);
  else if (type === 'text') el = makeText(20, modH, cw - 40, 40, '文字内容');
  else if (type === 'image') el = makeImg(20, modH, cw - 40, 200);
  if (!el) return;
  mod.elements.push(el);
  appState.selectedElementId = el.id;
  renderAll();
  renderPropsPanel();
  renderOverlay();
  saveConfig();
}

function renderModElementList(mod) {
  if (!mod || !mod.elements.length) return '<div style="color:#555;font-size:11px;padding:4px 0">无元素</div>';
  const typeLabels = {text:'文字',image:'图片',background:'背景','title-bar':'标题栏','text-box':'文本框'};
  const designTypes = new Set(['background', 'title-bar']);

  function isDesign(el) { return el._group === 'design' || (el._group !== 'content' && designTypes.has(el.type)); }

  function renderItem(el) {
    const active = el.id === appState.selectedElementId ? ' active' : '';
    return `<div class="mod-el-item${active}" onclick="selectElementById('${el.id}')">
      <span class="mod-el-type">${typeLabels[el.type]||el.type}</span>
      <span class="mod-el-name">${escHtml((el.text||el.type||'').substring(0,12))}</span>
      <button class="mod-el-mv" onclick="elMoveGroup('${el.id}','${isDesign(el)?'content':'design'}');event.stopPropagation()" title="移到另一组">⇄</button>
      <button class="mod-el-del" onclick="deleteElementById('${el.id}');event.stopPropagation()">✕</button>
    </div>`;
  }

  const designEls = mod.elements.filter(isDesign);
  const contentEls = mod.elements.filter(e => !isDesign(e));

  return `<div class="el-group">
    <div class="el-group-header">🎨 设计素材</div>
    ${designEls.map(renderItem).join('') || '<div class="el-group-empty">空</div>'}
    <button class="add-el-btn-sm" onclick="addElToGroup('design')">＋ 添加设计元素</button>
  </div>
  <div class="el-group">
    <div class="el-group-header">📝 内容素材</div>
    ${contentEls.map(renderItem).join('') || '<div class="el-group-empty">空</div>'}
    <button class="add-el-btn-sm" onclick="addElToGroup('content')">＋ 添加内容元素</button>
  </div>`;
}

function elMoveGroup(elId, toGroup) {
  const mod = getSelectedModule();
  if (!mod) return;
  const el = mod.elements.find(e => e.id === elId);
  if (el) { el._group = toGroup; renderPropsPanel(); saveConfig(); }
}

function addElToGroup(groupKey) {
  const mod = getSelectedModule();
  if (!mod) return;
  const type = groupKey === 'design' ? 'title-bar' : 'text-box';
  addElementToModule(type);
  const newEl = mod.elements[mod.elements.length - 1];
  if (newEl) newEl._group = groupKey;
  renderPropsPanel();
}

function selectElementById(elId) {
  const mod = getSelectedModule();
  if (!mod) return;
  const el = mod.elements.find(e => e.id === elId);
  if (!el) return;
  appState.selectedElementId = elId;
  renderPropsPanel();
  renderOverlay();
}

function deleteElementById(elId) {
  const mod = getSelectedModule();
  if (!mod) return;
  mod.elements = mod.elements.filter(e => e.id !== elId);
  if (appState.selectedElementId === elId) appState.selectedElementId = null;
  renderAll(); renderBlockView(); renderContentView();
  renderPropsPanel();
  renderOverlay();
  saveConfig();
}

// ===== ASSET MANAGEMENT =====
let assetCatActive = 'backgrounds';

function renderAssetPanel() {
  const panelInner = document.getElementById('asset-panel-inner');
  const tabHtml = ASSET_CATS.map(function(cat) {
    return '<button class="asset-cat-tab' + (cat.key===assetCatActive?' active':'') + '" onclick="assetCatActive=\'' + cat.key + '\';renderAssetPanel()">' + cat.label + '</button>';
  }).join('');

  let content;
  if (panelInner) {
    panelInner.innerHTML = '<div class="asset-cat-tabs" style="flex-wrap:wrap">' + tabHtml + '</div>';
    content = document.createElement('div');
    panelInner.appendChild(content);
  } else {
    const legacyTabs = document.getElementById('asset-cat-tabs');
    const legacyContent = document.getElementById('asset-cat-content');
    if (legacyTabs) legacyTabs.innerHTML = tabHtml;
    if (legacyContent) { legacyContent.innerHTML = ''; content = legacyContent; }
    else { content = document.createElement('div'); }
  }

  content.innerHTML = '';
  const cat = ASSET_CATS.find(c=>c.key===assetCatActive);
  if (!cat) return;

  if (cat.three) {
    const addBtn = document.createElement('button');
    addBtn.className = 'add-group-btn';
    addBtn.textContent = '+ 新建素材组';
    addBtn.onclick = () => addAssetGroup(cat.key);
    content.appendChild(addBtn);
    for (const grp of appState.assets[cat.key]) {
      content.appendChild(buildAssetGroupCard(cat.key, grp));
    }
  } else {
    const grid = document.createElement('div');
    grid.className = 'asset-single-grid';
    for (const item of appState.assets[cat.key]) {
      const div = document.createElement('div');
      div.className = 'asset-single-item';
      div.innerHTML = `
        <img src="${item.dataUrl||''}" alt="${escHtml(item.name)}">
        <div class="item-name">${escHtml(item.name)}</div>
        <button class="item-del" onclick="deleteSingleAsset('${cat.key}','${item.id}');event.stopPropagation()">✕</button>`;
      grid.appendChild(div);
    }
    content.appendChild(grid);
    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'upload-single-btn';
    uploadBtn.textContent = '+ 上传图片';
    uploadBtn.onclick = () => uploadSingleAsset(cat.key);
    content.appendChild(uploadBtn);
  }
}

function buildAssetGroupCard(catKey, grp) {
  const card = document.createElement('div');
  card.className = 'asset-group-card';
  card.dataset.id = grp.id;
  const slots = ['head','mid','tail'];
  const slotLabels = ['头段','中段','尾段'];
  let slotsHtml = '<div class="asset-three-slots">';
  slots.forEach((slot, i) => {
    const img = grp[slot] ? `<img src="${grp[slot].dataUrl}" alt="">` : `<span style="font-size:18px;color:#555">+</span>`;
    const del = grp[slot] ? `<span class="slot-del" onclick="clearAssetSlot('${catKey}','${grp.id}','${slot}');event.stopPropagation()">✕</span>` : '';
    slotsHtml += `<div class="asset-slot" onclick="uploadAssetSlot('${catKey}','${grp.id}','${slot}')">${img}${del}<span class="slot-label">${slotLabels[i]}</span></div>`;
  });
  slotsHtml += '</div>';
  card.innerHTML = `
    <div class="asset-group-header">
      <input class="asset-group-name" value="${escHtml(grp.name)}" oninput="renameAssetGroup('${catKey}','${grp.id}',this.value)">
      <button class="asset-group-del" onclick="deleteAssetGroup('${catKey}','${grp.id}')">✕</button>
    </div>
    ${slotsHtml}
    <button class="upload-single-btn" onclick="applyAssetGroupToSelected('${catKey}','${grp.id}')" style="width:100%;margin-top:4px">✓ 应用到选中元素</button>`;
  return card;
}

function addAssetGroup(catKey) {
  const grp = {id:uid(), name:'新素材组', head:null, mid:null, tail:null};
  appState.assets[catKey].push(grp);
  saveConfig();
  renderAssetPanel();
}

function renameAssetGroup(catKey, grpId, name) {
  const grp = appState.assets[catKey].find(g=>g.id===grpId);
  if (grp) { grp.name = name; saveConfig(); }
}

async function uploadAssetSlot(catKey, grpId, slot) {
  const file = await pickFile('image/*');
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  const grp = appState.assets[catKey].find(g=>g.id===grpId);
  if (!grp) return;
  grp[slot] = {dataUrl};
  const cacheKey = dataUrl.substring(0, 80);
  delete imgCache[cacheKey];
  await saveAssetData(grpId + '_' + slot, dataUrl);
  saveConfig();
  renderAssetPanel();
  renderAll();
}

function clearAssetSlot(catKey, grpId, slot) {
  const grp = appState.assets[catKey].find(g=>g.id===grpId);
  if (!grp) return;
  if (grp[slot]) {
    const cacheKey = (grp[slot].dataUrl||'').substring(0,80);
    delete imgCache[cacheKey];
  }
  grp[slot] = null;
  deleteAssetData(grpId+'_'+slot);
  saveConfig();
  renderAssetPanel();
  renderAll();
}

function deleteAssetGroup(catKey, grpId) {
  if (!confirm('删除该素材组？')) return;
  const arr = appState.assets[catKey];
  const idx = arr.findIndex(g=>g.id===grpId);
  if (idx>=0) {
    const grp = arr[idx];
    for (const slot of ['head','mid','tail']) { if(grp[slot]) deleteAssetData(grpId+'_'+slot); }
    arr.splice(idx,1);
  }
  saveConfig(); renderAssetPanel(); renderAll();
}

function applyAssetGroupToSelected(catKey, groupId) {
  const el = getSelectedElement();
  if (!el) { alert('请先选中一个元素'); return; }
  if (catKey === 'backgrounds' && el.type === 'background') {
    el.bgType = 'three-segment';
    el.bgAssetGroupId = groupId;
  } else if ((catKey === 'titleBars' && el.type === 'title-bar') || (catKey === 'textBoxes' && el.type === 'text-box')) {
    el.assetGroupId = groupId;
  } else {
    alert('素材类型与选中元素不匹配');
    return;
  }
  renderAll(); renderPropsPanel(); saveConfig();
}

async function uploadSingleAsset(catKey) {
  const file = await pickFile('image/*');
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  const id = uid();
  const name = file.name.replace(/\.[^.]+$/,'');
  appState.assets[catKey].push({id, name, dataUrl});
  await saveAssetData(id, dataUrl);
  saveConfig(); renderAssetPanel();
}

function deleteSingleAsset(catKey, assetId) {
  const arr = appState.assets[catKey];
  const idx = arr.findIndex(a=>a.id===assetId);
  if (idx>=0) { deleteAssetData(assetId); arr.splice(idx,1); }
  saveConfig(); renderAssetPanel();
}

// ===== RIGHT PANEL: PROPERTIES =====
function renderPropsPanel() {
  const panel = document.getElementById('props-panel');
  const el = getSelectedElement();
  const mod = getSelectedModule();
  if (!el) {
    if (mod) {
      panel.innerHTML = `
<div class="props-title">📦 模块属性</div>
<div class="props-section">
  <div class="section-title">模块信息</div>
  <div class="props-row">
    <span class="props-label">名称</span>
    <input class="props-input" id="mod-name-input" value="${escHtml(mod.name)}" oninput="renameSelectedModule(this.value)">
  </div>
  <div class="props-row">
    <span class="props-label">高度</span>
    <label class="props-check">
      <input type="checkbox" ${mod.autoHeight?'checked':''} onchange="updateModProp('autoHeight',this.checked)"> 自动
    </label>
    ${!mod.autoHeight?`<input class="props-num" type="number" value="${mod.fixedHeight||300}" style="margin-left:6px" onchange="updateModProp('fixedHeight',+this.value)"> px`:''}
  </div>
  <div class="props-row">
    <span class="props-label">上边距</span>
    <input class="props-num" type="number" value="${mod.marginTop||0}" onchange="updateModProp('marginTop',+this.value)">
    <span class="props-label" style="margin-left:6px">下边距</span>
    <input class="props-num" type="number" value="${mod.marginBottom||0}" onchange="updateModProp('marginBottom',+this.value)">
  </div>
  <div class="props-row" style="flex-wrap:wrap;gap:4px">
    <span class="props-label" style="width:100%">内边距</span>
    <label style="font-size:10px;color:#4a8af0">上</label>
    <input class="props-num" type="number" style="width:36px" value="${mod.paddingTop||0}" onchange="updateModProp('paddingTop',+this.value)">
    <label style="font-size:10px;color:#4a8af0">右</label>
    <input class="props-num" type="number" style="width:36px" value="${mod.paddingRight||0}" onchange="updateModProp('paddingRight',+this.value)">
    <label style="font-size:10px;color:#4a8af0">下</label>
    <input class="props-num" type="number" style="width:36px" value="${mod.paddingBottom||0}" onchange="updateModProp('paddingBottom',+this.value)">
    <label style="font-size:10px;color:#4a8af0">左</label>
    <input class="props-num" type="number" style="width:36px" value="${mod.paddingLeft||0}" onchange="updateModProp('paddingLeft',+this.value)">
  </div>
</div>
<div class="props-section">
  <div class="section-title">添加元素</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
    <button class="add-el-btn" onclick="addElementToModule('title-bar')">＋ 标题栏</button>
    <button class="add-el-btn" onclick="addElementToModule('text-box')">＋ 文本框</button>
    <button class="add-el-btn" onclick="addElementToModule('text')">＋ 文字</button>
    <button class="add-el-btn" onclick="addElementToModule('image')">＋ 图片</button>
  </div>
</div>
<div class="props-section">
  <div class="section-title">模块元素列表</div>
  <div id="mod-el-list">${renderModElementList(mod)}</div>
</div>`;
    } else {
      panel.innerHTML = '<div class="no-select-hint">👈 选择左侧模块<br>再点击画布中的元素<br>在此编辑属性</div>';
    }
    return;
  }
  const typeLabels = {text:'文字元素',image:'图片元素',background:'背景元素','title-bar':'标题栏','text-box':'文本框'};
  let html = `<div class="props-title">${typeLabels[el.type]||el.type}</div>`;
  if (appState.view === 'content' && isDesignEl(el)) {
    html += `<div class="mode-lock-note">🎨 切换到模块设计视图后可编辑此元素</div>`;
  } else if (appState.view === 'block' && isContentEl(el)) {
    html += `<div class="mode-lock-note">📝 切换到内容填充视图后可编辑此元素</div>`;
  }
  html += `<div class="props-section">
  <div class="section-title">变换</div>
  <div class="props-row">
    <span class="props-label">X</span>
    <input class="props-num" type="number" value="${el.x}" id="px-x" onchange="updateEl('x',+this.value)">
    <button class="step-btn" onclick="stepEl('x',-1,event)">−</button>
    <button class="step-btn" onclick="stepEl('x',1,event)">+</button>
    <span class="props-label" style="margin-left:4px">Y</span>
    <input class="props-num" type="number" value="${el.y}" id="px-y" onchange="updateEl('y',+this.value)">
    <button class="step-btn" onclick="stepEl('y',-1,event)">−</button>
    <button class="step-btn" onclick="stepEl('y',1,event)">+</button>
  </div>
  <div class="props-row">
    <span class="props-label">W</span>
    <input class="props-num" type="number" value="${el.width}" id="px-w" onchange="updateEl('width',+this.value)">
    <button class="step-btn" onclick="stepEl('width',-1,event)">−</button>
    <button class="step-btn" onclick="stepEl('width',1,event)">+</button>
    <span class="props-label" style="margin-left:4px">H</span>
    <input class="props-num" type="number" value="${el.height}" id="px-h" onchange="updateEl('height',+this.value)">
    <button class="step-btn" onclick="stepEl('height',-1,event)">−</button>
    <button class="step-btn" onclick="stepEl('height',1,event)">+</button>
  </div>
  <div class="props-row">
    <label class="props-check"><input type="checkbox" ${el.locked?'checked':''} onchange="updateEl('locked',this.checked)"> 锁定</label>
    <label class="props-check" style="margin-left:10px"><input type="checkbox" ${el.visible?'checked':''} onchange="updateEl('visible',this.checked)"> 显示</label>
  </div>
</div>`;
  if (['text','title-bar','text-box'].includes(el.type)) {
    html += `<div class="props-section">
  <div class="section-title">文字</div>
  <textarea class="props-textarea" id="px-text" rows="4">${escHtml(el.text||'')}</textarea>
  <div class="props-row" style="margin-top:5px">
    <span class="props-label">字体</span>
    <select class="props-select" onchange="updateEl('font',this.value)">
      ${FONTS.map(f=>`<option value="${f.value}"${el.font===f.value?' selected':''}>${f.label}</option>`).join('')}
    </select>
  </div>
  <div class="props-row">
    <span class="props-label">字号</span>
    <input class="props-num" type="number" value="${el.fontSize||16}" onchange="updateEl('fontSize',+this.value)">
    <button class="step-btn" onclick="stepEl('fontSize',-1,event)">−</button>
    <button class="step-btn" onclick="stepEl('fontSize',1,event)">+</button>
    <span class="props-label" style="margin-left:4px">颜色</span>
    <input type="color" class="props-color" value="${el.color||'#ffffff'}" oninput="updateEl('color',this.value)">
  </div>
  <div class="props-row">
    <label class="props-check"><input type="checkbox" ${el.bold?'checked':''} onchange="updateEl('bold',this.checked)"> 粗体</label>
    <label class="props-check" style="margin-left:8px"><input type="checkbox" ${el.italic?'checked':''} onchange="updateEl('italic',this.checked)"> 斜体</label>
  </div>
  <div class="props-row">
    <span class="props-label">对齐</span>
    <div class="btn-group-4">
      <button class="${el.align==='left'?'active':''}" onclick="updateEl('align','left')">左</button>
      <button class="${el.align==='center'?'active':''}" onclick="updateEl('align','center')">中</button>
      <button class="${el.align==='right'?'active':''}" onclick="updateEl('align','right')">右</button>
      <button class="${el.align==='justify'?'active':''}" onclick="updateEl('align','justify')">齐</button>
    </div>
  </div>
  ${el.type!=='title-bar'?`<div class="props-row">
    <span class="props-label">行高</span>
    <input class="props-num" type="number" step="0.1" min="0.8" max="5" value="${el.lineHeight||1.5}" onchange="updateEl('lineHeight',+this.value)">
    <button class="step-btn" onclick="stepEl('lineHeight',-0.1,event)">−</button>
    <button class="step-btn" onclick="stepEl('lineHeight',0.1,event)">+</button>
  </div>
  <div class="props-row">
    <span class="props-label">字间距</span>
    <input class="props-num" type="number" step="1" value="${el.letterSpacing||0}" onchange="updateEl('letterSpacing',+this.value)">
    <button class="step-btn" onclick="stepEl('letterSpacing',-1,event)">−</button>
    <button class="step-btn" onclick="stepEl('letterSpacing',1,event)">+</button>
  </div>
  <div class="props-row">
    <span class="props-label">段间距</span>
    <input class="props-num" type="number" step="1" value="${el.paraSpacing||0}" onchange="updateEl('paraSpacing',+this.value)">
    <button class="step-btn" onclick="stepEl('paraSpacing',-2,event)">−</button>
    <button class="step-btn" onclick="stepEl('paraSpacing',2,event)">+</button>
  </div>`:''}
</div>`;
  }
  if (el.type==='title-bar' || el.type==='text-box') {
    const grp = getAssetGroup(el.assetGroupId);
    const prevHtml = grp ? `<div class="asset-pick-preview">
      ${grp.head?`<img src="${grp.head.dataUrl}" title="头段">`:''}
      ${grp.mid?`<img src="${grp.mid.dataUrl}" title="中段">`:''}
      ${grp.tail?`<img src="${grp.tail.dataUrl}" title="尾段">`:''}
    </div>` : '';
    html += `<div class="props-section">
  <div class="section-title">框体素材</div>
  <div class="asset-pick-row">
    ${prevHtml}
    <button class="asset-pick-btn" onclick="openAssetPicker('${el.type==='title-bar'?'titleBars':'textBoxes'}','assetGroupId')">更换素材组</button>
  </div>
</div>`;
  }
  if (el.type==='background' && el.bgType==='three-segment') {
    const grp = getAssetGroup(el.bgAssetGroupId);
    const prevHtml = grp ? `<div class="asset-pick-preview">
      ${grp.head?`<img src="${grp.head.dataUrl}" title="头段">`:''}
      ${grp.mid?`<img src="${grp.mid.dataUrl}" title="中段">`:''}
      ${grp.tail?`<img src="${grp.tail.dataUrl}" title="尾段">`:''}
    </div>` : '';
    html += `<div class="asset-pick-row">${prevHtml}
      <button class="asset-pick-btn" onclick="openAssetPicker('backgrounds','bgAssetGroupId')">更换背景素材</button>
    </div>`;
  }
  if (el.type==='image') {
    const asset = getSingleAsset(el.assetId);
    html += `<div class="props-section">
  <div class="section-title">图片设置</div>
  <div class="props-row">
    <span class="props-label">素材</span>
    <button class="asset-pick-btn" onclick="openAssetPicker('images','assetId')">${asset?escHtml(asset.name):'选择图片'}</button>
    <button class="asset-pick-btn" onclick="uploadImageDirect()" style="margin-left:4px">📁 上传</button>
  </div>
  <div class="props-row">
    <span class="props-label">适应</span>
    <select class="props-select" onchange="updateEl('fit',this.value)">
      ${['cover','contain','fill','none'].map(v=>`<option value="${v}"${el.fit===v?' selected':''}>${v}</option>`).join('')}
    </select>
  </div>
  <div class="props-row">
    <span class="props-label">透明</span>
    <input type="range" class="props-slider" min="0" max="1" step="0.01" value="${el.opacity??1}" oninput="updateEl('opacity',+this.value)">
    <span style="font-size:11px;color:#aaa;min-width:28px">${Math.round((el.opacity??1)*100)}%</span>
  </div>
  <div class="props-row">
    <span class="props-label">圆角</span>
    <input type="range" class="props-slider" min="0" max="200" value="${el.borderRadius||0}" oninput="updateEl('borderRadius',+this.value)">
    <span style="font-size:11px;color:#aaa;min-width:24px">${el.borderRadius||0}</span>
  </div>
</div>`;
  }
  if (el.type==='background') {
    html += `<div class="props-section">
  <div class="section-title">背景设置</div>
  <div class="bg-type-btns">
    <button class="bg-type-btn${el.bgType==='solid'?' active':''}" onclick="updateEl('bgType','solid')">纯色</button>
    <button class="bg-type-btn${el.bgType==='linear-gradient'?' active':''}" onclick="updateEl('bgType','linear-gradient')">线性渐变</button>
    <button class="bg-type-btn${el.bgType==='radial-gradient'?' active':''}" onclick="updateEl('bgType','radial-gradient')">径向渐变</button>
    <button class="bg-type-btn${el.bgType==='three-segment'?' active':''}" onclick="updateEl('bgType','three-segment')">三段素材</button>
  </div>
  <div class="props-row">
    <span class="props-label">颜色1</span>
    <input type="color" class="props-color" value="${el.bgColor||'#1a1a2e'}" oninput="updateEl('bgColor',this.value)">
    ${el.bgType!=='solid'?`<span class="props-label" style="margin-left:6px">颜色2</span><input type="color" class="props-color" value="${el.bgColor2||'#ffffff'}" oninput="updateEl('bgColor2',this.value)">`:''} 
  </div>
  ${el.bgType==='linear-gradient'?`<div class="props-row">
    <span class="props-label">角度</span>
    <input class="props-num" type="number" value="${el.bgAngle||180}" onchange="updateEl('bgAngle',+this.value)">°
  </div>`:''}
</div>`;
  }
  html += `<div class="props-section">
  <div class="section-title">对齐</div>
  <div class="align-btns">
    <button class="align-btn" title="左对齐" onclick="alignEl('left')">⇤</button>
    <button class="align-btn" title="水平居中" onclick="alignEl('cx')">↔</button>
    <button class="align-btn" title="右对齐" onclick="alignEl('right')">⇥</button>
    <button class="align-btn" title="顶对齐" onclick="alignEl('top')">⇡</button>
    <button class="align-btn" title="垂直居中" onclick="alignEl('cy')">↕</button>
    <button class="align-btn" title="底对齐" onclick="alignEl('bottom')">⇣</button>
  </div>
</div>`;
  html += `<div class="props-section">
  <div class="section-title">层级</div>
  <div class="layer-btns">
    <button class="layer-btn" onclick="layerOp('up')">上移↑</button>
    <button class="layer-btn" onclick="layerOp('down')">下移↓</button>
    <button class="layer-btn" onclick="layerOp('top')">置顶⤒</button>
    <button class="layer-btn" onclick="layerOp('bottom')">置底⤓</button>
  </div>
</div>`;
  if (['title-bar','text-box'].includes(el.type)) {
    const p = el.padding||{top:8,right:12,bottom:8,left:12};
    html += `<div class="props-section">
  <div class="section-title">内边距</div>
  <div class="props-row">
    <span class="props-label">上</span><input class="props-num" type="number" value="${p.top}" style="width:48px" onchange="updatePadding('top',+this.value)">
    <span class="props-label">右</span><input class="props-num" type="number" value="${p.right}" style="width:48px" onchange="updatePadding('right',+this.value)">
    <span class="props-label">下</span><input class="props-num" type="number" value="${p.bottom}" style="width:48px" onchange="updatePadding('bottom',+this.value)">
    <span class="props-label">左</span><input class="props-num" type="number" value="${p.left}" style="width:48px" onchange="updatePadding('left',+this.value)">
  </div>
</div>`;
  }
  if (['text','title-bar','text-box'].includes(el.type)) {
    const te = el.textEffect||{};
    html += `<div class="props-section">
  <div class="section-title">文字效果</div>
  <div class="props-row">
    <span class="props-label">效果</span>
    <select class="props-select" onchange="updateTextEffect(this.value)">
      <option value=""${!te.type?' selected':''}>无</option>
      <option value="shadow"${te.type==='shadow'?' selected':''}>阴影</option>
      <option value="stroke"${te.type==='stroke'?' selected':''}>描边</option>
      <option value="gradient"${te.type==='gradient'?' selected':''}>渐变色</option>
    </select>
  </div>
  ${te.type==='shadow'?`<div class="props-row">
    <span class="props-label">颜色</span><input type="color" class="props-color" value="${te.color||'#000000'}" oninput="updateTextEffectProp('color',this.value)">
    <span class="props-label">模糊</span><input class="props-num" type="number" value="${te.blur||4}" style="width:44px" onchange="updateTextEffectProp('blur',+this.value)">
  </div>
  <div class="props-row">
    <span class="props-label">偏X</span><input class="props-num" type="number" value="${te.dx||2}" style="width:44px" onchange="updateTextEffectProp('dx',+this.value)">
    <span class="props-label">偏Y</span><input class="props-num" type="number" value="${te.dy||2}" style="width:44px" onchange="updateTextEffectProp('dy',+this.value)">
  </div>`:''}
  ${te.type==='stroke'?`<div class="props-row">
    <span class="props-label">描边色</span><input type="color" class="props-color" value="${te.strokeColor||'#000000'}" oninput="updateTextEffectProp('strokeColor',this.value)">
    <span class="props-label">线宽</span><input class="props-num" type="number" value="${te.strokeWidth||2}" style="width:44px" onchange="updateTextEffectProp('strokeWidth',+this.value)">
  </div>`:''}
  ${te.type==='gradient'?`<div class="props-row">
    <span class="props-label">颜色1</span><input type="color" class="props-color" value="${te.gradColor1||'#ffcc00'}" oninput="updateTextEffectProp('gradColor1',this.value)">
    <span class="props-label">颜色2</span><input type="color" class="props-color" value="${te.gradColor2||'#ff4400'}" oninput="updateTextEffectProp('gradColor2',this.value)">
  </div>`:''}
</div>`;
  }
  panel.innerHTML = html;
  const ta = document.getElementById('px-text');
  if (ta) {
    ta.addEventListener('input', function() {
      const el2 = getSelectedElement();
      if (el2) { el2.text = this.value; renderAll(); saveConfig(); }
    });
  }
}

function updatePropsTransform() {
  const el = getSelectedElement();
  if (!el) return;
  const xEl = document.getElementById('px-x');
  const yEl = document.getElementById('px-y');
  const wEl = document.getElementById('px-w');
  const hEl = document.getElementById('px-h');
  if (xEl) xEl.value = el.x;
  if (yEl) yEl.value = el.y;
  if (wEl) wEl.value = el.width;
  if (hEl) hEl.value = el.height;
}

function updateEl(prop, val) {
  const el = getSelectedElement();
  if (!el) return;
  el[prop] = val;
  renderAll();
  if (['bgType','textEffect'].includes(prop)) renderPropsPanel();
  saveConfig();
}

function stepEl(prop, delta, e) {
  const step = e.shiftKey ? 10 : 1;
  const el = getSelectedElement();
  if (!el) return;
  const cur = parseFloat(el[prop]) || 0;
  el[prop] = Math.round((cur + delta * step) * 1000) / 1000;
  renderAll();
  updatePropsTransform();
  renderPropsPanel();
  renderOverlay();
  saveConfig();
}

function updatePadding(side, val) {
  const el = getSelectedElement();
  if (!el) return;
  if (!el.padding) el.padding = {top:8,right:12,bottom:8,left:12};
  el.padding[side] = val;
  renderAll(); saveConfig();
}

function updateTextEffect(type) {
  const el = getSelectedElement();
  if (!el) return;
  if (!type) { el.textEffect = null; }
  else if (type === 'shadow') { el.textEffect = {type:'shadow', color:'rgba(0,0,0,0.6)', blur:6, dx:2, dy:2}; }
  else if (type === 'stroke') { el.textEffect = {type:'stroke', strokeColor:'#000000', strokeWidth:2}; }
  else if (type === 'gradient') { el.textEffect = {type:'gradient', gradColor1:'#ffcc00', gradColor2:'#ff4400'}; }
  renderPropsPanel(); renderAll(); saveConfig();
}

function updateTextEffectProp(prop, val) {
  const el = getSelectedElement();
  if (!el || !el.textEffect) return;
  el.textEffect[prop] = val;
  renderAll(); saveConfig();
}

async function uploadImageDirect() {
  const file = await pickFile('image/*');
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  const id = uid();
  const name = file.name.replace(/\.[^.]+$/, '');
  appState.assets.images.push({id, name, dataUrl});
  await saveAssetData(id, dataUrl);
  const el = getSelectedElement();
  if (el) { el.assetId = id; renderAll(); renderPropsPanel(); saveConfig(); }
  renderAssetPanel();
}

function alignEl(dir) {
  const el = getSelectedElement();
  const mod = getSelectedModule();
  if (!el || !mod) return;
  const cw = appState.canvas.width;
  const mInfo = moduleYMap[mod.id] || {height:calcModuleHeight(mod)};
  const mh = mInfo.height;
  if (dir==='left')   el.x = 0;
  if (dir==='cx')     el.x = Math.round((cw - el.width)/2);
  if (dir==='right')  el.x = cw - el.width;
  if (dir==='top')    el.y = 0;
  if (dir==='cy')     el.y = Math.round((mh - el.height)/2);
  if (dir==='bottom') el.y = mh - el.height;
  renderAll(); updatePropsTransform(); saveConfig();
}

function layerOp(op) {
  const el = getSelectedElement();
  const mod = getSelectedModule();
  if (!el || !mod) return;
  const els = mod.elements;
  const sorted = [...els].sort((a,b)=>(a.zIndex||0)-(b.zIndex||0));
  const myZ = el.zIndex||0;
  if (op==='up')     { const above = sorted.filter(e=>e.id!==el.id&&(e.zIndex||0)>myZ); if(above.length) { el.zIndex=(above[0].zIndex||0)+1; } }
  if (op==='down')   { const below = sorted.filter(e=>e.id!==el.id&&(e.zIndex||0)<myZ); if(below.length) { const last=below[below.length-1]; el.zIndex=(last.zIndex||0)-1; } }
  if (op==='top')    { el.zIndex = Math.max(0,...els.map(e=>e.zIndex||0)) + 1; }
  if (op==='bottom') { el.zIndex = Math.min(0,...els.map(e=>e.zIndex||0)) - 1; }
  renderAll(); saveConfig();
}

// ===== ASSET PICKER MODAL =====
let pickerCatKey = '';
let pickerTargetProp = '';
let pickerSelectedId = '';

function openAssetPicker(catKey, targetProp) {
  pickerCatKey = catKey;
  pickerTargetProp = targetProp;
  pickerSelectedId = '';
  const cat = ASSET_CATS.find(c=>c.key===catKey);
  document.getElementById('asset-picker-title').innerHTML =
    `选择素材 - ${cat?cat.label:catKey} <button class="modal-close" onclick="hideModal('modal-asset-picker')">✕</button>`;
  const content = document.getElementById('asset-picker-content');
  content.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'asset-picker-grid';
  if (cat && cat.three) {
    for (const grp of appState.assets[catKey]) {
      const item = document.createElement('div');
      item.className = 'asset-picker-item';
      item.dataset.id = grp.id;
      item.innerHTML = `<div class="picker-previews">
        ${grp.head?`<img src="${grp.head.dataUrl}">`:'<span style="flex:1;height:36px;background:#111;border-radius:2px"></span>'}
        ${grp.mid?`<img src="${grp.mid.dataUrl}">`:'<span style="flex:1;height:36px;background:#111;border-radius:2px"></span>'}
        ${grp.tail?`<img src="${grp.tail.dataUrl}">`:'<span style="flex:1;height:36px;background:#111;border-radius:2px"></span>'}
      </div><div class="picker-name">${escHtml(grp.name)}</div>`;
      item.onclick = () => {
        pickerSelectedId = grp.id;
        grid.querySelectorAll('.asset-picker-item').forEach(el=>el.classList.remove('selected'));
        item.classList.add('selected');
      };
      grid.appendChild(item);
    }
    if (appState.assets[catKey].length === 0) {
      grid.innerHTML = '<div style="color:#555;padding:20px;grid-column:span 3;text-align:center">暂无素材，请先在素材库中上传</div>';
    }
  } else {
    for (const a of appState.assets[catKey]) {
      const item = document.createElement('div');
      item.className = 'asset-picker-item asset-picker-single';
      item.dataset.id = a.id;
      item.innerHTML = `<img src="${a.dataUrl}"><div class="picker-name">${escHtml(a.name)}</div>`;
      item.onclick = () => {
        pickerSelectedId = a.id;
        grid.querySelectorAll('.asset-picker-item').forEach(el=>el.classList.remove('selected'));
        item.classList.add('selected');
      };
      grid.appendChild(item);
    }
    if (appState.assets[catKey].length === 0) {
      grid.innerHTML = '<div style="color:#555;padding:20px;grid-column:span 3;text-align:center">暂无图片，请先上传</div>';
    }
  }
  content.appendChild(grid);
  showModal('modal-asset-picker');
}

function confirmAssetPick() {
  if (!pickerSelectedId) { hideModal('modal-asset-picker'); return; }
  const el = getSelectedElement();
  if (el) {
    el[pickerTargetProp] = pickerSelectedId;
    renderAll();
    renderPropsPanel();
    saveConfig();
  }
  hideModal('modal-asset-picker');
}

// ===== THREE-VIEW SYSTEM =====
function setView(view) {
  appState.view = view;
  if (view === 'block') appState.mode = 'design';
  else if (view === 'content') appState.mode = 'content';
  ['page','block','content','assets'].forEach(function(v) {
    const btn = document.getElementById('nav-'+v);
    if (btn) btn.classList.toggle('active', v === view);
  });
  ['page','block','content','assets'].forEach(function(v) {
    const panel = document.getElementById('view-'+v);
    if (panel) panel.classList.toggle('hidden', v !== view);
  });
  if (view === 'page') {
    appState.selectedElementId = null;
  }
  renderPageView();
  renderBlockView();
  renderContentView();
  renderPropsPanel();
  renderOverlay();
  renderAll();
  if (view === 'assets') { setTimeout(() => renderAssetPanel(), 50); }
}

function renderPageView() {
  const listEl = document.getElementById('page-module-list');
  if (!listEl) return;
  listEl.innerHTML = appState.modules.map(function(mod, i) {
    return '<div class="mod-card' + (mod.id===appState.selectedModuleId?' active':'') + '"'
      + ' onclick="selectModuleInView(\'' + mod.id + '\')"'
      + ' draggable="true"'
      + ' ondragstart="modDragStart(event,' + i + ')"'
      + ' ondragover="event.preventDefault()"'
      + ' ondrop="modDrop(event,' + i + ')">'
      + '<span class="mod-seq">' + (i+1) + '</span>'
      + '<span class="mod-label">' + escHtml(mod.name||'模块') + '</span>'
      + '<div class="mod-move-btns">'
      + '<button class="mod-mv-btn" onclick="moveModule(' + i + ',-1);event.stopPropagation()" title="上移"' + (i===0?' disabled':'') + '>↑</button>'
      + '<button class="mod-mv-btn" onclick="moveModule(' + i + ',1);event.stopPropagation()" title="下移"' + (i===appState.modules.length-1?' disabled':'') + '>↓</button>'
      + '</div>'
      + '<button class="mod-del" onclick="deleteModule(\'' + mod.id + '\');event.stopPropagation()">✕</button>'
      + '</div>';
  }).join('');
  const bg = appState.pageBg || {type:'color',color:'#0a0a18'};
  const radios = document.querySelectorAll('input[name="page-bg"]');
  radios.forEach(function(r) { r.checked = r.value === bg.type; });
  togglePageBgCtrl(bg.type);
  if (bg.color) { const c = document.querySelector('#page-bg-color-ctrl input'); if(c) c.value = bg.color; }
  const m = appState.pageMargin || {top:0,right:0,bottom:0,left:0};
  ['top','right','bottom','left'].forEach(function(d) {
    const el = document.getElementById('pg-m'+d[0]);
    if (el) el.value = m[d]||0;
  });
}

function moveModule(index, delta) {
  const mods = appState.modules;
  const newIndex = index + delta;
  if (newIndex < 0 || newIndex >= mods.length) return;
  [mods[index], mods[newIndex]] = [mods[newIndex], mods[index]];
  renderAll(); renderPageView(); saveConfig();
}

let _modDragIdx = null;
function modDragStart(event, index) {
  _modDragIdx = index;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', index);
}
function modDrop(event, targetIndex) {
  event.preventDefault();
  if (_modDragIdx === null || _modDragIdx === targetIndex) return;
  const mods = appState.modules;
  const dragged = mods.splice(_modDragIdx, 1)[0];
  mods.splice(targetIndex, 0, dragged);
  _modDragIdx = null;
  renderAll(); renderPageView(); saveConfig();
}

function renderBlockView() {
  const mod = getSelectedModule();
  const noSel = document.getElementById('block-no-select');
  const panel = document.getElementById('block-design-panel');
  if (noSel) noSel.classList.toggle('hidden', !!mod);
  if (panel) panel.classList.toggle('hidden', !mod);
  if (!mod) return;
  const nameEl = document.getElementById('block-name-display');
  if (nameEl) nameEl.textContent = mod.name||'模块';
  const autoH = document.getElementById('block-auto-h');
  const fixedH = document.getElementById('block-fixed-h');
  if (autoH) autoH.checked = !!mod.autoHeight;
  if (fixedH) { fixedH.value = mod.fixedHeight||300; fixedH.disabled = !!mod.autoHeight; }
  var propMap = {pt:'paddingTop',pr:'paddingRight',pb:'paddingBottom',pl:'paddingLeft'};
  ['pt','pr','pb','pl'].forEach(function(k) {
    const inp = document.getElementById('blk-'+k);
    if (inp) inp.value = mod[propMap[k]]||0;
  });
  var marginMap = {mt:'marginTop',mb:'marginBottom'};
  ['mt','mb'].forEach(function(k) {
    const inp = document.getElementById('blk-'+k);
    if (inp) inp.value = mod[marginMap[k]]||0;
  });
  const typeLabels = {background:'背景','title-bar':'标题栏'};
  const designEls = mod.elements.filter(function(e) { return isDesignEl(e); });
  const designList = document.getElementById('block-design-els');
  if (designList) {
    if (designEls.length === 0) {
      designList.innerHTML = '<div class="hint-text" style="padding:6px">无设计元素</div>';
    } else {
      designList.innerHTML = designEls.map(function(el) {
        return '<div class="mod-el-item' + (el.id===appState.selectedElementId?' active':'') + '" onclick="selectElInView(\'' + mod.id + '\',\'' + el.id + '\')">'
          + '<span class="mod-el-type">' + (typeLabels[el.type]||el.type) + '</span>'
          + '<span class="mod-el-name">' + escHtml((el.text||el.type).substring(0,10)) + '</span>'
          + '<button class="mod-el-del" onclick="deleteElementById(\'' + el.id + '\');event.stopPropagation()">✕</button>'
          + '</div>';
      }).join('');
    }
  }
}

function renderContentView() {
  const mod = getSelectedModule();
  const noSel = document.getElementById('content-no-select');
  const fillPanel = document.getElementById('content-fill-panel');
  if (noSel) noSel.classList.toggle('hidden', !!mod);
  if (fillPanel) fillPanel.classList.toggle('hidden', !mod);
  if (!mod) return;
  const typeLabels = {text:'文字',image:'图片','text-box':'文本框'};
  const contentEls = mod.elements.filter(function(e) { return isContentEl(e); });
  const list = document.getElementById('content-els-list');
  if (list) {
    if (contentEls.length === 0) {
      list.innerHTML = '<div class="hint-text" style="padding:6px">无内容元素</div>';
    } else {
      list.innerHTML = contentEls.map(function(el) {
        return '<div class="mod-el-item' + (el.id===appState.selectedElementId?' active':'') + '" onclick="selectElInView(\'' + mod.id + '\',\'' + el.id + '\')">'
          + '<span class="mod-el-type">' + (typeLabels[el.type]||el.type) + '</span>'
          + '<span class="mod-el-name">' + escHtml((el.text||el.type||'').substring(0,10)) + '</span>'
          + '<button class="mod-el-del" onclick="deleteElementById(\'' + el.id + '\');event.stopPropagation()">✕</button>'
          + '</div>';
      }).join('');
    }
  }
}

function selectModuleInView(modId) {
  selectModule(modId);
  appState.selectedElementId = null;
  renderBlockView();
  renderContentView();
  renderPropsPanel();
  renderOverlay();
}

function selectElInView(modId, elId) {
  appState.selectedModuleId = modId;
  appState.selectedElementId = elId;
  renderBlockView();
  renderContentView();
  renderPropsPanel();
  renderOverlay();
}

function switchAssetTab(tab, btn) {
  document.querySelectorAll('.asset-tab').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  const d = document.getElementById('asset-tab-design');
  const c = document.getElementById('asset-tab-content');
  if (d) d.classList.toggle('hidden', tab !== 'design');
  if (c) c.classList.toggle('hidden', tab !== 'content');
}

// Page background
function setPageBg(type) {
  if (!appState.pageBg) appState.pageBg = { type: 'color', color: '#0a0a18' };
  appState.pageBg.type = type;
  togglePageBgCtrl(type);
  const gradExtra = document.getElementById('page-bg-gradient-extra');
  if (gradExtra) gradExtra.classList.toggle('hidden', type !== 'gradient');
  renderAll();
}

function togglePageBgCtrl(type) {
  const colorCtrl = document.getElementById('page-bg-color-ctrl');
  const imgCtrl = document.getElementById('page-bg-image-ctrl');
  if (colorCtrl) colorCtrl.classList.toggle('hidden', type !== 'color' && type !== 'gradient');
  if (imgCtrl) imgCtrl.classList.toggle('hidden', type !== 'image');
}

function updatePageBgColor(val) {
  if (!appState.pageBg) appState.pageBg = { type: 'color', color: val };
  appState.pageBg.color = val;
  appState.bgColor = val;
  renderAll(); saveConfig();
}

function updatePageBgColor2(val) {
  if (!appState.pageBg) appState.pageBg = {};
  appState.pageBg.color2 = val;
  renderAll(); saveConfig();
}

function updatePageMargin(dir, val) {
  if (!appState.pageMargin) appState.pageMargin = {top:0,right:0,bottom:0,left:0};
  appState.pageMargin[dir] = val;
  saveConfig();
}

async function uploadPageBgImage() {
  const file = await pickFile('image/*');
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  if (!appState.pageBg) appState.pageBg = {};
  appState.pageBg.imageDataUrl = dataUrl;
  appState.pageBg.type = 'image';
  const prev = document.getElementById('page-bg-preview');
  if (prev) prev.innerHTML = '<img src="' + dataUrl + '" style="width:100%;border-radius:4px;margin-top:4px">';
  renderAll(); saveConfig();
}

async function uploadContentAsset() {
  const file = await pickFile('image/*');
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  const id = uid();
  const name = file.name.replace(/\.[^.]+$/, '');
  appState.assets.images.push({ id, name, dataUrl });
  await saveAssetData(id, dataUrl);
  renderContentView();
  alert('✅ 内容图片已上传');
}

function startRenameBlock(el) {
  const mod = getSelectedModule();
  if (!mod) return;
  const inp = document.createElement('input');
  inp.value = mod.name||'';
  inp.style.cssText = 'width:100%;background:transparent;color:#c0c8e0;border:none;outline:none;font-size:12px';
  el.replaceWith(inp);
  inp.focus(); inp.select();
  const save = function() { if(mod) mod.name=inp.value||mod.name; renderPageView(); renderModuleList(); saveConfig(); inp.replaceWith(el); el.textContent=mod.name; };
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', function(e) { if(e.key==='Enter') inp.blur(); });
}

function applyBlockPreset(preset) {
  const mod = getSelectedModule();
  if (!mod) return;
  const cw = appState.canvas.width;
  const newEls = [];
  if (preset === 'title-text') {
    newEls.push(makeBg(cw, 300));
    newEls.push(makeTitleBar(cw, 0, 0, 60));
  } else if (preset === 'title-image-text') {
    newEls.push(makeBg(cw, 400));
    newEls.push(makeTitleBar(cw, 0, 0, 60));
    newEls.push(makeImg(20, 70, cw-40, 200));
  } else if (preset === 'image-only') {
    newEls.push(makeBg(cw, 300));
    newEls.push(makeImg(0, 0, cw, 300));
  } else if (preset === 'text-only') {
    newEls.push(makeBg(cw, 200));
  }
  if (newEls.length && confirm('应用预设将替换当前模块元素，确定吗？')) {
    mod.elements = newEls;
    renderAll(); renderBlockView(); renderPropsPanel(); saveConfig();
  }
}

function updateBlockProp(prop, val) {
  const mod = getSelectedModule();
  if (!mod) return;
  mod[prop] = val;
  renderAll(); renderBlockView(); saveConfig();
}

function setEditorMode(mode) {
  appState.mode = mode;
  const d = document.getElementById('mode-btn-design');
  if(d) d.classList.toggle('active', mode === 'design');
  const c = document.getElementById('mode-btn-content');
  if(c) c.classList.toggle('active', mode === 'content');
  appState.selectedElementId = null;
  renderAll();
  renderPropsPanel();
  renderOverlay();
  renderModuleList();
}

// ===== TOOLBAR FUNCTIONS =====
function setCanvasWidth(w) {
  appState.canvas.width = w;
  const b750 = document.getElementById('btn-w750');
  const b1080 = document.getElementById('btn-w1080');
  if (b750) b750.classList.toggle('active', w===750);
  if (b1080) b1080.classList.toggle('active', w===1080);
  for (const mod of appState.modules) {
    for (const el of mod.elements) {
      if (el.type==='background') { el.width=w; }
      if (el.type==='title-bar') { el.width=w; }
    }
  }
  renderAll(); saveConfig();
  applyCanvasScale();
}

function toggleGuides() {
  appState.showGuides = !appState.showGuides;
  document.getElementById('btn-guides').classList.toggle('active', appState.showGuides);
  renderOverlay(); saveConfig();
}

function toggleSliceMode() {
  appState.sliceMode = !appState.sliceMode;
  document.getElementById('btn-slice').classList.toggle('active', appState.sliceMode);
  document.getElementById('slice-mode-bar').classList.toggle('hidden', !appState.sliceMode);
  renderSliceOverlay();
}

function clearSliceLines() {
  appState.sliceLines = [];
  renderSliceOverlay();
  saveConfig();
}

function renderSliceOverlay() {
  const overlay = document.getElementById('slice-overlay');
  overlay.innerHTML = '';
  if (!appState.sliceMode) return;
  for (let i = 0; i < appState.sliceLines.length; i++) {
    const y = appState.sliceLines[i];
    const line = document.createElement('div');
    line.className = 'slice-line';
    line.style.top = y + 'px';
    line.dataset.y = y + 'px';
    line.dataset.idx = i;
    let startY, origY;
    line.addEventListener('mousedown', e => {
      startY = e.clientY; origY = y;
      const onMove = mv => {
        const rect = overlayCanvas.getBoundingClientRect();
        const scale = overlayCanvas.height / rect.height;
        const newY = Math.round(origY + (mv.clientY - startY) * scale);
        appState.sliceLines[i] = clamp(newY, 0, mainCanvas.height);
        appState.sliceLines.sort((a,b)=>a-b);
        renderSliceOverlay();
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); saveConfig(); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.stopPropagation();
    });
    overlay.appendChild(line);
  }
  overlay.style.pointerEvents = appState.sliceMode ? 'auto' : 'none';
}

function clearAll() {
  if (!confirm('清除所有内容？')) return;
  appState.modules = [];
  appState.selectedModuleId = null;
  appState.selectedElementId = null;
  appState.sliceLines = [];
  renderModuleList(); renderAll(); renderPropsPanel(); saveConfig();
}

function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

function applyCanvasScale() {
  const area = document.getElementById('canvas-area');
  const inner = document.getElementById('canvas-inner');
  if (!area || !inner) return;
  const areaW = area.clientWidth - 40;
  const cw = appState.canvas.width;
  let scale = 1;
  if (cw > areaW) scale = areaW / cw;
  inner.style.transform = `scale(${scale})`;
  inner.style.width = cw + 'px';
  const scaledH = mainCanvas.height * scale;
  inner.style.marginBottom = (scaledH - mainCanvas.height) + 'px';
}

function setEditorZoom(z) {
  appState.zoom = Math.max(0.25, Math.min(3, parseFloat(z.toFixed(2))));
  const inner = document.getElementById('canvas-inner');
  if (inner) {
    inner.style.transform = `scale(${appState.zoom})`;
    inner.style.transformOrigin = 'top center';
  }
  const lbl = document.getElementById('zoom-label');
  if (lbl) lbl.textContent = Math.round(appState.zoom * 100) + '%';
}

function showTemplateModal() {
  const grid = document.getElementById('template-grid');
  grid.innerHTML = '';
  for (const tpl of TEMPLATES) {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `${tpl.svg}<div class="tpl-name">${tpl.name}</div><div class="tpl-desc">${tpl.desc}</div>`;
    card.onclick = () => {
      const mod = tpl.create(appState.canvas.width);
      appState.modules.push(mod);
      appState.selectedModuleId = mod.id;
      appState.selectedElementId = null;
      renderModuleList();
      renderAll();
      renderPropsPanel();
      saveConfig();
      hideModal('modal-template');
    };
    grid.appendChild(card);
  }
  showModal('modal-template');
}

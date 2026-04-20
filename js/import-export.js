// ===== IMPORT / EXPORT =====

function triggerImport() {
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-file-input').click();
}

async function handleImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    if (file.name.endsWith('.md')) {
      importFromMarkdown(text);
    } else {
      importFromJSON(JSON.parse(text));
    }
  } catch(e) {
    alert('导入失败：' + e.message);
  }
}

function importFromMarkdown(mdText) {
  const lines = mdText.split('\n');
  const newModules = [];
  let currentMod = null;
  let bodyLines = [];
  const cw = appState.canvas.width;

  function flushBody() {
    if (!currentMod || !bodyLines.length) { bodyLines = []; return; }
    const body = bodyLines.join('\n').trim();
    if (body) {
      const el = makeTextBox(20, 90, cw - 40, 120);
      el.text = body;
      currentMod.elements.push(el);
    }
    bodyLines = [];
  }

  function newModule(titleText) {
    flushBody();
    const modId = uid();
    const bg = makeBg(cw, 300);
    const tb = makeTitleBar(cw, 0, 0, 60);
    tb.text = titleText || '新模块';
    const mod = {
      id: modId,
      name: titleText || '新模块',
      autoHeight: true,
      fixedHeight: 300,
      marginTop: 0,
      marginBottom: 0,
      elements: [bg, tb]
    };
    currentMod = mod;
    newModules.push(mod);
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith('# ')) {
      newModule(line.slice(2).trim());
    } else if (line.startsWith('## ')) {
      flushBody();
      if (!currentMod) newModule(line.slice(3).trim());
      else {
        const el = makeText(20, 90, cw - 40, 36, line.slice(3).trim());
        el.fontSize = 20; el.bold = true;
        currentMod.elements.push(el);
      }
    } else if (line.trim() === '---') {
      flushBody();
      currentMod = null;
    } else {
      if (!currentMod) newModule('模块');
      bodyLines.push(line);
    }
  }
  flushBody();

  if (!newModules.length) { alert('未解析到任何模块，请检查 Markdown 格式\n\n格式示例：\n# 标题\n正文内容\n---\n# 第二个标题'); return; }
  const doAppend = confirm('解析到 ' + newModules.length + ' 个模块\n\n点确定：追加到当前页面\n点取消：替换全部内容');
  if (doAppend) {
    appState.modules.push(...newModules);
  } else {
    appState.modules = newModules;
  }
  renderAll(); renderModuleList(); renderPropsPanel(); saveConfig();
  alert('✅ 导入成功：' + newModules.length + ' 个模块');
}

function importFromJSON(data) {
  let modules = Array.isArray(data) ? data : (data.modules || null);
  if (!modules) throw new Error('JSON 格式无效，需包含 modules 数组');
  modules = modules.map(mod => {
    mod.id = mod.id || uid();
    mod.elements = (mod.elements || []).map(el => { el.id = el.id || uid(); return el; });
    return mod;
  });
  const doAppend = confirm('检测到 ' + modules.length + ' 个模块\n\n点确定：追加到当前页面\n点取消：替换全部内容');
  if (doAppend) {
    appState.modules.push(...modules);
  } else {
    appState.modules = modules;
  }
  renderAll(); renderModuleList(); renderPropsPanel(); saveConfig();
  alert('✅ 导入成功：' + modules.length + ' 个模块');
}

function exportProjectJSON() {
  exportProjectFile();
}

// ===== PREVIEW MODE =====
let _pvScale = 1.0;

async function togglePreview() {
  const overlay = document.getElementById('preview-overlay');
  if (!overlay.classList.contains('hidden')) {
    overlay.classList.add('hidden');
    return;
  }
  await renderAll();
  const pc = document.getElementById('preview-canvas');
  pc.width = mainCanvas.width;
  pc.height = mainCanvas.height;
  pc.getContext('2d').drawImage(mainCanvas, 0, 0);
  overlay.classList.remove('hidden');
  previewFit();
}

function previewFit() {
  const body = document.getElementById('preview-body');
  const pc = document.getElementById('preview-canvas');
  if (!body || !pc) return;
  const availW = body.clientWidth - 60;
  const availH = body.clientHeight - 60;
  _pvScale = Math.min(availW / (pc.width||1), availH / (pc.height||1), 1.5);
  applyPvScale();
}

function previewZoom(delta) {
  _pvScale = Math.max(0.2, Math.min(3, _pvScale + delta));
  applyPvScale();
}

function applyPvScale() {
  const inner = document.getElementById('preview-inner');
  if (inner) inner.style.transform = 'scale(' + _pvScale + ')';
  const lbl = document.getElementById('preview-zoom-label');
  if (lbl) lbl.textContent = Math.round(_pvScale * 100) + '%';
}

async function exportPNG() {
  await renderAll();
  mainCanvas.toBlob(blob => { if(blob) downloadBlob(blob, 'longpage.png'); }, 'image/png');
}

async function exportPDF() {
  await renderAll();
  const dataUrl = mainCanvas.toDataURL('image/jpeg', 0.92);
  const w = mainCanvas.width, h = mainCanvas.height;
  const pdfW = 595, pageH = 842;
  const imgW = pdfW;
  const imgH = Math.round(h / w * pdfW);
  try {
    const { jsPDF } = window.jspdf;
    let y = 0;
    let remaining = imgH;
    const doc = new jsPDF({orientation:'portrait', unit:'pt', format:'a4'});
    let pageNum = 0;
    while (remaining > 0) {
      if (pageNum > 0) doc.addPage();
      const pageImgH = Math.min(remaining, pageH);
      const srcY = Math.round(y / imgH * h);
      const srcH = Math.round(pageImgH / imgH * h);
      const tmpC = document.createElement('canvas');
      tmpC.width = w; tmpC.height = srcH;
      const tmpCtx = tmpC.getContext('2d');
      tmpCtx.drawImage(mainCanvas, 0, srcY, w, srcH, 0, 0, w, srcH);
      const pageData = tmpC.toDataURL('image/jpeg', 0.92);
      doc.addImage(pageData, 'JPEG', 0, 0, imgW, pageImgH);
      y += pageH; remaining -= pageH; pageNum++;
    }
    doc.save('longpage.pdf');
  } catch(e) { alert('PDF导出失败: ' + e.message); }
}

async function exportZipSlices() {
  if (appState.sliceLines.length === 0) {
    alert('请先切换到切图模式并添加切割线！'); return;
  }
  await renderAll();
  const lines = [0, ...appState.sliceLines, mainCanvas.height];
  try {
    const zip = new JSZip();
    for (let i = 0; i < lines.length - 1; i++) {
      const y0 = lines[i], y1 = lines[i+1];
      const sliceH = y1 - y0;
      if (sliceH <= 0) continue;
      const tmpC = document.createElement('canvas');
      tmpC.width = mainCanvas.width; tmpC.height = sliceH;
      const tmpCtx = tmpC.getContext('2d');
      tmpCtx.drawImage(mainCanvas, 0, y0, mainCanvas.width, sliceH, 0, 0, mainCanvas.width, sliceH);
      const dataUrl = tmpC.toDataURL('image/png');
      const b64 = dataUrl.split(',')[1];
      zip.file(`slice_${String(i+1).padStart(2,'0')}.png`, b64, {base64:true});
    }
    const blob = await zip.generateAsync({type:'blob'});
    downloadBlob(blob, 'slices.zip');
  } catch(e) { alert('切片导出失败: ' + e.message); }
}

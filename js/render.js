// ===== UTILITY FUNCTIONS =====
let _uidCounter = 1;
function uid() { return 'id_' + Date.now() + '_' + (_uidCounter++); }

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function loadImagePromise(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const imgCache = {};
async function getCachedImage(dataUrl) {
  if (!dataUrl) return null;
  const key = dataUrl.substring(0, 80);
  if (imgCache[key] && imgCache[key].complete) return imgCache[key];
  const img = await loadImagePromise(dataUrl);
  if (img) imgCache[key] = img;
  return img;
}

function getModule(id) { return appState.modules.find(m => m.id === id) || null; }
function getElement(modId, elId) {
  const mod = getModule(modId);
  return mod ? (mod.elements.find(e => e.id === elId) || null) : null;
}
function getSelectedModule() { return getModule(appState.selectedModuleId); }
function getSelectedElement() {
  if (!appState.selectedModuleId || !appState.selectedElementId) return null;
  return getElement(appState.selectedModuleId, appState.selectedElementId);
}

function getAssetGroup(groupId) {
  for (const cat of ['backgrounds','titleBars','textBoxes']) {
    const g = appState.assets[cat].find(g => g.id === groupId);
    if (g) return g;
  }
  return null;
}

function getSingleAsset(assetId) {
  for (const cat of ['images','others']) {
    const a = appState.assets[cat].find(a => a.id === assetId);
    if (a) return a;
  }
  return null;
}

function calcModuleHeight(mod) {
  if (!mod.autoHeight) return mod.fixedHeight || 200;
  let maxBottom = 100;
  for (const el of mod.elements) {
    if (!el.visible) continue;
    if (el.type === 'background') continue;
    const bottom = (el.y || 0) + (el.height || 0);
    if (bottom > maxBottom) maxBottom = bottom;
  }
  return maxBottom + (mod.marginBottom || 0) + (mod.paddingTop || 0) + (mod.paddingBottom || 0);
}

function buildModuleYMap() {
  const map = {};
  let y = 0;
  for (const mod of appState.modules) {
    const h = calcModuleHeight(mod);
    map[mod.id] = {y, height: h};
    y += h;
  }
  return map;
}

function getTotalCanvasHeight() {
  let h = 0;
  for (const mod of appState.modules) h += calcModuleHeight(mod);
  return Math.max(h, 200);
}

function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept;
    inp.onchange = () => resolve(inp.files[0] || null);
    inp.click();
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = e => resolve(e.target.result);
    fr.readAsDataURL(file);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isDesignEl(el) {
  if (!el) return false;
  if (el._group === 'design') return true;
  if (el._group === 'content') return false;
  return el.type === 'background' || el.type === 'title-bar';
}

function isContentEl(el) {
  return !isDesignEl(el);
}

// ===== 5. CANVAS RENDERING =====
function resizeCanvases() {
  const w = appState.canvas.width;
  const h = getTotalCanvasHeight();
  mainCanvas.width = w;
  mainCanvas.height = h;
  overlayCanvas.width = w;
  overlayCanvas.height = h;
}

async function renderAll() {
  resizeCanvases();
  moduleYMap = buildModuleYMap();
  const w = appState.canvas.width;
  const h = mainCanvas.height;

  const pgBg = appState.pageBg;
  if (pgBg && pgBg.type === 'image' && pgBg.imageDataUrl) {
    const bgImg = new Image();
    await new Promise(resolve => {
      bgImg.onload = resolve;
      bgImg.onerror = resolve;
      bgImg.src = pgBg.imageDataUrl;
    });
    ctx.drawImage(bgImg, 0, 0, mainCanvas.width, mainCanvas.height);
  } else if (pgBg && pgBg.type === 'gradient' && pgBg.color) {
    const grad = ctx.createLinearGradient(0, 0, 0, mainCanvas.height);
    grad.addColorStop(0, pgBg.color);
    grad.addColorStop(1, pgBg.color2 || '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
  } else {
    ctx.fillStyle = (pgBg && pgBg.color) || appState.bgColor || '#0a0a18';
    ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
  }

  for (const mod of appState.modules) {
    const mInfo = moduleYMap[mod.id];
    if (!mInfo) continue;
    const modY = mInfo.y;
    const modH = mInfo.height;

    const sorted = [...mod.elements].sort((a, b) => (a.zIndex||0) - (b.zIndex||0));
    for (const el of sorted) {
      if (!el.visible) continue;
      await drawElement(ctx, el, (mod.paddingLeft||0), modY + (mod.paddingTop||0), w, modH);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, modY + modH);
    ctx.lineTo(w, modY + modH);
    ctx.stroke();
  }

  renderOverlay();
  if (typeof applyCanvasScale === 'function') applyCanvasScale();
}

async function drawElement(ctx, el, modX, modY, canvasW, modH) {
  const x = modX + (el.x || 0);
  const y = modY + (el.y || 0);
  const w = el.width || 0;
  const h = el.height || 0;
  if (w <= 0 || h <= 0) return;

  switch(el.type) {
    case 'background': await drawBackground(ctx, el, modX, modY, canvasW, modH); break;
    case 'image':      await drawImageElement(ctx, el, x, y, w, h); break;
    case 'text':       drawTextElement(ctx, el, x, y, w, h); break;
    case 'title-bar':  await drawTitleBar(ctx, el, x, y, w, h); break;
    case 'text-box':   await drawTextBox(ctx, el, x, y, w, h); break;
  }
  const _isLocked = (appState.view === 'block' && isContentEl(el)) ||
                    (appState.view === 'content' && isDesignEl(el));
  if (_isLocked) {
    const _ox = el.type === 'background' ? modX : x;
    const _oy = el.type === 'background' ? modY : y;
    const _ow = el.type === 'background' ? canvasW : w;
    const _oh = el.type === 'background' ? modH : h;
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#060a18';
    ctx.fillRect(_ox, _oy, _ow, _oh);
    ctx.restore();
  }
}

async function drawBackground(ctx, el, x, y, w, h) {
  const bgType = el.bgType || 'solid';
  if (bgType === 'solid') {
    ctx.fillStyle = el.bgColor || '#222';
    ctx.fillRect(x, y, w, h);
  } else if (bgType === 'linear-gradient') {
    const angle = (el.bgAngle || 180) * Math.PI / 180;
    const cx = x + w/2, cy = y + h/2;
    const r = Math.sqrt(w*w + h*h) / 2;
    const gx0 = cx - Math.sin(angle)*r, gy0 = cy - Math.cos(angle)*r;
    const gx1 = cx + Math.sin(angle)*r, gy1 = cy + Math.cos(angle)*r;
    const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    grad.addColorStop(0, el.bgColor || '#000');
    grad.addColorStop(1, el.bgColor2 || '#fff');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  } else if (bgType === 'radial-gradient') {
    const grad = ctx.createRadialGradient(x+w/2, y+h/2, 0, x+w/2, y+h/2, Math.max(w,h)/2);
    grad.addColorStop(0, el.bgColor || '#000');
    grad.addColorStop(1, el.bgColor2 || '#fff');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
  } else if (bgType === 'three-segment') {
    const grp = getAssetGroup(el.bgAssetGroupId);
    if (!grp) {
      ctx.fillStyle = '#333'; ctx.fillRect(x, y, w, h); return;
    }
    const headImg = grp.head ? await getCachedImage(grp.head.dataUrl) : null;
    const midImg  = grp.mid  ? await getCachedImage(grp.mid.dataUrl)  : null;
    const tailImg = grp.tail ? await getCachedImage(grp.tail.dataUrl) : null;
    const headH = headImg ? headImg.naturalHeight : 0;
    const tailH = tailImg ? tailImg.naturalHeight : 0;
    const midH = Math.max(0, h - headH - tailH);
    if (headImg) ctx.drawImage(headImg, x, y, w, headH);
    if (midImg && midH > 0) ctx.drawImage(midImg, x, y + headH, w, midH);
    if (tailImg) ctx.drawImage(tailImg, x, y + headH + midH, w, tailH);
  }
}

async function drawTitleBar(ctx, el, x, y, w, h) {
  const grp = getAssetGroup(el.assetGroupId);
  if (grp) {
    const headImg = grp.head ? await getCachedImage(grp.head.dataUrl) : null;
    const midImg  = grp.mid  ? await getCachedImage(grp.mid.dataUrl)  : null;
    const tailImg = grp.tail ? await getCachedImage(grp.tail.dataUrl) : null;
    const headW = headImg ? headImg.naturalWidth : 0;
    const tailW = tailImg ? tailImg.naturalWidth : 0;
    const midW = Math.max(0, w - headW - tailW);
    if (headImg) ctx.drawImage(headImg, x, y, headW, h);
    if (midImg && midW > 0) ctx.drawImage(midImg, x + headW, y, midW, h);
    if (tailImg) ctx.drawImage(tailImg, x + headW + midW, y, tailW, h);
  } else {
    ctx.fillStyle = '#2a4a8a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3a6aaa'; ctx.fillRect(x, y, w, 3);
  }
  if (el.text) {
    const p = el.padding || {top:8,right:12,bottom:8,left:12};
    const textX = x + (p.left||12);
    const textW = w - (p.left||12) - (p.right||12);
    const textY = y + (p.top||8);
    const textH = h - (p.top||8) - (p.bottom||8);
    ctx.save();
    ctx.clip(new Path2D(`M${x} ${y} L${x+w} ${y} L${x+w} ${y+h} L${x} ${y+h} Z`));
    applyTextStyle(ctx, el);
    ctx.textBaseline = 'middle';
    const mid = textY + textH/2;
    const drawY = mid - (el.fontSize||24)/2;
    const lhT = (el.fontSize||24)*(el.lineHeight||1.4);
    if (el.textEffect) {
      const te = el.textEffect;
      if (te.type === 'shadow') {
        ctx.shadowColor = te.color || 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = te.blur || 4;
        ctx.shadowOffsetX = te.dx || 2;
        ctx.shadowOffsetY = te.dy || 2;
      } else if (te.type === 'gradient') {
        const grad = ctx.createLinearGradient(textX, drawY, textX, drawY + textH);
        grad.addColorStop(0, te.gradColor1 || '#ffcc00');
        grad.addColorStop(1, te.gradColor2 || '#ff4400');
        ctx.fillStyle = grad;
      }
    }
    wrapTextDraw(ctx, el.text, textX, drawY, textW, lhT, el.align||'center', true, el.letterSpacing||0, 0);
    if (el.textEffect && el.textEffect.type === 'stroke') {
      const te = el.textEffect;
      ctx.strokeStyle = te.strokeColor || '#000000';
      ctx.lineWidth = te.strokeWidth || 2;
      ctx.lineJoin = 'round';
      wrapTextDraw_stroke(ctx, el.text, textX, drawY, textW, lhT, el.align||'center', true, el.letterSpacing||0, 0);
    }
    ctx.restore();
  }
}

async function drawTextBox(ctx, el, x, y, w, h) {
  const grp = getAssetGroup(el.assetGroupId);
  if (grp) {
    const headImg = grp.head ? await getCachedImage(grp.head.dataUrl) : null;
    const midImg  = grp.mid  ? await getCachedImage(grp.mid.dataUrl)  : null;
    const tailImg = grp.tail ? await getCachedImage(grp.tail.dataUrl) : null;
    const headH = headImg ? headImg.naturalHeight : 0;
    const tailH = tailImg ? tailImg.naturalHeight : 0;
    const midH = Math.max(0, h - headH - tailH);
    if (headImg) ctx.drawImage(headImg, x, y, w, headH);
    if (midImg && midH > 0) ctx.drawImage(midImg, x, y + headH, w, midH);
    if (tailImg) ctx.drawImage(tailImg, x, y + headH + midH, w, tailH);
  } else {
    ctx.fillStyle = '#1a3050'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#2a5080'; ctx.lineWidth = 1;
    ctx.strokeRect(x+0.5, y+0.5, w-1, h-1);
  }
  if (el.text) {
    const p = el.padding || {top:12,right:14,bottom:12,left:14};
    const tx = x + (p.left||14);
    const ty = y + (p.top||12);
    const tw = w - (p.left||14) - (p.right||14);
    const th = h - (p.top||12) - (p.bottom||12);
    const lhB = (el.fontSize||16)*(el.lineHeight||1.6);
    ctx.save();
    applyTextStyle(ctx, el);
    if (el.textEffect) {
      const te = el.textEffect;
      if (te.type === 'shadow') {
        ctx.shadowColor = te.color || 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = te.blur || 4;
        ctx.shadowOffsetX = te.dx || 2;
        ctx.shadowOffsetY = te.dy || 2;
      } else if (te.type === 'gradient') {
        const grad = ctx.createLinearGradient(tx, ty, tx, ty + th);
        grad.addColorStop(0, te.gradColor1 || '#ffcc00');
        grad.addColorStop(1, te.gradColor2 || '#ff4400');
        ctx.fillStyle = grad;
      }
    }
    wrapTextDraw(ctx, el.text, tx, ty, tw, lhB, el.align||'left', false, el.letterSpacing||0, el.paraSpacing||0);
    if (el.textEffect && el.textEffect.type === 'stroke') {
      const te = el.textEffect;
      ctx.strokeStyle = te.strokeColor || '#000000';
      ctx.lineWidth = te.strokeWidth || 2;
      ctx.lineJoin = 'round';
      wrapTextDraw_stroke(ctx, el.text, tx, ty, tw, lhB, el.align||'left', false, el.letterSpacing||0, el.paraSpacing||0);
    }
    ctx.restore();
  }
}

async function drawImageElement(ctx, el, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  if (el.borderRadius) {
    roundRectPath(ctx, x, y, w, h, el.borderRadius);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.clip();
  if (typeof el.opacity === 'number') ctx.globalAlpha = el.opacity;

  const asset = getSingleAsset(el.assetId);
  if (asset && asset.dataUrl) {
    const img = await getCachedImage(asset.dataUrl);
    if (img) {
      drawImageFit(ctx, img, x, y, w, h, el.fit || 'cover');
    }
  } else {
    ctx.fillStyle = '#1a2a3a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3a5a7a'; ctx.font = '14px Microsoft YaHei';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('图片', x+w/2, y+h/2);
  }
  ctx.restore();
}

function drawImageFit(ctx, img, x, y, w, h, fit) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (fit === 'fill') {
    ctx.drawImage(img, x, y, w, h);
  } else if (fit === 'none') {
    ctx.drawImage(img, x, y, iw, ih);
  } else if (fit === 'contain') {
    const scale = Math.min(w/iw, h/ih);
    const sw = iw*scale, sh = ih*scale;
    ctx.drawImage(img, x+(w-sw)/2, y+(h-sh)/2, sw, sh);
  } else { // cover
    const scale = Math.max(w/iw, h/ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, x - (dw-w)/2, y - (dh-h)/2, dw, dh);
  }
}

function drawTextElement(ctx, el, x, y, w, h) {
  ctx.save();
  applyTextStyle(ctx, el);
  if (el.textEffect) {
    const te = el.textEffect;
    if (te.type === 'shadow') {
      ctx.shadowColor = te.color || 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = te.blur || 4;
      ctx.shadowOffsetX = te.dx || 2;
      ctx.shadowOffsetY = te.dy || 2;
    } else if (te.type === 'gradient') {
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, te.gradColor1 || '#ffcc00');
      grad.addColorStop(1, te.gradColor2 || '#ff4400');
      ctx.fillStyle = grad;
    }
  }
  const lh = (el.fontSize||16) * (el.lineHeight||1.5);
  wrapTextDraw(ctx, el.text||'', x, y, w, lh, el.align||'left', false, el.letterSpacing||0, el.paraSpacing||0);
  if (el.textEffect && el.textEffect.type === 'stroke') {
    const te = el.textEffect;
    ctx.strokeStyle = te.strokeColor || '#000000';
    ctx.lineWidth = te.strokeWidth || 2;
    ctx.lineJoin = 'round';
    wrapTextDraw_stroke(ctx, el.text||'', x, y, w, lh, el.align||'left', false, el.letterSpacing||0, el.paraSpacing||0);
  }
  ctx.restore();
}

function applyTextStyle(ctx, el) {
  const fs = el.fontSize || 16;
  const font = el.font || 'Microsoft YaHei';
  const bold = el.bold ? 'bold ' : '';
  const italic = el.italic ? 'italic ' : '';
  ctx.font = `${italic}${bold}${fs}px "${font}"`;
  ctx.fillStyle = el.color || '#ffffff';
  ctx.textBaseline = 'top';
}

function wrapTextDraw_stroke(ctx, text, x, y, maxW, lineH, align, singleLine, letterSpacing, paraSpacing) {
  const ls = letterSpacing || 0;
  const ps = paraSpacing || 0;
  ctx.textBaseline = 'top';
  const lines = (text || '').split('\n');
  let curY = y;

  function measureWithLS(str) {
    if (!ls) return ctx.measureText(str).width;
    let w = 0;
    for (const ch of str) w += ctx.measureText(ch).width + ls;
    return Math.max(0, w - ls);
  }

  function drawWithLS(str, dx, dy) {
    if (!ls) { ctx.strokeText(str, dx, dy); return; }
    let cx = dx;
    for (const ch of str) {
      ctx.strokeText(ch, cx, dy);
      cx += ctx.measureText(ch).width + ls;
    }
  }

  function getLineStartX(lineWidth) {
    const a = align || 'left';
    if (a === 'center') return x + (maxW - lineWidth) / 2;
    if (a === 'right') return x + maxW - lineWidth;
    return x;
  }

  for (const paragraph of lines) {
    if (singleLine) {
      const lw = measureWithLS(paragraph);
      ctx.textAlign = 'left';
      drawWithLS(paragraph, getLineStartX(lw), curY);
      curY += lineH;
      break;
    }
    if (paragraph === '') { curY += lineH + ps; continue; }
    const chars = [...paragraph];
    let lineStr = '';
    for (const ch of chars) {
      const testStr = lineStr + ch;
      if (measureWithLS(testStr) > maxW && lineStr.length > 0) {
        ctx.textAlign = 'left';
        drawWithLS(lineStr, getLineStartX(measureWithLS(lineStr)), curY);
        curY += lineH;
        lineStr = ch;
      } else {
        lineStr = testStr;
      }
    }
    if (lineStr) {
      ctx.textAlign = 'left';
      drawWithLS(lineStr, getLineStartX(measureWithLS(lineStr)), curY);
      curY += lineH;
    }
    curY += ps;
  }
}

function wrapTextDraw(ctx, text, x, y, maxW, lineH, align, singleLine, letterSpacing, paraSpacing) {
  const ls = letterSpacing || 0;
  const ps = paraSpacing || 0;
  ctx.textBaseline = 'top';
  const lines = (text || '').split('\n');
  let curY = y;

  function measureWithLS(str) {
    if (!ls) return ctx.measureText(str).width;
    let w = 0;
    for (const ch of str) w += ctx.measureText(ch).width + ls;
    return Math.max(0, w - ls);
  }

  function drawWithLS(str, dx, dy) {
    if (!ls) { ctx.fillText(str, dx, dy); return; }
    let cx = dx;
    for (const ch of str) {
      ctx.fillText(ch, cx, dy);
      cx += ctx.measureText(ch).width + ls;
    }
  }

  function getLineStartX(lineWidth) {
    const a = align || 'left';
    if (a === 'center') return x + (maxW - lineWidth) / 2;
    if (a === 'right') return x + maxW - lineWidth;
    return x;
  }

  for (const paragraph of lines) {
    if (singleLine) {
      const lw = measureWithLS(paragraph);
      ctx.textAlign = 'left';
      drawWithLS(paragraph, getLineStartX(lw), curY);
      curY += lineH;
      break;
    }
    if (paragraph === '') { curY += lineH + ps; continue; }
    const chars = [...paragraph];
    let lineStr = '';
    for (const ch of chars) {
      const testStr = lineStr + ch;
      if (measureWithLS(testStr) > maxW && lineStr.length > 0) {
        ctx.textAlign = 'left';
        drawWithLS(lineStr, getLineStartX(measureWithLS(lineStr)), curY);
        curY += lineH;
        lineStr = ch;
      } else {
        lineStr = testStr;
      }
    }
    if (lineStr) {
      ctx.textAlign = 'left';
      drawWithLS(lineStr, getLineStartX(measureWithLS(lineStr)), curY);
      curY += lineH;
    }
    curY += ps;
  }
  return curY - y;
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}

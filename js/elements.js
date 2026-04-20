// ===== ELEMENT FACTORY FUNCTIONS =====

function makeModule(name, height, elements) {
  return {id:uid(), name, autoHeight:true, fixedHeight:height, marginTop:0, marginBottom:20, elements};
}

function makeBg(cw, h) {
  return {id:uid(), type:'background', x:0, y:0, width:cw, height:h, zIndex:0, visible:true, locked:false,
    bgType:'solid', bgColor:'#1e2a40', bgColor2:'#0a0a18', bgAngle:180, bgAssetGroupId:''};
}

function makeTitleBar(cw, x, y, h) {
  return {id:uid(), type:'title-bar', x, y, width:cw, height:h, zIndex:2, visible:true, locked:false,
    assetGroupId:'', text:'标题文字', font:'Microsoft YaHei', fontSize:28, color:'#ffffff',
    bold:true, italic:false, align:'center', padding:{top:8,right:12,bottom:8,left:12}};
}

function makeTextBox(x, y, w, h) {
  return {id:uid(), type:'text-box', x, y, width:w, height:h, zIndex:2, visible:true, locked:false,
    assetGroupId:'', text:'在这里输入文字内容...\n\n可以多行编辑。', font:'Microsoft YaHei',
    fontSize:16, color:'#dddddd', bold:false, italic:false, align:'left',
    lineHeight:1.8, padding:{top:14,right:16,bottom:14,left:16}};
}

function makeImg(x, y, w, h) {
  return {id:uid(), type:'image', x, y, width:w, height:h, zIndex:2, visible:true, locked:false,
    assetId:'', fit:'cover', opacity:1, borderRadius:4};
}

function makeText(x, y, w, h, text) {
  return {id:uid(), type:'text', x, y, width:w, height:h, zIndex:2, visible:true, locked:false,
    text: text||'文字内容', font:'Microsoft YaHei', fontSize:16, color:'#ffffff',
    bold:false, italic:false, align:'left', lineHeight:1.5, textEffect:null};
}

// ===== LAYOUT TEMPLATES =====
const TEMPLATES = [
  {
    name:'空白模块', desc:'空白画布',
    svg:`<svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="60" fill="#0f2040" rx="3"/><text x="40" y="34" font-size="10" fill="#333" text-anchor="middle">空白</text></svg>`,
    create(cw) {
      return makeModule('空白模块', 200, []);
    }
  },
  {
    name:'纯标题', desc:'标题栏+文字',
    svg:`<svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="60" fill="#0f2040" rx="3"/><rect x="4" y="8" width="72" height="20" fill="#2a4a8a" rx="2"/><rect x="8" y="12" width="50" height="8" fill="#4a8af0" rx="1"/></svg>`,
    create(cw) {
      return makeModule('标题模块', 120, [
        makeBg(cw, 120),
        makeTitleBar(cw, 0, 20, 80),
      ]);
    }
  },
  {
    name:'标题+文字', desc:'标题栏+文本框',
    svg:`<svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="60" fill="#0f2040" rx="3"/><rect x="4" y="4" width="72" height="16" fill="#2a4a8a" rx="2"/><rect x="4" y="24" width="72" height="28" fill="#1a3050" rx="2"/><line x1="8" y1="30" x2="60" y2="30" stroke="#3a5a80" stroke-width="1"/><line x1="8" y1="36" x2="50" y2="36" stroke="#3a5a80" stroke-width="1"/><line x1="8" y1="42" x2="55" y2="42" stroke="#3a5a80" stroke-width="1"/></svg>`,
    create(cw) {
      return makeModule('标题+文字', 300, [
        makeBg(cw, 300),
        makeTitleBar(cw, 0, 20, 80),
        makeTextBox(20, 110, cw - 40, 160),
      ]);
    }
  },
  {
    name:'标题+图片', desc:'标题+2×2图片网格',
    svg:`<svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="60" fill="#0f2040" rx="3"/><rect x="4" y="4" width="72" height="12" fill="#2a4a8a" rx="2"/><rect x="4" y="20" width="34" height="17" fill="#1a3050" rx="2"/><rect x="42" y="20" width="34" height="17" fill="#1a3050" rx="2"/><rect x="4" y="40" width="34" height="17" fill="#1a3050" rx="2"/><rect x="42" y="40" width="34" height="17" fill="#1a3050" rx="2"/></svg>`,
    create(cw) {
      const imgW = Math.floor((cw - 40) / 2);
      const imgH = Math.floor(imgW * 0.7);
      return makeModule('标题+图片', imgH*2 + 140, [
        makeBg(cw, imgH*2 + 140),
        makeTitleBar(cw, 0, 20, 80),
        makeImg(20, 110, imgW, imgH),
        makeImg(20 + imgW + 20, 110, imgW, imgH),
        makeImg(20, 110 + imgH + 20, imgW, imgH),
        makeImg(20 + imgW + 20, 110 + imgH + 20, imgW, imgH),
      ]);
    }
  },
  {
    name:'大图展示', desc:'全幅背景+大图',
    svg:`<svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="60" fill="#0f1830" rx="3"/><rect x="4" y="4" width="72" height="52" fill="#1a3050" rx="2"/><rect x="8" y="8" width="64" height="44" fill="#2a5080" rx="2" opacity="0.7"/></svg>`,
    create(cw) {
      const h = Math.round(cw * 0.6);
      return makeModule('大图展示', h + 40, [
        makeBg(cw, h + 40),
        makeImg(20, 20, cw - 40, h),
      ]);
    }
  },
  {
    name:'综合模块', desc:'背景+标题+文本+图片',
    svg:`<svg viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="60" fill="#0f1830" rx="3"/><rect x="4" y="4" width="72" height="12" fill="#2a4a8a" rx="2"/><rect x="4" y="20" width="30" height="36" fill="#1a3050" rx="2"/><rect x="38" y="20" width="38" height="17" fill="#1a3050" rx="2"/><rect x="38" y="40" width="38" height="16" fill="#1a3050" rx="2"/></svg>`,
    create(cw) {
      const h = 420;
      return makeModule('综合模块', h, [
        makeBg(cw, h),
        makeTitleBar(cw, 0, 20, 80),
        makeTextBox(20, 120, Math.floor(cw * 0.45) - 20, 260),
        makeImg(Math.floor(cw * 0.45) + 10, 120, cw - Math.floor(cw * 0.45) - 30, 120),
        makeImg(Math.floor(cw * 0.45) + 10, 260, cw - Math.floor(cw * 0.45) - 30, 120),
      ]);
    }
  },
];

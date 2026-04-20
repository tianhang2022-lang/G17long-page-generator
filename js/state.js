// ===== 1. CONSTANTS =====
const FONTS = [
  {label:'微软雅黑',value:'Microsoft YaHei'},
  {label:'宋体',value:'SimSun'},
  {label:'黑体',value:'SimHei'},
  {label:'仿宋',value:'FangSong'},
  {label:'楷体',value:'KaiTi'},
  {label:'华文细黑',value:'STXihei'},
  {label:'华文楷体',value:'STKaiti'},
  {label:'华文宋体',value:'STSong'},
  {label:'华文仿宋',value:'STFangsong'},
  {label:'Arial',value:'Arial'},
  {label:'Georgia',value:'Georgia'},
  {label:'Times New Roman',value:'Times New Roman'},
  {label:'Courier New',value:'Courier New'},
];

const ASSET_CATS = [
  {key:'backgrounds',label:'背景图',three:true},
  {key:'titleBars',label:'标题栏',three:true},
  {key:'textBoxes',label:'文本框',three:true},
  {key:'images',label:'图片素材',three:false},
  {key:'others',label:'其他',three:false},
];

// ===== 2. APP STATE =====
const appState = {
  version: 4,
  view: 'page',   // 'page' | 'block' | 'content' | 'assets'
  mode: 'design', // 'design' | 'content' — kept for compatibility
  zoom: 1.0,
  canvas: {width:750, bgColor:'#1a1a2e'},
  pageBg: { type: 'color', color: '#0a0a18' },
  assets: {backgrounds:[], titleBars:[], textBoxes:[], images:[], others:[]},
  modules: [],
  selectedModuleId: null,
  selectedElementId: null,
  sliceLines: [],
  showGuides: true,
  sliceMode: false,
  projectId: null,
  projectName: '未命名项目',
  pageMargin: {},
  bgColor: '#0a0a18',
};

// ===== HISTORY (UNDO/REDO) =====
const history = {
  stack: [],    // Array of snapshots (JSON strings of modules)
  cursor: -1,   // Current position in stack
  maxSize: 50,  // Max history steps
  isPaused: false, // Prevent recording during undo/redo operations
};

// ===== Canvas globals (assigned in main.js init) =====
let mainCanvas = null;
let ctx = null;
let overlayCanvas = null;
let octx = null;
let moduleYMap = {};

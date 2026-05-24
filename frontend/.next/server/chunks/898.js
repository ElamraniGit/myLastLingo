"use strict";
exports.id = 898;
exports.ids = [898];
exports.modules = {

/***/ 898:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "q": () => (/* binding */ useAppStore)
/* harmony export */ });
/* harmony import */ var zustand__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(912);
/* harmony import */ var zustand_middleware__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(602);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([zustand__WEBPACK_IMPORTED_MODULE_0__, zustand_middleware__WEBPACK_IMPORTED_MODULE_1__]);
([zustand__WEBPACK_IMPORTED_MODULE_0__, zustand_middleware__WEBPACK_IMPORTED_MODULE_1__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * Global state management using Zustand.
 */


const initialPlayerState = {
  video_id: '',
  position: 0,
  playing: false,
  speed: 1.0,
  volume: 1.0,
  current_segment: 0,
  loop_enabled: false
};
const useAppStore = (0,zustand__WEBPACK_IMPORTED_MODULE_0__.create)()((0,zustand_middleware__WEBPACK_IMPORTED_MODULE_1__.persist)((set, get) => ({
  // Navigation
  currentPage: 'player',
  setCurrentPage: page => set({
    currentPage: page
  }),
  // Theme
  theme: 'dark',
  toggleTheme: () => set(state => ({
    theme: state.theme === 'dark' ? 'light' : 'dark'
  })),
  // Video & Player
  currentVideo: null,
  setCurrentVideo: video => set({
    currentVideo: video
  }),
  playerState: initialPlayerState,
  updatePlayerState: state => set(prev => ({
    playerState: _objectSpread(_objectSpread({}, prev.playerState), state)
  })),
  transcript: null,
  setTranscript: transcript => set({
    transcript
  }),
  // Current word lookup
  selectedWord: null,
  setSelectedWord: word => set({
    selectedWord: word
  }),
  wordModalOpen: false,
  setWordModalOpen: open => set({
    wordModalOpen: open
  }),
  // Video list
  videos: [],
  setVideos: videos => set({
    videos
  }),
  addVideo: video => set(state => ({
    videos: [video, ...state.videos.filter(v => v.id !== video.id)]
  })),
  // Vocabulary
  savedWords: [],
  setSavedWords: words => set({
    savedWords: words
  }),
  addSavedWord: word => set(state => ({
    savedWords: [word, ...state.savedWords]
  })),
  dueWords: [],
  setDueWords: words => set({
    dueWords: words
  }),
  // Progress
  progress: null,
  setProgress: progress => set({
    progress
  }),
  // UI state
  sidebarOpen: false,
  setSidebarOpen: open => set({
    sidebarOpen: open
  }),
  playerFloating: false,
  setPlayerFloating: floating => set({
    playerFloating: floating
  }),
  loading: false,
  setLoading: loading => set({
    loading
  }),
  error: null,
  setError: error => set({
    error
  }),
  // Actions
  clearError: () => set({
    error: null
  }),
  resetPlayer: () => set({
    currentVideo: null,
    playerState: initialPlayerState,
    transcript: null
  })
}), {
  name: 'lingualearn-storage',
  partialize: state => ({
    theme: state.theme,
    savedWords: state.savedWords,
    progress: state.progress,
    videos: state.videos
  })
}));
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ })

};
;
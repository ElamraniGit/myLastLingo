"use strict";
exports.id = 255;
exports.ids = [255];
exports.modules = {

/***/ 255:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "g": () => (/* binding */ useDictionary)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _store_appStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(898);
/* harmony import */ var _services_api__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(714);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_store_appStore__WEBPACK_IMPORTED_MODULE_1__]);
_store_appStore__WEBPACK_IMPORTED_MODULE_1__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];
/**
 * Hook for dictionary lookups and vocabulary management.
 */



function useDictionary() {
  const {
    selectedWord,
    setSelectedWord,
    wordModalOpen,
    setWordModalOpen,
    setLoading,
    setError,
    savedWords,
    addSavedWord,
    dueWords,
    setDueWords,
    progress,
    setProgress
  } = (0,_store_appStore__WEBPACK_IMPORTED_MODULE_1__/* .useAppStore */ .q)();
  const {
    0: searchResults,
    1: setSearchResults
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const {
    0: suggestions,
    1: setSuggestions
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]); // Look up a word

  const lookupWord = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async word => {
    setLoading(true);

    try {
      const data = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].dictionary.lookup */ .Z.dictionary.lookup(word);
      setSelectedWord(data);
      setWordModalOpen(true);
      return data;
    } catch (err) {
      setError(err.message || 'Word lookup failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setSelectedWord, setWordModalOpen, setLoading, setError]); // Search dictionary

  const searchDictionary = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async query => {
    try {
      const data = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].dictionary.search */ .Z.dictionary.search(query);
      setSearchResults(data.results || []);
      return data;
    } catch {
      setSearchResults([]);
      return null;
    }
  }, []); // Get suggestions

  const getSuggestions = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async prefix => {
    if (prefix.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const data = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].dictionary.suggest */ .Z.dictionary.suggest(prefix);
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    }
  }, []); // Save word to vocabulary

  const saveWord = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (word, videoId, sentence, context) => {
    try {
      const data = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].vocabulary.save */ .Z.vocabulary.save(word, videoId, sentence, context); // Refresh saved words

      const wordsData = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].vocabulary.list */ .Z.vocabulary.list();

      if (wordsData?.words) {
        _store_appStore__WEBPACK_IMPORTED_MODULE_1__/* .useAppStore.getState */ .q.getState().setSavedWords(wordsData.words);
      }

      return data;
    } catch (err) {
      setError(err.message || 'Failed to save word');
      return null;
    }
  }, [setError]); // Review a word

  const reviewWord = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (savedWordId, quality) => {
    try {
      await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].vocabulary.review */ .Z.vocabulary.review(savedWordId, quality); // Refresh due words

      const dueData = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].vocabulary.due */ .Z.vocabulary.due();

      if (dueData?.words) {
        setDueWords(dueData.words);
      } // Refresh stats


      const statsData = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].vocabulary.stats */ .Z.vocabulary.stats();

      if (statsData) {
        setProgress(statsData);
      }
    } catch (err) {
      setError(err.message || 'Failed to record review');
    }
  }, [setDueWords, setProgress, setError]); // Load due words

  const loadDueWords = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    try {
      const data = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].vocabulary.due */ .Z.vocabulary.due();

      if (data?.words) {
        setDueWords(data.words);
      }
    } catch {// Silent fail
    }
  }, [setDueWords]); // Load vocabulary list

  const loadVocabulary = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async (status, page = 1) => {
    try {
      const data = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].vocabulary.list */ .Z.vocabulary.list(status, page);

      if (data?.words) {
        _store_appStore__WEBPACK_IMPORTED_MODULE_1__/* .useAppStore.getState */ .q.getState().setSavedWords(data.words);
      }

      return data;
    } catch {
      return null;
    }
  }, []); // Load stats

  const loadStats = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    try {
      const data = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].vocabulary.stats */ .Z.vocabulary.stats();

      if (data) {
        setProgress(data);
      }

      return data;
    } catch {
      return null;
    }
  }, [setProgress]); // Close word modal

  const closeWordModal = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    setWordModalOpen(false);
    setSelectedWord(null);
  }, [setWordModalOpen, setSelectedWord]);
  return {
    // State
    selectedWord,
    wordModalOpen,
    searchResults,
    suggestions,
    savedWords,
    dueWords,
    progress,
    // Actions
    lookupWord,
    searchDictionary,
    getSuggestions,
    saveWord,
    reviewWord,
    loadDueWords,
    loadVocabulary,
    loadStats,
    closeWordModal
  };
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ }),

/***/ 714:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Z": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* unused harmony export api */
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * API service for LinguaLearn.
 * Communicates with local backend at 127.0.0.1:8080
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8080/api/v1';

class ApiError extends Error {
  constructor(message, status) {
    super(message);

    _defineProperty(this, "status", void 0);

    this.status = status;
    this.name = 'ApiError';
  }

}

async function request(endpoint, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    timeout = 30000
  } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: _objectSpread({
        'Content-Type': 'application/json'
      }, headers),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(errorData.detail || errorData.message || `HTTP ${response.status}`, response.status);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408);
    }

    throw new ApiError('Network error - is the backend running?', 0);
  }
} // API methods


const api = {
  // Health
  health: () => request('/health'),
  // Videos
  videos: {
    process: (url, quality) => request('/videos/process', {
      method: 'POST',
      body: {
        url,
        quality
      }
    }),
    list: (page = 1, limit = 20) => request(`/videos/list?page=${page}&limit=${limit}`),
    get: id => request(`/videos/${id}`),
    delete: id => request(`/videos/${id}`, {
      method: 'DELETE'
    })
  },
  // Transcripts
  transcripts: {
    extract: (videoId, language = 'en') => request(`/transcripts/extract/${videoId}?language=${language}`, {
      method: 'POST'
    }),
    get: (videoId, language = 'en') => request(`/transcripts/${videoId}?language=${language}`),
    getSegments: (videoId, language = 'en') => request(`/transcripts/${videoId}/segments?language=${language}`)
  },
  // Dictionary
  dictionary: {
    lookup: word => request('/dictionary/lookup', {
      method: 'POST',
      body: {
        word
      }
    }),
    search: (query, limit = 10) => request(`/dictionary/search?query=${encodeURIComponent(query)}&limit=${limit}`),
    suggest: (prefix, limit = 10) => request(`/dictionary/suggest?prefix=${encodeURIComponent(prefix)}&limit=${limit}`),
    popular: (limit = 50) => request(`/dictionary/popular?limit=${limit}`),
    level: word => request(`/dictionary/level/${encodeURIComponent(word)}`)
  },
  // Vocabulary
  vocabulary: {
    save: (word, videoId, sentence, context) => request('/vocabulary/save', {
      method: 'POST',
      body: {
        word,
        video_id: videoId,
        sentence,
        context
      }
    }),
    list: (status, page = 1, limit = 20) => {
      let url = `/vocabulary/list?page=${page}&limit=${limit}`;
      if (status) url += `&status=${status}`;
      return request(url);
    },
    review: (savedWordId, quality) => request('/vocabulary/review', {
      method: 'POST',
      body: {
        saved_word_id: savedWordId,
        quality
      }
    }),
    due: (limit = 20) => request(`/vocabulary/due?limit=${limit}`),
    stats: () => request('/vocabulary/stats'),
    delete: savedId => request(`/vocabulary/${savedId}`, {
      method: 'DELETE'
    })
  },
  // Player
  player: {
    updateState: state => request('/player/state', {
      method: 'POST',
      body: state
    }),
    getState: videoId => request(`/player/state/${videoId}`),
    stream: videoId => request(`/player/stream/${videoId}`)
  }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (api);

/***/ })

};
;
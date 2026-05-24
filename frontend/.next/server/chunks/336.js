"use strict";
exports.id = 336;
exports.ids = [336];
exports.modules = {

/***/ 336:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ VocabularyPage)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(197);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(111);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(255);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_3__]);
([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_3__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
/**
 * Vocabulary management page - saved words with filtering and stats.
 */






const levelColors = {
  A1: 'badge-level-A1',
  A2: 'badge-level-A2',
  B1: 'badge-level-B1',
  B2: 'badge-level-B2',
  C1: 'badge-level-C1',
  C2: 'badge-level-C2'
};
function VocabularyPage() {
  const {
    progress,
    loadStats
  } = (0,_hooks_useDictionary__WEBPACK_IMPORTED_MODULE_3__/* .useDictionary */ .g)();
  const {
    0: words,
    1: setWords
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const {
    0: filter,
    1: setFilter
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('all');
  const {
    0: search,
    1: setSearch
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('');
  const {
    0: loading,
    1: setLoading
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(true);
  const fetchWords = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    setLoading(true);

    try {
      const data = await (0,_hooks_useDictionary__WEBPACK_IMPORTED_MODULE_3__/* .useDictionary */ .g)().loadVocabulary(filter === 'all' ? undefined : filter);
      if (data?.words) setWords(data.words);
    } finally {
      setLoading(false);
    }
  }, [filter]);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    fetchWords();
    loadStats();
  }, [fetchWords, loadStats]);

  const speak = text => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      speechSynthesis.speak(utterance);
    }
  };

  const filtered = words.filter(w => w.word.toLowerCase().includes(search.toLowerCase()));
  const tabs = [{
    id: 'all',
    label: 'الكل'
  }, {
    id: 'learning',
    label: 'قيد التعلم'
  }, {
    id: 'learned',
    label: 'متعلم'
  }];
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "max-w-4xl mx-auto px-4 py-6 space-y-6",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("h1", {
          className: "text-2xl font-bold text-surface-100",
          children: "\u0645\u0641\u0631\u062F\u0627\u062A\u064A"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("p", {
          className: "text-surface-400 text-sm mt-1",
          children: [progress?.total_saved_words || 0, " \u0643\u0644\u0645\u0629 \u0645\u062D\u0641\u0648\u0638\u0629"]
        })]
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
        className: "flex items-center gap-3",
        children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
          className: "flex -space-x-2",
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
            className: "w-8 h-8 rounded-full bg-primary-500/20 border-2 border-surface-800 flex items-center justify-center",
            children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
              className: "text-xs text-primary-400 font-bold",
              children: progress?.learned_words || 0
            })
          })
        })
      })]
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
      className: "grid grid-cols-3 gap-3",
      children: [{
        label: 'المجموع',
        value: progress?.total_saved_words || 0,
        color: 'text-primary-400'
      }, {
        label: 'المتعلمة',
        value: progress?.learned_words || 0,
        color: 'text-green-400'
      }, {
        label: 'للمراجعة',
        value: progress?.due_reviews || 0,
        color: 'text-yellow-400'
      }].map((stat, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "glass rounded-xl p-4 text-center",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
          className: `text-2xl font-bold ${stat.color}`,
          children: stat.value
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
          className: "text-xs text-surface-400 mt-1",
          children: stat.label
        })]
      }, i))
    }), progress?.level_distribution && Object.keys(progress.level_distribution).length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "glass rounded-xl p-4",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("h3", {
        className: "text-sm font-medium text-surface-400 mb-3",
        children: "\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0645\u0633\u062A\u0648\u064A\u0627\u062A"
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
        className: "flex gap-2",
        children: Object.entries(progress.level_distribution).map(([level, count]) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          className: "flex-1",
          children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
            className: "h-2 bg-surface-700 rounded-full overflow-hidden",
            children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
              className: `h-full rounded-full ${level === 'A1' ? 'bg-green-500' : level === 'A2' ? 'bg-emerald-500' : level === 'B1' ? 'bg-blue-500' : level === 'B2' ? 'bg-violet-500' : level === 'C1' ? 'bg-orange-500' : 'bg-red-500'}`,
              initial: {
                width: 0
              },
              animate: {
                width: `${count / Math.max(...Object.values(progress.level_distribution)) * 100}%`
              }
            })
          }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
            className: "text-xs text-surface-400 text-center mt-1",
            children: level
          })]
        }, level))
      })]
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
      className: "flex items-center gap-3",
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex-1 relative",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiSearch, {
          className: "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400"
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("input", {
          type: "text",
          value: search,
          onChange: e => setSearch(e.target.value),
          placeholder: "\u0627\u0628\u062D\u062B \u0641\u064A \u0627\u0644\u0645\u0641\u0631\u062F\u0627\u062A...",
          className: "input pr-10",
          dir: "rtl"
        })]
      })
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
      className: "flex gap-2",
      children: tabs.map(tab => /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("button", {
        onClick: () => setFilter(tab.id),
        className: `px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === tab.id ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-700/30'}`,
        children: tab.label
      }, tab.id))
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "space-y-2",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.AnimatePresence, {
        children: filtered.map((word, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
          initial: {
            opacity: 0,
            y: 10
          },
          animate: {
            opacity: 1,
            y: 0
          },
          exit: {
            opacity: 0,
            x: -20
          },
          transition: {
            delay: i * 0.03
          },
          className: "glass rounded-xl p-4 flex items-center justify-between hover:bg-surface-700/40 transition-all duration-200 group",
          children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
            className: "flex items-center gap-4",
            children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
                className: "flex items-center gap-2",
                children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
                  className: "text-lg font-semibold text-surface-100",
                  children: word.word
                }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
                  className: `badge ${levelColors[word.level]}`,
                  children: word.level
                }), word.part_of_speech && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
                  className: "badge-primary text-xs",
                  children: word.part_of_speech
                })]
              }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
                className: "text-sm text-surface-400 mt-1",
                dir: "rtl",
                children: word.meaning_ar
              }), word.sentence && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
                className: "text-xs text-surface-500 mt-1 line-clamp-1",
                children: word.sentence
              })]
            })
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
            className: "flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity",
            children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("button", {
              onClick: () => speak(word.word),
              className: "btn-icon btn-ghost text-primary-400",
              children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiVolumeUp, {
                className: "w-4 h-4"
              })
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
              className: "flex items-center gap-1",
              children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiStar, {
                className: `w-4 h-4 ${word.status === 'learned' ? 'text-yellow-400' : 'text-surface-600'}`
              }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
                className: "text-xs text-surface-500",
                children: word.repetitions
              })]
            })]
          })]
        }, word.id))
      }), !loading && filtered.length === 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "text-center py-12 text-surface-400",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiBookOpen, {
          className: "w-12 h-12 mx-auto mb-3 text-surface-600"
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
          children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0643\u0644\u0645\u0627\u062A \u0647\u0646\u0627"
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
          className: "text-sm mt-1",
          children: "\u062A\u0639\u0644\u0645 \u0643\u0644\u0645\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0645\u0646 \u0627\u0644\u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A"
        })]
      })]
    })]
  });
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ })

};
;
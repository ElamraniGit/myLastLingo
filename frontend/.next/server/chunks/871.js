"use strict";
exports.id = 871;
exports.ids = [871];
exports.modules = {

/***/ 860:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Z": () => (/* binding */ DictionaryModal)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(197);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(111);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _store_appStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(898);
/* harmony import */ var _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(255);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_3__, _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_4__]);
([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_3__, _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_4__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
/**
 * Word dictionary modal with definitions, translations, and save functionality.
 * Bottom sheet style optimized for mobile.
 */








const levelColors = {
  A1: 'badge-level-A1',
  A2: 'badge-level-A2',
  B1: 'badge-level-B1',
  B2: 'badge-level-B2',
  C1: 'badge-level-C1',
  C2: 'badge-level-C2'
};
const posColors = {
  noun: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  verb: 'bg-green-500/10 text-green-400 border-green-500/20',
  adjective: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  adverb: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  preposition: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  pronoun: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  conjunction: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  interjection: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  article: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
};
function DictionaryModal() {
  const {
    wordModalOpen,
    selectedWord,
    currentVideo
  } = (0,_store_appStore__WEBPACK_IMPORTED_MODULE_3__/* .useAppStore */ .q)();
  const {
    closeWordModal,
    saveWord
  } = (0,_hooks_useDictionary__WEBPACK_IMPORTED_MODULE_4__/* .useDictionary */ .g)();
  const {
    0: saving,
    1: setSaving
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const {
    0: saved,
    1: setSaved
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const handleSave = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    if (!selectedWord) return;
    setSaving(true);

    try {
      await saveWord(selectedWord.word, currentVideo?.id, '', // sentence will be added from context
      `Learned from video: ${currentVideo?.title || 'unknown'}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [selectedWord, currentVideo, saveWord]);
  const speak = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(text => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }, []);
  if (!selectedWord) return null;
  return /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.AnimatePresence, {
    children: wordModalOpen && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
        initial: {
          opacity: 0
        },
        animate: {
          opacity: 1
        },
        exit: {
          opacity: 0
        },
        className: "bottom-sheet-overlay",
        onClick: closeWordModal
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
        initial: {
          y: '100%'
        },
        animate: {
          y: 0
        },
        exit: {
          y: '100%'
        },
        transition: {
          type: 'spring',
          damping: 25,
          stiffness: 200
        },
        className: "bottom-sheet",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
          className: "flex justify-center pt-2 pb-1",
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
            className: "w-10 h-1 rounded-full bg-surface-600"
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
          className: "px-6 pb-8 space-y-6",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
            className: "flex items-start justify-between",
            children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
              className: "flex items-center gap-3",
              children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
                children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
                  className: "flex items-center gap-2",
                  children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("h2", {
                    className: "text-2xl font-bold text-surface-100",
                    children: selectedWord.word
                  }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("button", {
                    onClick: () => speak(selectedWord.word),
                    className: "btn-icon btn-ghost text-primary-400",
                    children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiVolumeUp, {
                      className: "w-5 h-5"
                    })
                  })]
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
                  className: "flex items-center gap-2 mt-1",
                  children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                    className: `badge ${posColors[selectedWord.part_of_speech] || 'badge-primary'}`,
                    children: selectedWord.part_of_speech === 'unknown' ? 'كلمة' : selectedWord.part_of_speech
                  }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                    className: `badge ${levelColors[selectedWord.level] || 'badge-primary'}`,
                    children: selectedWord.level
                  }), selectedWord.pronunciation && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                    className: "text-sm text-surface-400 font-mono",
                    children: selectedWord.pronunciation
                  })]
                })]
              })
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("button", {
              onClick: closeWordModal,
              className: "btn-icon btn-ghost",
              children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiX, {
                className: "w-5 h-5"
              })
            })]
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
            className: "space-y-4",
            children: [selectedWord.meaning_ar && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
              className: "glass rounded-xl p-4",
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
                className: "flex items-center gap-2 text-surface-400 text-xs mb-2",
                children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiTranslate, {
                  className: "w-4 h-4"
                }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                  children: "\u0627\u0644\u062A\u0631\u062C\u0645\u0629 \u0644\u0644\u0639\u0631\u0628\u064A\u0629"
                })]
              }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("p", {
                className: "text-xl font-semibold text-surface-100",
                dir: "rtl",
                children: selectedWord.meaning_ar
              })]
            }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
              className: "glass rounded-xl p-4",
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
                className: "flex items-center gap-2 text-surface-400 text-xs mb-2",
                children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiInformationCircle, {
                  className: "w-4 h-4"
                }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                  children: "\u0627\u0644\u0645\u0639\u0646\u0649 \u0628\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629"
                })]
              }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("p", {
                className: "text-base text-surface-200 leading-relaxed",
                children: selectedWord.meaning_en
              })]
            })]
          }), selectedWord.examples && selectedWord.examples.length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
            children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("h3", {
              className: "text-sm font-medium text-surface-400 mb-3",
              children: "\u0623\u0645\u062B\u0644\u0629"
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
              className: "space-y-2",
              children: selectedWord.examples.map((ex, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
                className: "p-3 bg-surface-700/30 rounded-xl text-surface-300 text-sm leading-relaxed border border-surface-700/20",
                children: [ex, /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("button", {
                  onClick: () => speak(ex),
                  className: "btn-icon btn-ghost text-surface-500 float-left",
                  children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiVolumeUp, {
                    className: "w-3 h-3"
                  })
                })]
              }, i))
            })]
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
            className: "grid grid-cols-2 gap-4",
            children: [selectedWord.synonyms && selectedWord.synonyms.length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
              children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("h3", {
                className: "text-sm font-medium text-surface-400 mb-2",
                children: "\u0645\u0631\u0627\u062F\u0641\u0627\u062A"
              }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
                className: "flex flex-wrap gap-1.5",
                children: selectedWord.synonyms.map((syn, i) => /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                  className: "badge bg-green-500/10 text-green-400 border-green-500/20",
                  children: syn
                }, i))
              })]
            }), selectedWord.antonyms && selectedWord.antonyms.length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
              children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("h3", {
                className: "text-sm font-medium text-surface-400 mb-2",
                children: "\u0623\u0636\u062F\u0627\u062F"
              }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
                className: "flex flex-wrap gap-1.5",
                children: selectedWord.antonyms.map((ant, i) => /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                  className: "badge bg-red-500/10 text-red-400 border-red-500/20",
                  children: ant
                }, i))
              })]
            })]
          }), selectedWord.conjugations && Object.keys(selectedWord.conjugations).length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
            children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("h3", {
              className: "text-sm font-medium text-surface-400 mb-2",
              children: "\u0627\u0644\u062A\u0635\u0631\u064A\u0641\u0627\u062A"
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
              className: "grid grid-cols-2 gap-2",
              children: Object.entries(selectedWord.conjugations).map(([key, val]) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
                className: "flex items-center justify-between p-2 bg-surface-700/20 rounded-lg",
                children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                  className: "text-xs text-surface-500",
                  children: key
                }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                  className: "text-sm text-surface-200",
                  children: val
                })]
              }, key))
            })]
          }), selectedWord.related_words && selectedWord.related_words.length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
            children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("h3", {
              className: "text-sm font-medium text-surface-400 mb-2",
              children: "\u0643\u0644\u0645\u0627\u062A \u0645\u0634\u0627\u0628\u0647\u0629"
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
              className: "flex flex-wrap gap-1.5",
              children: selectedWord.related_words.slice(0, 8).map((rw, i) => /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                className: "badge bg-primary-500/10 text-primary-400 border-primary-500/20",
                children: rw
              }, i))
            })]
          }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("button", {
            onClick: handleSave,
            disabled: saving || saved,
            className: `w-full btn ${saved ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'btn-primary'} gap-2 py-3`,
            children: saved ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
              children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiCheck, {
                className: "w-5 h-5"
              }), "\u062A\u0645 \u0627\u0644\u062D\u0641\u0638!"]
            }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.Fragment, {
              children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiBookmarkAlt, {
                className: "w-5 h-5"
              }), saving ? 'جاري الحفظ...' : 'حفظ الكلمة للمراجعة']
            })
          })]
        })]
      })]
    })
  });
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ }),

/***/ 518:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Z": () => (/* binding */ VideoInput)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(197);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(111);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _store_appStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(898);
/* harmony import */ var _services_api__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(714);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_3__]);
([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_3__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
/**
 * YouTube URL input component with validation and processing.
 */







function VideoInput() {
  const {
    0: url,
    1: setUrl
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('');
  const {
    0: status,
    1: setStatus
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('idle');
  const {
    0: error,
    1: setError
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)('');
  const {
    0: recentVideos,
    1: setRecentVideos
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)([]);
  const {
    setCurrentVideo,
    setCurrentPage,
    addVideo
  } = (0,_store_appStore__WEBPACK_IMPORTED_MODULE_3__/* .useAppStore */ .q)(); // Load recent videos

  react__WEBPACK_IMPORTED_MODULE_0___default().useEffect(() => {
    _services_api__WEBPACK_IMPORTED_MODULE_4__/* ["default"].videos.list */ .Z.videos.list(1, 5).then(data => {
      if (data?.videos) setRecentVideos(data.videos);
    }).catch(() => {});
  }, []);

  const validateYouTubeUrl = url => {
    const patterns = [/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/, /^[a-zA-Z0-9_-]{11}$/];
    return patterns.some(p => p.test(url.trim()));
  };

  const handleSubmit = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async () => {
    if (!url.trim()) return;

    if (!validateYouTubeUrl(url)) {
      setStatus('error');
      setError('رابط YouTube غير صالح. الرجاء إدخال رابط صحيح.');
      return;
    }

    setStatus('validating');
    setError('');

    try {
      const video = await _services_api__WEBPACK_IMPORTED_MODULE_4__/* ["default"].videos.process */ .Z.videos.process(url.trim());

      if (video) {
        setStatus('ready');
        addVideo(video);
        setCurrentVideo(video); // Navigate to player after brief delay

        setTimeout(() => {
          setCurrentPage('player');
        }, 500);
      }
    } catch (err) {
      setStatus('error');
      setError(err.message || 'فشل في معالجة الفيديو. تحقق من الاتصال بالخادم المحلي.');
    }
  }, [url, addVideo, setCurrentVideo, setCurrentPage]);

  const handleKeyDown = e => {
    if (e.key === 'Enter') handleSubmit();
  };

  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
    className: "w-full max-w-3xl mx-auto px-4 py-8",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
      className: "text-center mb-8",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.h1, {
        initial: {
          opacity: 0,
          y: -20
        },
        animate: {
          opacity: 1,
          y: 0
        },
        className: "text-3xl md:text-4xl font-bold gradient-text mb-3",
        children: "\u0627\u0628\u062F\u0623 \u0631\u062D\u0644\u0629 \u062A\u0639\u0644\u0645 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629"
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.p, {
        initial: {
          opacity: 0
        },
        animate: {
          opacity: 1
        },
        transition: {
          delay: 0.1
        },
        className: "text-surface-400 text-lg",
        children: "\u0627\u0644\u0635\u0642 \u0631\u0627\u0628\u0637 \u0641\u064A\u062F\u064A\u0648 YouTube \u0644\u0628\u062F\u0621 \u0627\u0644\u062A\u0639\u0644\u0645 \u0628\u0627\u0644\u062A\u0631\u062C\u0645\u0629 \u0648\u0627\u0644\u0643\u0644\u0645\u0627\u062A \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A\u0629"
      })]
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
      initial: {
        opacity: 0,
        y: 20
      },
      animate: {
        opacity: 1,
        y: 0
      },
      transition: {
        delay: 0.2
      },
      className: "glass rounded-2xl p-1",
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
        className: "flex items-center gap-2 bg-surface-800/50 rounded-xl",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
          className: "flex items-center gap-2 px-4",
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiLink, {
            className: "w-5 h-5 text-surface-400"
          })
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("input", {
          type: "text",
          value: url,
          onChange: e => {
            setUrl(e.target.value);
            if (status === 'error') setStatus('idle');
          },
          onKeyDown: handleKeyDown,
          placeholder: "\u0627\u0644\u0635\u0642 \u0631\u0627\u0628\u0637 YouTube \u0647\u0646\u0627...",
          className: "flex-1 bg-transparent py-4 text-surface-100 placeholder-surface-500 focus:outline-none text-lg",
          dir: "ltr",
          disabled: status === 'processing'
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
          className: "px-2",
          children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.AnimatePresence, {
            mode: "wait",
            children: [status === 'idle' && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.button, {
              initial: {
                opacity: 0,
                scale: 0.9
              },
              animate: {
                opacity: 1,
                scale: 1
              },
              exit: {
                opacity: 0,
                scale: 0.9
              },
              onClick: handleSubmit,
              disabled: !url.trim(),
              className: "btn-primary px-6",
              children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                children: "\u0628\u062F\u0621"
              }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiArrowRight, {
                className: "w-4 h-4"
              })]
            }, "submit"), status === 'validating' && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
              initial: {
                opacity: 0
              },
              animate: {
                opacity: 1
              },
              exit: {
                opacity: 0
              },
              className: "flex items-center gap-2 px-6 py-2.5 bg-primary-500/20 text-primary-400 rounded-xl",
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("svg", {
                className: "animate-spin w-5 h-5",
                viewBox: "0 0 24 24",
                children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("circle", {
                  className: "opacity-25",
                  cx: "12",
                  cy: "12",
                  r: "10",
                  stroke: "currentColor",
                  strokeWidth: "4",
                  fill: "none"
                }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("path", {
                  className: "opacity-75",
                  fill: "currentColor",
                  d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                })]
              }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                children: "\u062C\u0627\u0631\u064A \u0627\u0644\u0645\u0639\u0627\u0644\u062C\u0629..."
              })]
            }, "loading"), status === 'ready' && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
              initial: {
                opacity: 0,
                scale: 0.9
              },
              animate: {
                opacity: 1,
                scale: 1
              },
              exit: {
                opacity: 0
              },
              className: "flex items-center gap-2 px-6 py-2.5 bg-green-500/20 text-green-400 rounded-xl",
              children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiCheck, {
                className: "w-5 h-5"
              }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                children: "\u062A\u0645!"
              })]
            }, "ready")]
          })
        })]
      })
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.AnimatePresence, {
      children: status === 'error' && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
        initial: {
          opacity: 0,
          y: -10
        },
        animate: {
          opacity: 1,
          y: 0
        },
        exit: {
          opacity: 0,
          y: -10
        },
        className: "mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiExclamation, {
          className: "w-5 h-5 text-red-400 flex-shrink-0"
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
          className: "text-red-300 text-sm",
          children: error
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("button", {
          onClick: () => setStatus('idle'),
          className: "mr-auto btn-icon btn-ghost text-red-400",
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiX, {
            className: "w-4 h-4"
          })
        })]
      })
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
      initial: {
        opacity: 0
      },
      animate: {
        opacity: 1
      },
      transition: {
        delay: 0.4
      },
      className: "mt-8 grid grid-cols-1 md:grid-cols-3 gap-4",
      children: [{
        icon: '🎯',
        title: 'ترجمة ذكية',
        desc: 'ترجمة لحظية مع تظليل الكلمات'
      }, {
        icon: '📚',
        title: 'قاموس مدمج',
        desc: 'معاني، أمثلة، ومستوى الكلمة'
      }, {
        icon: '🔄',
        title: 'تكرار ذكي',
        desc: 'نظام SRS لحفظ الكلمات'
      }].map((tip, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
        className: "glass rounded-xl p-4 text-center hover:bg-surface-700/40 transition-all duration-300",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
          className: "text-2xl mb-2",
          children: tip.icon
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("h3", {
          className: "font-medium text-surface-200 mb-1",
          children: tip.title
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("p", {
          className: "text-sm text-surface-400",
          children: tip.desc
        })]
      }, i))
    }), recentVideos.length > 0 && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
      initial: {
        opacity: 0
      },
      animate: {
        opacity: 1
      },
      transition: {
        delay: 0.6
      },
      className: "mt-8",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("h2", {
        className: "text-lg font-medium text-surface-300 mb-4",
        children: "\u0622\u062E\u0631 \u0627\u0644\u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A"
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
        className: "grid grid-cols-1 sm:grid-cols-2 gap-3",
        children: recentVideos.slice(0, 4).map(video => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("button", {
          onClick: () => {
            setCurrentVideo(video);
            setCurrentPage('player');
          },
          className: "glass rounded-xl p-3 flex items-center gap-3 hover:bg-surface-700/40 transition-all duration-200 group",
          children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
            className: "w-16 h-10 rounded-lg bg-surface-700 overflow-hidden flex-shrink-0",
            children: video.thumbnail_url ? /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("img", {
              src: video.thumbnail_url,
              alt: video.title,
              className: "w-full h-full object-cover",
              loading: "lazy"
            }) : /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
              className: "w-full h-full flex items-center justify-center",
              children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiPlay, {
                className: "w-5 h-5 text-surface-500"
              })
            })
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
            className: "flex-1 min-w-0 text-right",
            children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("p", {
              className: "text-sm font-medium text-surface-200 truncate",
              children: video.title
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("p", {
              className: "text-xs text-surface-400",
              children: video.channel
            })]
          })]
        }, video.id))
      })]
    })]
  });
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ }),

/***/ 623:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Z": () => (/* binding */ VideoPlayer)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(197);
/* harmony import */ var react_player__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(924);
/* harmony import */ var react_player__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_player__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(111);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _store_appStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(898);
/* harmony import */ var _hooks_useVideoPlayer__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(346);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_4__, _hooks_useVideoPlayer__WEBPACK_IMPORTED_MODULE_5__]);
([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_4__, _hooks_useVideoPlayer__WEBPACK_IMPORTED_MODULE_5__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
/**
 * Video player component with YouTube integration and local playback.
 */








function VideoPlayer() {
  const {
    currentVideo
  } = (0,_store_appStore__WEBPACK_IMPORTED_MODULE_4__/* .useAppStore */ .q)();
  const {
    playerRef,
    playerReady,
    currentTime,
    duration,
    playing,
    speed,
    volume,
    loopEnabled,
    togglePlay,
    seekTo,
    setSpeed,
    skipForward,
    skipBackward,
    toggleLoop,
    onProgress,
    onDuration,
    onReady,
    onEnded
  } = (0,_hooks_useVideoPlayer__WEBPACK_IMPORTED_MODULE_5__/* .useVideoPlayer */ .d)();
  if (!currentVideo) return null;
  const progress = duration > 0 ? currentTime / duration * 100 : 0;
  const youtubeUrl = `https://www.youtube.com/watch?v=${currentVideo.youtube_id}`;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
    className: "relative rounded-2xl overflow-hidden bg-black",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
      className: "aspect-video relative",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx((react_player__WEBPACK_IMPORTED_MODULE_2___default()), {
        ref: playerRef,
        url: youtubeUrl,
        width: "100%",
        height: "100%",
        playing: playing,
        volume: volume,
        playbackRate: speed,
        onProgress: onProgress,
        onDuration: onDuration,
        onReady: onReady,
        onEnded: onEnded,
        controls: false,
        style: {
          borderRadius: '1rem'
        }
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("div", {
        className: "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
      className: "bg-surface-900/95 backdrop-blur-sm px-4 py-3",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("div", {
        className: "relative mb-3 group cursor-pointer",
        onClick: e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percent = x / rect.width;
          seekTo(percent * duration);
        },
        children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("div", {
          className: "h-1.5 bg-surface-700 rounded-full overflow-hidden",
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
            className: "h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full relative",
            style: {
              width: `${progress}%`
            }
          })
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
        className: "flex items-center justify-between",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
          className: "flex items-center gap-2",
          children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("button", {
            onClick: togglePlay,
            className: "text-white p-2 rounded-xl hover:bg-surface-700/50 transition-all",
            children: playing ? /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiPause, {
              className: "w-5 h-5"
            }) : /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiPlay, {
              className: "w-5 h-5"
            })
          }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("button", {
            onClick: () => skipBackward(10),
            className: "p-2 rounded-xl hover:bg-surface-700/50 transition-all text-surface-300",
            children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiRewind, {
              className: "w-4 h-4"
            })
          }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("button", {
            onClick: () => skipForward(10),
            className: "p-2 rounded-xl hover:bg-surface-700/50 transition-all text-surface-300",
            children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiFastForward, {
              className: "w-4 h-4"
            })
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("span", {
            className: "text-xs text-surface-400 font-mono min-w-[100px]",
            children: [formatTime(currentTime), " / ", formatTime(duration)]
          })]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
          className: "flex items-center gap-2",
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
            className: "relative group",
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("button", {
              className: "p-2 rounded-xl hover:bg-surface-700/50 transition-all text-surface-300 text-xs font-mono",
              children: [speed, "x"]
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("div", {
              className: "absolute bottom-full right-0 mb-2 p-2 glass rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50",
              children: [0.5, 0.75, 1, 1.25, 1.5, 2].map(s => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("button", {
                onClick: () => setSpeed(s),
                className: `block w-full text-right px-3 py-1.5 text-sm rounded-lg transition-colors ${speed === s ? 'text-primary-400 bg-primary-500/10' : 'text-surface-300 hover:text-white hover:bg-surface-700'}`,
                children: [s, "x"]
              }, s))
            })]
          }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("button", {
            onClick: () => toggleLoop(),
            className: `p-2 rounded-xl hover:bg-surface-700/50 transition-all ${loopEnabled ? 'text-primary-400 bg-primary-500/10' : 'text-surface-300'}`,
            children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiRefresh, {
              className: "w-4 h-4"
            })
          })]
        })]
      })]
    })]
  });
}

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ }),

/***/ 119:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Z": () => (/* binding */ TranscriptViewer)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(197);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(111);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _store_appStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(898);
/* harmony import */ var _hooks_useVideoPlayer__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(346);
/* harmony import */ var _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(255);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_3__, _hooks_useVideoPlayer__WEBPACK_IMPORTED_MODULE_4__, _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_5__]);
([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_3__, _hooks_useVideoPlayer__WEBPACK_IMPORTED_MODULE_4__, _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_5__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
/**
 * Synchronized transcript viewer with karaoke-style word highlighting.
 * Supports click on any word for dictionary lookup.
 */








function TranscriptViewer() {
  const {
    transcript,
    playerState
  } = (0,_store_appStore__WEBPACK_IMPORTED_MODULE_3__/* .useAppStore */ .q)();
  const {
    currentTime,
    seekTo,
    extractTranscript
  } = (0,_hooks_useVideoPlayer__WEBPACK_IMPORTED_MODULE_4__/* .useVideoPlayer */ .d)();
  const {
    lookupWord
  } = (0,_hooks_useDictionary__WEBPACK_IMPORTED_MODULE_5__/* .useDictionary */ .g)();
  const containerRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const activeSegmentRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null); // Auto-scroll to current segment

  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (activeSegmentRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeSegmentRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      if (elementRect.top < containerRect.top + 100 || elementRect.bottom > containerRect.bottom - 100) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [playerState.current_segment]); // If no transcript, show extract button

  if (!transcript?.segments?.length) {
    return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
      className: "flex flex-col items-center justify-center py-16 gap-4",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("div", {
        className: "w-16 h-16 rounded-full bg-surface-700/50 flex items-center justify-center",
        children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiTranslate, {
          className: "w-8 h-8 text-surface-400"
        })
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("p", {
        className: "text-surface-400 text-center",
        children: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u0646\u0635 \u0628\u0639\u062F"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("button", {
        onClick: () => extractTranscript(_store_appStore__WEBPACK_IMPORTED_MODULE_3__/* .useAppStore.getState */ .q.getState().currentVideo?.id || ''),
        className: "btn-primary",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiPlay, {
          className: "w-4 h-4"
        }), "\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u0646\u0635"]
      })]
    });
  }

  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
    className: "relative",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
      className: "flex items-center justify-between mb-4",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("h3", {
        className: "text-lg font-semibold text-surface-200",
        children: "\u0627\u0644\u0646\u0635 \u0627\u0644\u0645\u062A\u0632\u0627\u0645\u0646"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("span", {
        className: "text-xs text-surface-400",
        children: [transcript.segments.length, " \u062C\u0645\u0644\u0629"]
      })]
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("div", {
      ref: containerRef,
      className: "space-y-1 max-h-[60vh] overflow-y-auto scrollbar-hide px-2",
      children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.AnimatePresence, {
        children: transcript.segments.map((segment, idx) => /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(TranscriptSegmentItem, {
          segment: segment,
          isActive: playerState.current_segment === segment.index,
          currentTime: currentTime,
          onClick: () => seekTo(segment.start),
          onWordClick: lookupWord,
          ref: playerState.current_segment === segment.index ? activeSegmentRef : undefined
        }, segment.index || idx))
      })
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(CurrentLineBar, {
      segment: transcript.segments.find(s => s.index === playerState.current_segment) || null,
      currentTime: currentTime
    })]
  });
}
/* Individual transcript segment with karaoke words */

const TranscriptSegmentItem = /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default().forwardRef(({
  segment,
  isActive,
  currentTime,
  onClick,
  onWordClick
}, ref) => {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
    ref: ref,
    layout: true,
    initial: {
      opacity: 0,
      x: -10
    },
    animate: {
      opacity: 1,
      x: 0,
      scale: isActive ? 1 : 0.98
    },
    transition: {
      duration: 0.2
    },
    className: `p-3 rounded-xl cursor-pointer transition-all duration-200 ${isActive ? 'bg-primary-500/10 border-r-2 border-primary-500 shadow-sm' : 'hover:bg-surface-700/30 border-r-2 border-transparent'}`,
    onClick: onClick,
    dir: "rtl",
    children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("p", {
      className: `leading-relaxed ${isActive ? 'text-surface-100' : 'text-surface-300'}`,
      children: segment.words?.length > 0 ? segment.words.map((word, wi) => /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx(WordSpan, {
        word: word,
        isActive: isActive && currentTime >= word.start && currentTime <= word.end,
        isSentenceActive: isActive,
        onClick: e => {
          e.stopPropagation();
          onWordClick(word.word.replace(/[.,!?;:'"]/g, ''));
        }
      }, wi)) : segment.text.split(' ').map((w, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("span", {
        className: "transcript-word",
        onClick: e => {
          e.stopPropagation();
          onWordClick(w.replace(/[.,!?;:'"]/g, ''));
        },
        children: [w, ' ']
      }, i))
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("span", {
      className: "text-xs text-surface-500 mt-1 block",
      children: [formatTimestamp(segment.start), " - ", formatTimestamp(segment.end)]
    })]
  });
});
TranscriptSegmentItem.displayName = 'TranscriptSegmentItem';
/* Individual word with karaoke highlighting */

function WordSpan({
  word,
  isActive,
  isSentenceActive,
  onClick
}) {
  const duration = word.end - word.start;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("span", {
    className: "inline-block relative mx-0.5",
    children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("span", {
      className: `transcript-word text-base ${isActive ? 'active text-primary-300 font-semibold' : isSentenceActive ? 'text-surface-100' : 'text-surface-300'}`,
      onClick: onClick,
      children: word.word
    }), isSentenceActive && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("span", {
      className: "absolute bottom-0 left-0 h-0.5 bg-primary-400 rounded-full transition-all duration-100",
      style: {
        width: isActive ? '100%' : '0%',
        transitionDuration: `${Math.max(duration * 1000, 100)}ms`
      }
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("span", {
      children: " "
    })]
  });
}
/* Current line floating bar */


function CurrentLineBar({
  segment,
  currentTime
}) {
  if (!segment) return null;
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
    className: "sticky bottom-0 mt-4 p-4 glass rounded-2xl border border-primary-500/20",
    children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("p", {
      className: "text-sm text-surface-200 leading-relaxed text-center font-medium",
      children: segment.text
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsxs)("div", {
      className: "flex items-center justify-between mt-2",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("span", {
        className: "text-xs text-primary-400",
        children: formatTimestamp(currentTime)
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("div", {
        className: "flex items-center gap-2",
        children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_6__.jsx("span", {
          className: "badge-primary text-xs",
          children: formatTimestamp(segment.duration)
        })
      })]
    })]
  });
}

function formatTimestamp(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ }),

/***/ 346:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "d": () => (/* binding */ useVideoPlayer)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _store_appStore__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(898);
/* harmony import */ var _services_api__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(714);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_store_appStore__WEBPACK_IMPORTED_MODULE_1__]);
_store_appStore__WEBPACK_IMPORTED_MODULE_1__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];
/**
 * Hook for video player controls and transcript synchronization.
 */



function useVideoPlayer() {
  const {
    currentVideo,
    playerState,
    updatePlayerState,
    transcript,
    setTranscript,
    setLoading,
    setError,
    setCurrentPage
  } = (0,_store_appStore__WEBPACK_IMPORTED_MODULE_1__/* .useAppStore */ .q)();
  const {
    0: playerReady,
    1: setPlayerReady
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const {
    0: currentTime,
    1: setCurrentTime
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const {
    0: duration,
    1: setDuration
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const {
    0: buffered,
    1: setBuffered
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const playerRef = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);
  const progressInterval = (0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null); // Load transcript when video changes

  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (currentVideo && !transcript) {
      loadTranscript(currentVideo.id);
    }
  }, [currentVideo?.id]); // Cleanup

  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  const loadTranscript = async videoId => {
    try {
      const data = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].transcripts.get */ .Z.transcripts.get(videoId);
      setTranscript(data);
    } catch {
      // Transcript will be extracted on demand
      console.log('No transcript yet, extract when playing');
    }
  };

  const extractTranscript = async videoId => {
    setLoading(true);

    try {
      const data = await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].transcripts.extract */ .Z.transcripts.extract(videoId);

      if (data.segments) {
        setTranscript(data);
      }
    } catch (err) {
      setError(err.message || 'Failed to extract transcript');
    } finally {
      setLoading(false);
    }
  }; // Get current segment based on time


  const getCurrentSegment = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (!transcript?.segments) return null;
    return transcript.segments.find(seg => currentTime >= seg.start && currentTime <= seg.end) || null;
  }, [transcript, currentTime]); // Get current word at timestamp

  const getCurrentWord = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    const segment = getCurrentSegment();
    if (!segment?.words) return null;
    return segment.words.find(w => currentTime >= w.start && currentTime <= w.end) || null;
  }, [getCurrentSegment, currentTime]); // Player controls

  const play = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (playerRef.current) {
      playerRef.current.getInternalPlayer()?.play();
      updatePlayerState({
        playing: true
      });
    }
  }, [updatePlayerState]);
  const pause = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (playerRef.current) {
      playerRef.current.getInternalPlayer()?.pause();
      updatePlayerState({
        playing: false
      });
    }
  }, [updatePlayerState]);
  const togglePlay = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    if (playerState.playing) pause();else play();
  }, [playerState.playing, play, pause]);
  const seekTo = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(time => {
    if (playerRef.current) {
      playerRef.current.seekTo(time, 'seconds');
      updatePlayerState({
        position: time
      });
      setCurrentTime(time);
    }
  }, [updatePlayerState]);
  const setSpeed = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(speed => {
    updatePlayerState({
      speed
    });
  }, [updatePlayerState]);
  const skipForward = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((seconds = 5) => {
    seekTo(Math.min(currentTime + seconds, duration));
  }, [currentTime, duration, seekTo]);
  const skipBackward = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((seconds = 5) => {
    seekTo(Math.max(currentTime - seconds, 0));
  }, [currentTime, seekTo]); // Navigate to specific segment

  const goToSegment = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(segment => {
    seekTo(segment.start);
    updatePlayerState({
      current_segment: segment.index
    });
  }, [seekTo, updatePlayerState]); // Loop segment

  const toggleLoop = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((start, end) => {
    if (playerState.loop_enabled) {
      updatePlayerState({
        loop_enabled: false,
        loop_start: undefined,
        loop_end: undefined
      });
    } else {
      const seg = getCurrentSegment();
      updatePlayerState({
        loop_enabled: true,
        loop_start: start || seg?.start || currentTime,
        loop_end: end || seg?.end || currentTime + 5
      });
    }
  }, [playerState.loop_enabled, getCurrentSegment, currentTime, updatePlayerState]); // Progress tracking

  const onProgress = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(state => {
    setCurrentTime(state.playedSeconds);
    setBuffered(state.loaded);
    updatePlayerState({
      position: state.playedSeconds
    }); // Update current segment

    const seg = getCurrentSegment();

    if (seg && seg.index !== playerState.current_segment) {
      updatePlayerState({
        current_segment: seg.index
      });
    } // Handle loop


    if (playerState.loop_enabled && playerState.loop_end) {
      if (state.playedSeconds >= playerState.loop_end) {
        seekTo(playerState.loop_start || 0);
      }
    }
  }, [getCurrentSegment, playerState.current_segment, playerState.loop_enabled, playerState.loop_start, playerState.loop_end, updatePlayerState, seekTo]);
  const onDuration = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(dur => {
    setDuration(dur);
  }, []);
  const onReady = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    setPlayerReady(true);
  }, []);
  const onEnded = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    updatePlayerState({
      playing: false
    });
  }, [updatePlayerState]); // Save player state periodically

  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if (!currentVideo || !playerState.playing) return;
    const saveInterval = setInterval(async () => {
      try {
        await _services_api__WEBPACK_IMPORTED_MODULE_2__/* ["default"].player.updateState */ .Z.player.updateState(playerState);
      } catch {// Silent fail
      }
    }, 10000);
    return () => clearInterval(saveInterval);
  }, [currentVideo?.id, playerState.playing]);
  return {
    // Refs
    playerRef,
    // State
    playerReady,
    currentTime,
    duration,
    buffered,
    // Transcript
    getCurrentSegment,
    getCurrentWord,
    extractTranscript,
    // Controls
    play,
    pause,
    togglePlay,
    seekTo,
    setSpeed,
    skipForward,
    skipBackward,
    goToSegment,
    toggleLoop,
    // Events
    onProgress,
    onDuration,
    onReady,
    onEnded,
    // Player state
    playing: playerState.playing,
    speed: playerState.speed,
    volume: playerState.volume,
    loopEnabled: playerState.loop_enabled,
    loopStart: playerState.loop_start,
    loopEnd: playerState.loop_end
  };
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ }),

/***/ 871:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ PlayerPage)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(197);
/* harmony import */ var _components_player_VideoInput__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(518);
/* harmony import */ var _components_player_VideoPlayer__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(623);
/* harmony import */ var _components_transcript_TranscriptViewer__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(119);
/* harmony import */ var _components_dictionary_DictionaryModal__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(860);
/* harmony import */ var _store_appStore__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(898);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _components_player_VideoInput__WEBPACK_IMPORTED_MODULE_2__, _components_player_VideoPlayer__WEBPACK_IMPORTED_MODULE_3__, _components_transcript_TranscriptViewer__WEBPACK_IMPORTED_MODULE_4__, _components_dictionary_DictionaryModal__WEBPACK_IMPORTED_MODULE_5__, _store_appStore__WEBPACK_IMPORTED_MODULE_6__]);
([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _components_player_VideoInput__WEBPACK_IMPORTED_MODULE_2__, _components_player_VideoPlayer__WEBPACK_IMPORTED_MODULE_3__, _components_transcript_TranscriptViewer__WEBPACK_IMPORTED_MODULE_4__, _components_dictionary_DictionaryModal__WEBPACK_IMPORTED_MODULE_5__, _store_appStore__WEBPACK_IMPORTED_MODULE_6__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
/**
 * Main player page combining video player, transcript, and dictionary.
 */









function PlayerPage() {
  const {
    currentVideo
  } = (0,_store_appStore__WEBPACK_IMPORTED_MODULE_6__/* .useAppStore */ .q)();

  if (!currentVideo) {
    return /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx(_components_player_VideoInput__WEBPACK_IMPORTED_MODULE_2__/* ["default"] */ .Z, {});
  }

  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("div", {
    className: "h-full flex flex-col lg:flex-row gap-4 p-4",
    children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx("div", {
      className: "w-full lg:w-[55%] xl:w-[60%] flex-shrink-0",
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
        initial: {
          opacity: 0,
          y: 10
        },
        animate: {
          opacity: 1,
          y: 0
        },
        className: "sticky top-4",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx(_components_player_VideoPlayer__WEBPACK_IMPORTED_MODULE_3__/* ["default"] */ .Z, {}), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("div", {
          className: "mt-4 space-y-2",
          children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx("h2", {
            className: "text-xl font-semibold text-surface-100 line-clamp-2",
            children: currentVideo.title
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("div", {
            className: "flex items-center gap-3 text-sm text-surface-400",
            children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx("span", {
              children: currentVideo.channel
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx("span", {
              children: "\u2022"
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx("span", {
              children: formatDuration(currentVideo.duration)
            })]
          })]
        })]
      })
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx("div", {
      className: "flex-1 min-w-0 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto",
      children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
        initial: {
          opacity: 0,
          y: 20
        },
        animate: {
          opacity: 1,
          y: 0
        },
        transition: {
          delay: 0.1
        },
        children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx(_components_transcript_TranscriptViewer__WEBPACK_IMPORTED_MODULE_4__/* ["default"] */ .Z, {})
      })
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx(_components_dictionary_DictionaryModal__WEBPACK_IMPORTED_MODULE_5__/* ["default"] */ .Z, {})]
  });
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  if (h > 0) return `${h}s ${m}d`;
  return `${m} دقيقة`;
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ })

};
;
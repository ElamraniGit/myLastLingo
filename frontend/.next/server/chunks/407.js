"use strict";
exports.id = 407;
exports.ids = [407];
exports.modules = {

/***/ 286:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Z": () => (/* binding */ FlashcardViewer)
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
 * Flashcard viewer with spaced repetition review system.
 * Flip animation, swipe gestures, and quality rating.
 */






const qualityOptions = [{
  value: 0,
  label: 'نسيت',
  emoji: '😵',
  color: 'red'
}, {
  value: 1,
  label: 'صعب',
  emoji: '😓',
  color: 'orange'
}, {
  value: 3,
  label: 'متوسط',
  emoji: '🤔',
  color: 'yellow'
}, {
  value: 5,
  label: 'سهل',
  emoji: '😊',
  color: 'green'
}];
function FlashcardViewer() {
  const {
    dueWords,
    loadDueWords,
    reviewWord
  } = (0,_hooks_useDictionary__WEBPACK_IMPORTED_MODULE_3__/* .useDictionary */ .g)();
  const {
    0: currentIndex,
    1: setCurrentIndex
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(0);
  const {
    0: isFlipped,
    1: setIsFlipped
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const {
    0: swiping,
    1: setSwiping
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  const {
    0: direction,
    1: setDirection
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null);
  const {
    0: showResult,
    1: setShowResult
  } = (0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(false);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    loadDueWords();
  }, [loadDueWords]); // Reset when new words loaded

  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [dueWords.length]);
  const currentWord = dueWords[currentIndex];
  const handleFlip = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(() => {
    setIsFlipped(prev => !prev);
  }, []);
  const handleReview = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(async quality => {
    if (!currentWord) return;
    await reviewWord(currentWord.id, quality); // Show result briefly

    setShowResult(true);
    setTimeout(() => {
      setShowResult(false);

      if (currentIndex < dueWords.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
      } else {
        // Reload for more words
        loadDueWords();
      }
    }, 500);
  }, [currentWord, currentIndex, dueWords.length, reviewWord, loadDueWords]);
  const speak = (0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)(text => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }, []);

  if (dueWords.length === 0) {
    return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex flex-col items-center justify-center py-20 gap-4",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
        className: "w-20 h-20 rounded-full bg-surface-700/50 flex items-center justify-center",
        children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiEmojiHappy, {
          className: "w-10 h-10 text-surface-400"
        })
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("h3", {
        className: "text-xl font-semibold text-surface-200",
        children: "\u0645\u0645\u062A\u0627\u0632! \uD83C\uDF89"
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
        className: "text-surface-400 text-center max-w-sm",
        children: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0643\u0644\u0645\u0627\u062A \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0622\u0646. \u0639\u062F \u0644\u0627\u062D\u0642\u064B\u0627 \u0623\u0648 \u062A\u0639\u0644\u0645 \u0643\u0644\u0645\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0645\u0646 \u0627\u0644\u0641\u064A\u062F\u064A\u0648\u0647\u0627\u062A."
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
        onClick: loadDueWords,
        className: "btn-secondary mt-2",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiRefresh, {
          className: "w-4 h-4"
        }), "\u062A\u062D\u062F\u064A\u062B"]
      })]
    });
  }

  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "max-w-lg mx-auto px-4 py-6",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex items-center justify-between mb-6",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("span", {
        className: "text-sm text-surface-400",
        children: [currentIndex + 1, " / ", dueWords.length]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-2",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiLightningBolt, {
          className: "w-4 h-4 text-yellow-400"
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
          className: "text-sm text-surface-400",
          children: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0630\u0643\u064A\u0629"
        })]
      })]
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
      className: "h-1.5 bg-surface-700 rounded-full mb-8 overflow-hidden",
      children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
        className: "h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full",
        initial: {
          width: 0
        },
        animate: {
          width: `${(currentIndex + 1) / dueWords.length * 100}%`
        },
        transition: {
          duration: 0.3
        }
      })
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.AnimatePresence, {
      mode: "wait",
      children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
        initial: {
          opacity: 0,
          x: 200
        },
        animate: {
          opacity: 1,
          x: 0
        },
        exit: {
          opacity: 0,
          x: -200
        },
        className: "flashcard",
        onClick: handleFlip,
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          className: `flashcard-inner ${isFlipped ? 'flipped' : ''}`,
          children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
            className: "flashcard-front",
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
              className: "flex items-center gap-3 mb-4",
              children: [currentWord?.part_of_speech && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
                className: "badge-primary text-xs",
                children: currentWord.part_of_speech
              }), currentWord?.level && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
                className: `badge badge-level-${currentWord.level}`,
                children: currentWord.level
              })]
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("h2", {
              className: "text-4xl font-bold text-surface-100 mb-3 text-center",
              children: currentWord?.word
            }), currentWord?.pronunciation && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
              className: "text-surface-400 font-mono text-lg",
              children: currentWord.pronunciation
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("button", {
              onClick: e => {
                e.stopPropagation();
                speak(currentWord?.word || '');
              },
              className: "btn-icon btn-ghost text-primary-400 mt-4",
              children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiVolumeUp, {
                className: "w-6 h-6"
              })
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
              className: "text-surface-500 text-sm mt-6",
              children: "\u0627\u0636\u063A\u0637 \u0644\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0644\u0649 \u0627\u0644\u0645\u0639\u0646\u0649"
            })]
          }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
            className: "flashcard-back",
            children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
              className: "text-center space-y-4 w-full",
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
                children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
                  className: "text-xs text-surface-500 mb-1",
                  children: "\u0627\u0644\u062A\u0631\u062C\u0645\u0629"
                }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
                  className: "text-2xl font-semibold text-surface-100",
                  dir: "rtl",
                  children: currentWord?.meaning_ar || 'غير متوفرة'
                })]
              }), currentWord?.meaning_en && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
                children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
                  className: "text-xs text-surface-500 mb-1",
                  children: "\u0627\u0644\u0645\u0639\u0646\u0649"
                }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
                  className: "text-base text-surface-300",
                  children: currentWord.meaning_en
                })]
              }), currentWord?.examples?.[0] && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
                className: "glass rounded-xl p-3 mt-2",
                children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
                  className: "text-sm text-surface-300 leading-relaxed",
                  children: currentWord.examples[0]
                })
              })]
            })
          })]
        })
      }, currentWord?.id)
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.AnimatePresence, {
      children: isFlipped && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
        initial: {
          opacity: 0,
          y: 20
        },
        animate: {
          opacity: 1,
          y: 0
        },
        className: "mt-8",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
          className: "text-center text-sm text-surface-400 mb-4",
          children: "\u0643\u064A\u0641 \u0643\u0627\u0646\u062A \u062F\u0631\u062C\u0629 \u062A\u0630\u0643\u0631\u0643 \u0644\u0647\u0630\u0647 \u0627\u0644\u0643\u0644\u0645\u0629\u061F"
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
          className: "flex justify-center gap-3",
          children: qualityOptions.map(opt => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
            onClick: () => handleReview(opt.value),
            className: "flex flex-col items-center gap-2 p-4 rounded-2xl glass-hover glass transition-all duration-200 hover:scale-105 min-w-[70px]",
            children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
              className: "text-2xl",
              children: opt.emoji
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
              className: "text-xs text-surface-400",
              children: opt.label
            })]
          }, opt.value))
        })]
      })
    })]
  });
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ }),

/***/ 407:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ FlashcardsPage)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _components_flashcards_FlashcardViewer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(286);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_components_flashcards_FlashcardViewer__WEBPACK_IMPORTED_MODULE_1__]);
_components_flashcards_FlashcardViewer__WEBPACK_IMPORTED_MODULE_1__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];
/**
 * Flashcards page for spaced repetition review.
 */




function FlashcardsPage() {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
    className: "max-w-4xl mx-auto px-4 py-6",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsxs)("div", {
      className: "text-center mb-6",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx("h1", {
        className: "text-2xl font-bold text-surface-100",
        children: "\u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0630\u0643\u064A\u0629"
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx("p", {
        className: "text-surface-400 text-sm mt-1",
        children: "\u0631\u0627\u062C\u0639 \u0627\u0644\u0643\u0644\u0645\u0627\u062A \u0628\u0646\u0638\u0627\u0645 \u0627\u0644\u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0645\u062A\u0628\u0627\u0639\u062F \u0644\u0644\u062D\u0641\u0638 \u0627\u0644\u062F\u0627\u0626\u0645"
      })]
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_2__.jsx(_components_flashcards_FlashcardViewer__WEBPACK_IMPORTED_MODULE_1__/* ["default"] */ .Z, {})]
  });
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ })

};
;
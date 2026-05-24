"use strict";
exports.id = 559;
exports.ids = [559];
exports.modules = {

/***/ 559:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ StatsPage)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(197);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(111);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(255);
/* harmony import */ var _store_appStore__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(898);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_3__, _store_appStore__WEBPACK_IMPORTED_MODULE_4__]);
([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _hooks_useDictionary__WEBPACK_IMPORTED_MODULE_3__, _store_appStore__WEBPACK_IMPORTED_MODULE_4__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
/**
 * Statistics and progress tracking page.
 */







function StatsPage() {
  const {
    progress,
    loadStats
  } = (0,_hooks_useDictionary__WEBPACK_IMPORTED_MODULE_3__/* .useDictionary */ .g)();
  const {
    videos
  } = (0,_store_appStore__WEBPACK_IMPORTED_MODULE_4__/* .useAppStore */ .q)();
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    loadStats();
  }, [loadStats]);
  const statCards = [{
    icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiPlay, {
      className: "w-6 h-6"
    }),
    label: 'الفيديوهات',
    value: videos.length,
    color: 'from-blue-500 to-cyan-500'
  }, {
    icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiBookOpen, {
      className: "w-6 h-6"
    }),
    label: 'الكلمات المحفوظة',
    value: progress?.total_saved_words || 0,
    color: 'from-purple-500 to-pink-500'
  }, {
    icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiStar, {
      className: "w-6 h-6"
    }),
    label: 'الكلمات المتعلمة',
    value: progress?.learned_words || 0,
    color: 'from-yellow-500 to-orange-500'
  }, {
    icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiLightningBolt, {
      className: "w-6 h-6"
    }),
    label: 'للمراجعة اليوم',
    value: progress?.due_reviews || 0,
    color: 'from-green-500 to-emerald-500'
  }, {
    icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiCalendar, {
      className: "w-6 h-6"
    }),
    label: 'أيام النشاط (30)',
    value: progress?.active_days_30 || 0,
    color: 'from-red-500 to-rose-500'
  }, {
    icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiTrendingUp, {
      className: "w-6 h-6"
    }),
    label: 'المستوى الحالي',
    value: progress?.vocabulary_level || 'A1',
    color: 'from-violet-500 to-indigo-500'
  }];
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
    className: "max-w-4xl mx-auto px-4 py-6 space-y-6",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("h1", {
        className: "text-2xl font-bold text-surface-100",
        children: "\u0627\u0644\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A"
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("p", {
        className: "text-surface-400 text-sm mt-1",
        children: "\u062A\u062A\u0628\u0639 \u062A\u0642\u062F\u0645\u0643 \u0641\u064A \u062A\u0639\u0644\u0645 \u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629"
      })]
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
      className: "grid grid-cols-2 md:grid-cols-3 gap-4",
      children: statCards.map((stat, i) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
        initial: {
          opacity: 0,
          y: 20
        },
        animate: {
          opacity: 1,
          y: 0
        },
        transition: {
          delay: i * 0.05
        },
        className: "glass rounded-2xl p-5 hover:bg-surface-700/40 transition-all duration-300",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
          className: `w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3 shadow-lg`,
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
            className: "text-white",
            children: stat.icon
          })
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("p", {
          className: "text-2xl font-bold text-surface-100",
          children: stat.value
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("p", {
          className: "text-sm text-surface-400 mt-1",
          children: stat.label
        })]
      }, i))
    }), progress?.level_distribution && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
      initial: {
        opacity: 0
      },
      animate: {
        opacity: 1
      },
      className: "glass rounded-2xl p-6",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("h2", {
        className: "text-lg font-semibold text-surface-100 mb-4",
        children: "\u062A\u0648\u0632\u064A\u0639 \u0645\u0633\u062A\u0648\u064A\u0627\u062A \u0627\u0644\u0643\u0644\u0645\u0627\u062A"
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
        className: "space-y-3",
        children: Object.entries(progress.level_distribution).map(([level, count]) => {
          const total = Object.values(progress.level_distribution).reduce((a, b) => a + b, 0);
          const percentage = total > 0 ? count / total * 100 : 0;
          return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
            children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
              className: "flex items-center justify-between text-sm mb-1",
              children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("span", {
                className: "text-surface-300 font-medium",
                children: level
              }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("span", {
                className: "text-surface-400",
                children: [count, " \u0643\u0644\u0645\u0629 (", percentage.toFixed(0), "%)"]
              })]
            }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
              className: "h-2.5 bg-surface-700 rounded-full overflow-hidden",
              children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
                className: `h-full rounded-full ${level === 'A1' ? 'bg-green-500' : level === 'A2' ? 'bg-emerald-500' : level === 'B1' ? 'bg-blue-500' : level === 'B2' ? 'bg-violet-500' : level === 'C1' ? 'bg-orange-500' : 'bg-red-500'}`,
                initial: {
                  width: 0
                },
                animate: {
                  width: `${percentage}%`
                },
                transition: {
                  duration: 1,
                  ease: 'easeOut'
                }
              })
            })]
          }, level);
        })
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
      initial: {
        opacity: 0
      },
      animate: {
        opacity: 1
      },
      className: "glass rounded-2xl p-6",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("h2", {
        className: "text-lg font-semibold text-surface-100 mb-4",
        children: "\u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u062D\u062F\u064A\u062B"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("div", {
        className: "flex items-center gap-3 text-surface-400",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiCalendar, {
          className: "w-5 h-5"
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)("span", {
          children: ["\u062A\u0645\u062A \u0645\u0631\u0627\u062C\u0639\u0629 ", progress?.reviewed_today || 0, " \u0643\u0644\u0645\u0629 \u0627\u0644\u064A\u0648\u0645", progress?.active_days_30 && ` • ${progress.active_days_30} يوم نشاط في آخر 30 يوم`]
        })]
      })]
    }), progress?.streak_days ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
      initial: {
        opacity: 0,
        scale: 0.95
      },
      animate: {
        opacity: 1,
        scale: 1
      },
      className: "glass rounded-2xl p-6 text-center border border-yellow-500/20",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("div", {
        className: "text-4xl mb-2",
        children: "\uD83D\uDD25"
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("p", {
        className: "text-2xl font-bold text-yellow-400",
        children: progress.streak_days
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_5__.jsx("p", {
        className: "text-sm text-surface-400 mt-1",
        children: "\u0623\u064A\u0627\u0645 \u0645\u062A\u062A\u0627\u0644\u064A\u0629 \u0645\u0646 \u0627\u0644\u062A\u0639\u0644\u0645"
      })]
    }) : null]
  });
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ })

};
;
"use strict";
(() => {
var exports = {};
exports.id = 888;
exports.ids = [888,38,943,659,526,354];
exports.modules = {

/***/ 143:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "Z": () => (/* binding */ Layout)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(197);
/* harmony import */ var _store_appStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(898);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(111);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_2__]);
([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_2__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
/**
 * Main application layout with navigation sidebar.
 */







const navItems = [{
  id: 'player',
  label: 'اللاعب',
  icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiPlay, {
    className: "w-5 h-5"
  })
}, {
  id: 'vocabulary',
  label: 'المفردات',
  icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiBookOpen, {
    className: "w-5 h-5"
  })
}, {
  id: 'flashcards',
  label: 'البطاقات',
  icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiCollection, {
    className: "w-5 h-5"
  })
}, {
  id: 'stats',
  label: 'الإحصائيات',
  icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiChartBar, {
    className: "w-5 h-5"
  })
}, {
  id: 'settings',
  label: 'الإعدادات',
  icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiCog, {
    className: "w-5 h-5"
  })
}];
function Layout({
  children
}) {
  const {
    currentPage,
    setCurrentPage,
    sidebarOpen,
    setSidebarOpen
  } = (0,_store_appStore__WEBPACK_IMPORTED_MODULE_2__/* .useAppStore */ .q)();
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "flex h-screen bg-surface-900 overflow-hidden",
    children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.AnimatePresence, {
      children: sidebarOpen && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
        initial: {
          opacity: 0
        },
        animate: {
          opacity: 1
        },
        exit: {
          opacity: 0
        },
        className: "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden",
        onClick: () => setSidebarOpen(false)
      })
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.AnimatePresence, {
      mode: "wait",
      children: sidebarOpen && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.aside, {
        initial: {
          x: -280
        },
        animate: {
          x: 0
        },
        exit: {
          x: -280
        },
        transition: {
          type: 'spring',
          damping: 25,
          stiffness: 200
        },
        className: "fixed inset-y-0 left-0 z-50 w-72 bg-surface-800 border-l border-surface-700/50 lg:hidden",
        children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(MobileSidebar, {
          currentPage: currentPage,
          onNavigate: page => {
            setCurrentPage(page);
            setSidebarOpen(false);
          },
          onClose: () => setSidebarOpen(false)
        })
      })
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("aside", {
      className: "hidden lg:flex flex-col w-64 bg-surface-800/50 border-l border-surface-700/30",
      children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(DesktopSidebar, {
        currentPage: currentPage,
        onNavigate: setCurrentPage
      })
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("main", {
      className: "flex-1 flex flex-col min-w-0",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("header", {
        className: "flex items-center justify-between px-4 py-3 bg-surface-800/30 backdrop-blur-sm border-b border-surface-700/30 lg:hidden",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("button", {
          onClick: () => setSidebarOpen(true),
          className: "btn-icon btn-ghost",
          "aria-label": "Open menu",
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiMenu, {
            className: "w-6 h-6"
          })
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
          className: "flex items-center gap-2",
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
            className: "text-lg font-bold gradient-text",
            children: "LinguaLearn"
          })
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("button", {
          className: "btn-icon btn-ghost",
          "aria-label": "Search",
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiSearch, {
            className: "w-6 h-6"
          })
        })]
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
        className: "flex-1 overflow-y-auto",
        children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.AnimatePresence, {
          mode: "wait",
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
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
              y: -10
            },
            transition: {
              duration: 0.2
            },
            className: "h-full",
            children: children
          }, currentPage)
        })
      })]
    })]
  });
}
/* Desktop Sidebar */

function DesktopSidebar({
  currentPage,
  onNavigate
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
    children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
      className: "p-6",
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
          className: "w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg",
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
            className: "text-white font-bold text-lg",
            children: "L"
          })
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("h1", {
            className: "text-lg font-bold gradient-text",
            children: "LinguaLearn"
          }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
            className: "text-xs text-surface-400",
            children: "English Learning"
          })]
        })]
      })
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("nav", {
      className: "flex-1 px-3 space-y-1",
      children: navItems.map(item => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
        onClick: () => onNavigate(item.id),
        className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${currentPage === item.id ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-sm' : 'text-surface-300 hover:text-white hover:bg-surface-700/50'}`,
        children: [item.icon, /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
          children: item.label
        })]
      }, item.id))
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
      className: "p-4 border-t border-surface-700/30",
      children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-700/30",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
          className: "w-2 h-2 rounded-full bg-green-500 animate-pulse-soft"
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
          className: "text-xs text-surface-400",
          children: "\u0627\u0644\u062E\u0627\u062F\u0645 \u0627\u0644\u0645\u062D\u0644\u064A \u0646\u0634\u0637"
        })]
      })
    })]
  });
}
/* Mobile Sidebar */


function MobileSidebar({
  currentPage,
  onNavigate,
  onClose
}) {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.Fragment, {
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "flex items-center justify-between p-6",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
          className: "w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center",
          children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
            className: "text-white font-bold text-lg",
            children: "L"
          })
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("h1", {
          className: "text-lg font-bold gradient-text",
          children: "LinguaLearn"
        })]
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("button", {
        onClick: onClose,
        className: "btn-icon btn-ghost",
        children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_3__.HiX, {
          className: "w-6 h-6"
        })
      })]
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("nav", {
      className: "px-3 space-y-1",
      children: navItems.map(item => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
        onClick: () => onNavigate(item.id),
        className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${currentPage === item.id ? 'bg-primary-500/10 text-primary-400' : 'text-surface-300 hover:text-white hover:bg-surface-700/50'}`,
        children: [item.icon, /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
          children: item.label
        })]
      }, item.id))
    })]
  });
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ }),

/***/ 600:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ App)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var next_head__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(968);
/* harmony import */ var next_head__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(next_head__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _store_appStore__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(898);
/* harmony import */ var _components_common_Layout__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(143);
/* harmony import */ var _PlayerPage__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(871);
/* harmony import */ var _VocabularyPage__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(336);
/* harmony import */ var _FlashcardsPage__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(407);
/* harmony import */ var _StatsPage__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(559);
/* harmony import */ var _SettingsPage__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(30);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_store_appStore__WEBPACK_IMPORTED_MODULE_2__, _components_common_Layout__WEBPACK_IMPORTED_MODULE_3__, _PlayerPage__WEBPACK_IMPORTED_MODULE_4__, _VocabularyPage__WEBPACK_IMPORTED_MODULE_5__, _FlashcardsPage__WEBPACK_IMPORTED_MODULE_6__, _StatsPage__WEBPACK_IMPORTED_MODULE_7__, _SettingsPage__WEBPACK_IMPORTED_MODULE_8__]);
([_store_appStore__WEBPACK_IMPORTED_MODULE_2__, _components_common_Layout__WEBPACK_IMPORTED_MODULE_3__, _PlayerPage__WEBPACK_IMPORTED_MODULE_4__, _VocabularyPage__WEBPACK_IMPORTED_MODULE_5__, _FlashcardsPage__WEBPACK_IMPORTED_MODULE_6__, _StatsPage__WEBPACK_IMPORTED_MODULE_7__, _SettingsPage__WEBPACK_IMPORTED_MODULE_8__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);












function App({
  Component,
  pageProps
}) {
  const {
    currentPage,
    theme
  } = (0,_store_appStore__WEBPACK_IMPORTED_MODULE_2__/* .useAppStore */ .q)();
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  (0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'player':
        return /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx(_PlayerPage__WEBPACK_IMPORTED_MODULE_4__["default"], {});

      case 'vocabulary':
        return /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx(_VocabularyPage__WEBPACK_IMPORTED_MODULE_5__["default"], {});

      case 'flashcards':
        return /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx(_FlashcardsPage__WEBPACK_IMPORTED_MODULE_6__["default"], {});

      case 'stats':
        return /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx(_StatsPage__WEBPACK_IMPORTED_MODULE_7__["default"], {});

      case 'settings':
        return /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx(_SettingsPage__WEBPACK_IMPORTED_MODULE_8__["default"], {});

      default:
        return /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx(_PlayerPage__WEBPACK_IMPORTED_MODULE_4__["default"], {});
    }
  };

  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.Fragment, {
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsxs)((next_head__WEBPACK_IMPORTED_MODULE_1___default()), {
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx("meta", {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover"
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx("meta", {
        name: "theme-color",
        content: "#0f172a"
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx("title", {
        children: "LinguaLearn - \u062A\u0639\u0644\u0645 \u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629"
      })]
    }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_9__.jsx(_components_common_Layout__WEBPACK_IMPORTED_MODULE_3__/* ["default"] */ .Z, {
      children: renderPage()
    })]
  });
}
__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ }),

/***/ 968:
/***/ ((module) => {

module.exports = require("next/head");

/***/ }),

/***/ 689:
/***/ ((module) => {

module.exports = require("react");

/***/ }),

/***/ 111:
/***/ ((module) => {

module.exports = require("react-icons/hi");

/***/ }),

/***/ 924:
/***/ ((module) => {

module.exports = require("react-player");

/***/ }),

/***/ 997:
/***/ ((module) => {

module.exports = require("react/jsx-runtime");

/***/ }),

/***/ 197:
/***/ ((module) => {

module.exports = import("framer-motion");;

/***/ }),

/***/ 912:
/***/ ((module) => {

module.exports = import("zustand");;

/***/ }),

/***/ 602:
/***/ ((module) => {

module.exports = import("zustand/middleware");;

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, [898,255,871,407,336,559,30], () => (__webpack_exec__(600)));
module.exports = __webpack_exports__;

})();
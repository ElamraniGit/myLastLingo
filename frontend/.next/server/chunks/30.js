"use strict";
exports.id = 30;
exports.ids = [30];
exports.modules = {

/***/ 30:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ SettingsPage)
/* harmony export */ });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(689);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var framer_motion__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(197);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(111);
/* harmony import */ var react_icons_hi__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _store_appStore__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(898);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(997);
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__);
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_3__]);
([framer_motion__WEBPACK_IMPORTED_MODULE_1__, _store_appStore__WEBPACK_IMPORTED_MODULE_3__] = __webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__);
/**
 * Settings page for app configuration.
 */






function SettingsPage() {
  const {
    theme,
    toggleTheme,
    clearError
  } = (0,_store_appStore__WEBPACK_IMPORTED_MODULE_3__/* .useAppStore */ .q)();
  const settingsGroups = [{
    title: 'التشغيل',
    icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiVolumeUp, {
      className: "w-5 h-5"
    }),
    items: [{
      label: 'السرعة الافتراضية',
      type: 'select',
      value: '1x',
      options: ['0.5x', '0.75x', '1x', '1.25x', '1.5x', '2x']
    }, {
      label: 'التكرار التلقائي',
      type: 'toggle',
      value: false
    }]
  }, {
    title: 'النصوص والترجمة',
    icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiTranslate, {
      className: "w-5 h-5"
    }),
    items: [{
      label: 'لغة الترجمة الافتراضية',
      type: 'select',
      value: 'العربية',
      options: ['العربية', 'الإنجليزية']
    }, {
      label: 'النسخ التلقائي (Whisper)',
      type: 'toggle',
      value: true
    }]
  }, {
    title: 'البيانات والتخزين',
    icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiDatabase, {
      className: "w-5 h-5"
    }),
    items: [{
      label: 'حجم الذاكرة المؤقتة',
      type: 'info',
      value: '~45 MB'
    }, {
      label: 'عدد الكلمات المحفوظة',
      type: 'info',
      value: '0'
    }]
  }, {
    title: 'حول',
    icon: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiInformationCircle, {
      className: "w-5 h-5"
    }),
    items: [{
      label: 'الإصدار',
      type: 'info',
      value: '1.0.0'
    }, {
      label: 'الوضع',
      type: 'info',
      value: 'محلي بالكامل'
    }]
  }];
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
    className: "max-w-3xl mx-auto px-4 py-6 space-y-6",
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("h1", {
        className: "text-2xl font-bold text-surface-100",
        children: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A"
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
        className: "text-surface-400 text-sm mt-1",
        children: "\u062A\u062E\u0635\u064A\u0635 \u062A\u062C\u0631\u0628\u0629 \u0627\u0644\u062A\u0639\u0644\u0645"
      })]
    }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
      className: "glass rounded-2xl p-4 flex items-center gap-3",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
        className: "w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center",
        children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiServer, {
          className: "w-5 h-5 text-green-400"
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex-1",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
          className: "font-medium text-surface-200",
          children: "\u0627\u0644\u062E\u0627\u062F\u0645 \u0627\u0644\u0645\u062D\u0644\u064A"
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("p", {
          className: "text-xs text-surface-400",
          children: "127.0.0.1:8080 \u2022 \u0642\u064A\u062F \u0627\u0644\u062A\u0634\u063A\u064A\u0644"
        })]
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("span", {
        className: "flex items-center gap-1.5 text-xs text-green-400",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
          className: "w-2 h-2 rounded-full bg-green-500 animate-pulse-soft"
        }), "\u0646\u0634\u0637"]
      })]
    }), settingsGroups.map((group, gi) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
      initial: {
        opacity: 0,
        y: 20
      },
      animate: {
        opacity: 1,
        y: 0
      },
      transition: {
        delay: gi * 0.05
      },
      className: "glass rounded-2xl overflow-hidden",
      children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex items-center gap-3 px-6 py-4 border-b border-surface-700/30",
        children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
          className: "text-primary-400",
          children: group.icon
        }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("h3", {
          className: "font-medium text-surface-200",
          children: group.title
        })]
      }), /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("div", {
        className: "divide-y divide-surface-700/20",
        children: group.items.map((item, ii) => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
          className: "flex items-center justify-between px-6 py-4 hover:bg-surface-700/20 transition-colors",
          children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
            className: "text-sm text-surface-300",
            children: item.label
          }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
            className: "flex items-center gap-2",
            children: [item.type === 'toggle' && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("button", {
              className: `relative w-12 h-6 rounded-full transition-colors ${item.value ? 'bg-primary-500' : 'bg-surface-600'}`,
              children: /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
                className: `absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${item.value ? 'translate-x-6' : 'translate-x-0.5'}`
              })
            }), item.type === 'select' && item.options && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("select", {
              className: "bg-surface-700 text-surface-200 text-sm rounded-lg px-3 py-1.5 border border-surface-600 focus:outline-none focus:ring-2 focus:ring-primary-500/50",
              children: item.options.map(opt => /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("option", {
                children: opt
              }, opt))
            }), item.type === 'info' && /*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("span", {
              className: "text-sm text-surface-400",
              children: item.value
            })]
          })]
        }, ii))
      })]
    }, gi)), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)(framer_motion__WEBPACK_IMPORTED_MODULE_1__.motion.div, {
      initial: {
        opacity: 0
      },
      animate: {
        opacity: 1
      },
      className: "glass rounded-2xl p-6 border border-red-500/20",
      children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx("h3", {
        className: "font-medium text-red-400 mb-4",
        children: "\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062E\u0637\u0631"
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("div", {
        className: "flex gap-3",
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
          className: "btn bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20",
          children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiTrash, {
            className: "w-4 h-4"
          }), "\u0645\u0633\u062D \u062C\u0645\u064A\u0639 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A"]
        }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsxs)("button", {
          className: "btn bg-surface-700 text-surface-300 hover:bg-surface-600",
          children: [/*#__PURE__*/react_jsx_runtime__WEBPACK_IMPORTED_MODULE_4__.jsx(react_icons_hi__WEBPACK_IMPORTED_MODULE_2__.HiRefresh, {
            className: "w-4 h-4"
          }), "\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646"]
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
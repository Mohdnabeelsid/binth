/**
 * BINTH.IN — Core Application Script
 * General utilities, navigation helpers, and client-side helpers.
 */

import { Api, ApiConfig } from './api.js';

export const App = {
  version: '1.0.0-phase1',

  init() {
    this.initSmoothScroll();
    this.initConsoleNotice();
  },

  initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId && targetId !== '#') {
          const target = document.querySelector(targetId);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    });
  },

  initConsoleNotice() {
    console.info(
      '%cBINTH.IN Phase 1%c\nHandmade with care. Made for little ones.\nStrict HTML5 + CSS3 + Vanilla JavaScript.',
      'color: #5A2D2D; font-size: 16px; font-weight: bold; font-family: serif;',
      'color: #B8795D; font-size: 12px;'
    );
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

/*
 * ProductLab AI - site configuration
 * sharedAI: address of the shared-AI backend (proxy/worker.mjs on Cloudflare).
 * When set, people can use the AI features without a key of their own.
 * Leave empty to require each person's own key.
 */
(function (root) {
  'use strict';
  (root.PL = root.PL || {}).config = {
    sharedAI: ''
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

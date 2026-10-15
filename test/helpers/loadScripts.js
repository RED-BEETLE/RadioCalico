const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

// Builds a jsdom window from a public/*.html page (minus its <script> tags) and
// runs the given public/js files in it as classic scripts, in order, so their
// top-level const/let/function declarations are shared like in the browser.
function loadPage(htmlFile, scripts, { fetch } = {}) {
  const html = fs
    .readFileSync(path.join(PUBLIC_DIR, htmlFile), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost:3000/', runScripts: 'outside-only' });
  const { window } = dom;

  window.fetch = fetch || (() => Promise.reject(new Error('fetch not mocked')));
  window.alert = () => {};
  window.confirm = () => true;
  if (!window.crypto.randomUUID) {
    window.crypto.randomUUID = () => 'test-client-id';
  }
  // jsdom does not implement media playback.
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => {};
  window.HTMLMediaElement.prototype.load = () => {};

  const context = dom.getInternalVMContext();
  const run = (code) => vm.runInContext(code, context);
  for (const file of scripts) {
    run(fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8'));
  }
  return { window, document: window.document, run, close: () => window.close() };
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const RADIO_SCRIPTS = ['js/radio/player.js', 'js/radio/ratings.js', 'js/radio/metadata.js'];

module.exports = { loadPage, jsonResponse, RADIO_SCRIPTS };

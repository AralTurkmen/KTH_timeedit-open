/**
 * Script injected into the TimeEdit page. It reports any calendar link it can see:
 * in link hrefs, input/textarea values, visible text, links the page opens, and
 * text the page copies to the clipboard ("Copy link" buttons).
 * Kept in its own file so it can be tested without React Native.
 */
export const SNIFF = String.raw`
(function () {
  if (window.__teSniff) return;
  window.__teSniff = true;
  var RE = /(?:https?|webcal):\/\/[^\s"'<>\\]+?ri\.ics[^\s"'<>\\]*/i;
  var last = '';
  function report(text) {
    if (!text) return;
    var m = RE.exec(String(text));
    if (!m || m[0] === last) return;
    last = m[0];
    window.ReactNativeWebView.postMessage(last);
  }
  function scan() {
    try {
      var els = document.querySelectorAll('a[href], input, textarea');
      for (var i = 0; i < els.length; i++) {
        report(els[i].href || els[i].value || els[i].textContent);
      }
      if (document.body) report(document.body.innerText);
    } catch (e) {}
  }
  try {
    var cb = navigator.clipboard;
    if (cb && cb.writeText) {
      var orig = cb.writeText.bind(cb);
      cb.writeText = function (t) { report(t); return orig(t); };
    }
  } catch (e) {}
  try {
    document.addEventListener('copy', function () { report(String(window.getSelection())); }, true);
  } catch (e) {}
  try {
    var oo = window.open;
    window.open = function (u) { report(u); return oo ? oo.apply(window, arguments) : null; };
  } catch (e) {}
  scan();
  setInterval(scan, 1500);
  try { new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
})();
true;
`;

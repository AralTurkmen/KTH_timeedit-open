/**
 * Injected into kth.se pages inside the room screen. It reports the page text, the
 * floor-plan address, room photo addresses, and (once per floor plan) the floor-plan image
 * itself as a data URL so the app can keep it for offline use.
 */
export const ROOM_SNIFF = String.raw`
(function () {
  if (window.__teRoom) return;
  window.__teRoom = true;
  var last = '';
  var planSent = '';
  function post(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
  function grabPlan(src) {
    if (!src || planSent === src) return;
    planSent = src;
    fetch(src, { credentials: 'include' })
      .then(function (r) { return r.blob(); })
      .then(function (b) {
        if (!b || b.size > 1000000) return; // too big to store; the address is still saved
        var fr = new FileReader();
        fr.onload = function () { post({ kind: 'plan', url: location.href, planUrl: src, data: fr.result }); };
        fr.readAsDataURL(b);
      })
      .catch(function () {});
  }
  function send() {
    try {
      var img = document.querySelector('img[src*="/places/floorplan/"]');
      var photos = [];
      var imgs = document.querySelectorAll('img[src*="facility.admin.kth.se"]');
      for (var i = 0; i < imgs.length && photos.length < 6; i++) photos.push(imgs[i].src);
      var msg = JSON.stringify({
        kind: 'page',
        url: location.href,
        text: ((document.body && document.body.innerText) || '').slice(0, 20000),
        floorplan: img ? img.src : null,
        photos: photos
      });
      if (msg !== last) { last = msg; window.ReactNativeWebView.postMessage(msg); }
      if (img) grabPlan(img.src);
    } catch (e) {}
  }
  send();
  setInterval(send, 1500);
})();
true;
`;

/** Scrolls the room page to its floor plan ("Ritning"). */
export const SCROLL_TO_PLAN = String.raw`
(function () {
  var i = document.querySelector('img[src*="/places/floorplan/"]');
  if (i) i.scrollIntoView({ block: 'start' });
})();
true;
`;

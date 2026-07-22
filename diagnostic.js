// DASHBOARD LAYOUT-SHIFT DIAGNOSTIC
// 1. Open /dashboard in Chrome/Edge.
// 2. Open DevTools (F12) -> Console tab.
// 3. Paste the entire contents of this file into the console and press Enter.
// 4. Click the 3-dots menu on any resume card, then click "Delete".
// 5. Watch the console for ~10 seconds. Copy the output back to me.

(function () {
  console.log('=== DASHBOARD DIAGNOSTIC START ===');
  console.log('Timestamp:', new Date().toISOString());

  const before = {
    scrollY: window.scrollY,
    innerWidth: window.innerWidth,
    docClientWidth: document.documentElement.clientWidth,
    bodyOverflow: getComputedStyle(document.body).overflow,
    bodyPosition: getComputedStyle(document.body).position,
    bodyWidth: document.body.offsetWidth,
  };
  const aside = document.querySelector('aside');
  const asideBefore = aside ? {
    rect: aside.getBoundingClientRect(),
    position: getComputedStyle(aside).position,
    zIndex: getComputedStyle(aside).zIndex,
    display: getComputedStyle(aside).display,
    visibility: getComputedStyle(aside).visibility,
    opacity: getComputedStyle(aside).opacity,
    transform: getComputedStyle(aside).transform,
  } : null;
  console.log('BEFORE-MODAL:', { before, aside: asideBefore });

  const logs = [];
  function snapshot(label) {
    const a = document.querySelector('aside');
    const overlay = document.querySelector('[data-delete-overlay]');
    logs.push({
      label,
      ts: performance.now().toFixed(1),
      scrollY: window.scrollY,
      innerWidth: window.innerWidth,
      bodyOverflow: getComputedStyle(document.body).overflow,
      bodyPosition: getComputedStyle(document.body).position,
      bodyTop: document.body.style.top,
      bodyPaddingRight: document.body.style.paddingRight,
      asideRect: a ? a.getBoundingClientRect() : null,
      asideZ: a ? getComputedStyle(a).zIndex : null,
      asideDisplay: a ? getComputedStyle(a).display : null,
      asideVisibility: a ? getComputedStyle(a).visibility : null,
      asideOpacity: a ? getComputedStyle(a).opacity : null,
      asideTransform: a ? getComputedStyle(a).transform : null,
      asidePosition: a ? getComputedStyle(a).position : null,
      overlayPresent: !!overlay,
      overlayZ: overlay ? getComputedStyle(overlay).zIndex : null,
      overlayPosition: overlay ? getComputedStyle(overlay).position : null,
      overlayParent: overlay ? overlay.parentElement?.tagName + (overlay.parentElement?.id ? '#' + overlay.parentElement.id : '') : null,
    });
  }

  const target = document.querySelector('aside');
  if (!target) {
    console.error('No <aside> found in DOM. Are you on /dashboard?');
    return;
  }
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') {
        const attr = m.attributeName;
        const el = m.target;
        console.log('[mutation] ' + el.tagName.toLowerCase() + '.' + attr + ' =', el.getAttribute(attr) || getComputedStyle(el)[attr]);
      } else if (m.type === 'childList') {
        for (const n of m.addedNodes) if (n.nodeType === 1) console.log('[mutation] added:', n.tagName, (n.className?.toString() || '').slice(0, 80));
        for (const n of m.removedNodes) if (n.nodeType === 1) console.log('[mutation] removed:', n.tagName, (n.className?.toString() || '').slice(0, 80));
      }
    }
  });
  obs.observe(target, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  obs.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  console.log('Observers attached. Now click the 3-dots and choose Delete.');

  let tagged = false;
  const tagInterval = setInterval(() => {
    if (tagged) return;
    const fixedDivs = document.querySelectorAll('div.fixed.inset-0');
    for (const d of fixedDivs) {
      if (!d.hasAttribute('data-delete-overlay')) {
        d.setAttribute('data-delete-overlay', '1');
        tagged = true;
        console.log('Tagged overlay:', d);
        snapshot('overlay-mounted');
      }
    }
  }, 50);

  let lastScrollY = window.scrollY;
  const scrollWatcher = setInterval(() => {
    if (Math.abs(window.scrollY - lastScrollY) > 0) {
      console.log('[scroll] scrollY:', lastScrollY, '->', window.scrollY, 'delta:', window.scrollY - lastScrollY);
      lastScrollY = window.scrollY;
      snapshot('scroll-during-modal');
    }
  }, 50);

  setTimeout(() => {
    clearInterval(tagInterval);
    clearInterval(scrollWatcher);
    obs.disconnect();
    snapshot('final');
    console.log('=== ALL SNAPSHOTS ===');
    console.table(logs);
    console.log('=== DASHBOARD DIAGNOSTIC END ===');
  }, 10000);
})();

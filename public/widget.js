/**
 * widget.js — E-fficient Finance Widget Embed Script
 *
 * Usage (Mode 1 — floating widget on dealer site):
 *   <script>
 *     window.EfficientWidget = { dealer: "north-western-ford" };
 *   </script>
 *   <script src="https://e-fficient-ui-{key}.still-fire-1c3d.workers.dev/widget.js"></script>
 *
 * Config options:
 *   dealer      {string}  required — dealer key from dealers.config.js
 *   position    {string}  optional — "bottom-right" (default) | "bottom-left"
 *   label       {string}  optional — CTA button label (default: "Check affordability")
 *   tagline     {string}  optional — subtitle under label
 *   primaryColor {string} optional — override button colour (hex)
 */
(function () {
  'use strict';

  var config = window.EfficientWidget || {};
  var dealer = config.dealer;

  if (!dealer) {
    console.warn('[EfficientWidget] No dealer key provided. Add window.EfficientWidget = { dealer: "your-key" } before loading this script.');
    return;
  }

  // Derive widget URL from this script's own src so each dealer Worker serves its own widget
  var WIDGET_URL = (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (src.indexOf('/widget.js') !== -1) {
        return src.replace(/\/widget\.js.*$/, '');
      }
    }
    return '';
  })();

  var position      = config.position || 'bottom-right';
  var label         = config.label    || 'Check affordability';
  var tagline       = config.tagline  || 'Find out what you can qualify for in 60 seconds. No credit impact.';
  var primaryColor  = config.primaryColor || '#7C3AED';
  var isLeft        = position === 'bottom-left';

  // ── Styles ────────────────────────────────────────────────────────────────

  var style = document.createElement('style');
  style.textContent = [
    '#ew-fab{',
      'position:fixed;',
      isLeft ? 'left:20px;' : 'right:20px;',
      'bottom:20px;',
      'z-index:2147483640;',
      'display:flex;',
      'align-items:center;',
      'gap:10px;',
      'background:#fff;',
      'border-radius:50px;',
      'box-shadow:0 4px 24px rgba(0,0,0,0.18);',
      'padding:10px 18px 10px 10px;',
      'cursor:pointer;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'transition:transform 0.2s,box-shadow 0.2s;',
      'text-decoration:none;',
      'border:none;',
      'outline:none;',
    '}',
    '#ew-fab:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,0.22);}',
    '#ew-fab-icon{',
      'width:40px;height:40px;',
      'border-radius:50%;',
      'display:flex;align-items:center;justify-content:center;',
      'flex-shrink:0;',
      'background:' + primaryColor + ';',
    '}',
    '#ew-fab-icon svg{width:20px;height:20px;fill:#fff;}',
    '#ew-fab-text{display:flex;flex-direction:column;gap:2px;}',
    '#ew-fab-label{font-size:14px;font-weight:700;color:#1a1a1a;line-height:1.2;}',
    '#ew-fab-tagline{font-size:11px;color:#666;line-height:1.3;max-width:200px;}',

    // Overlay backdrop
    '#ew-backdrop{',
      'display:none;',
      'position:fixed;inset:0;',
      'background:rgba(0,0,0,0.5);',
      'z-index:2147483641;',
      'opacity:0;',
      'transition:opacity 0.25s;',
    '}',
    '#ew-backdrop.ew-open{display:block;}',
    '#ew-backdrop.ew-visible{opacity:1;}',

    // Modal container
    '#ew-modal{',
      'position:fixed;',
      isLeft ? 'left:16px;' : 'right:16px;',
      'bottom:80px;',
      'z-index:2147483642;',
      'width:400px;',
      'max-width:calc(100vw - 32px);',
      'height:min(800px, calc(100vh - 100px));',
      'border-radius:20px;',
      'overflow:hidden;',
      'box-shadow:0 20px 60px rgba(0,0,0,0.3);',
      'transform:translateY(20px) scale(0.97);',
      'opacity:0;',
      'transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1),opacity 0.25s;',
      'pointer-events:none;',
      'display:none;',
    '}',
    '#ew-modal.ew-open{display:block;}',
    '#ew-modal.ew-visible{transform:translateY(0) scale(1);opacity:1;pointer-events:auto;}',

    // Close button
    '#ew-close{',
      'position:absolute;',
      'top:12px;right:12px;',
      'z-index:10;',
      'width:32px;height:32px;',
      'border-radius:50%;',
      'background:rgba(255,255,255,0.9);',
      'border:none;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;',
      'box-shadow:0 2px 8px rgba(0,0,0,0.15);',
      'font-size:18px;color:#333;',
      'line-height:1;',
    '}',
    '#ew-close:hover{background:#fff;}',

    // iframe
    '#ew-iframe{width:100%;height:100%;border:none;display:block;}',

    // Hide FAB when modal open on mobile
    '@media(max-width:480px){',
      '#ew-modal{left:0;right:0;bottom:0;width:100%;max-width:100%;height:85vh;border-radius:20px 20px 0 0;}',
    '}',
  ].join('');
  document.head.appendChild(style);

  // ── FAB Button ────────────────────────────────────────────────────────────

  var fab = document.createElement('button');
  fab.id = 'ew-fab';
  fab.setAttribute('aria-label', label);
  fab.innerHTML = [
    '<span id="ew-fab-icon">',
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
        '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>',
      '</svg>',
    '</span>',
    '<span id="ew-fab-text">',
      '<span id="ew-fab-label">' + escHtml(label) + '</span>',
      tagline ? '<span id="ew-fab-tagline">' + escHtml(tagline) + '</span>' : '',
    '</span>',
  ].join('');

  // ── Backdrop ──────────────────────────────────────────────────────────────

  var backdrop = document.createElement('div');
  backdrop.id = 'ew-backdrop';

  // ── Modal ─────────────────────────────────────────────────────────────────

  var modal = document.createElement('div');
  modal.id = 'ew-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Finance pre-qualification');

  var closeBtn = document.createElement('button');
  closeBtn.id = 'ew-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = '×';

  var iframe = document.createElement('iframe');
  iframe.id = 'ew-iframe';
  iframe.setAttribute('allow', 'clipboard-write');
  iframe.setAttribute('title', 'Finance pre-qualification');

  modal.appendChild(closeBtn);
  modal.appendChild(iframe);

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  document.body.appendChild(fab);

  // ── State ─────────────────────────────────────────────────────────────────

  var isOpen = false;
  var iframeLoaded = false;

  function buildWidgetUrl() {
    var params = new URLSearchParams({ dealer: dealer });
    if (config.branch) params.set('branchCode', config.branch);
    return WIDGET_URL + '/?' + params.toString();
  }

  // Track widget opens for unique click / engagement analytics
  function trackWidgetOpened() {
    try {
      if (window.mixpanel && typeof window.mixpanel.track === 'function') {
        window.mixpanel.track('Widget Opened', { dealer: dealer });
      }
    } catch (e) {
      // fail silently — analytics should never break the widget
    }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;

    trackWidgetOpened();

    // Lazy-load iframe on first open
    if (!iframeLoaded) {
      iframe.src = buildWidgetUrl();
      iframeLoaded = true;
    }

    backdrop.classList.add('ew-open');
    modal.classList.add('ew-open');
    fab.style.display = 'none';

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        backdrop.classList.add('ew-visible');
        modal.classList.add('ew-visible');
      });
    });

    document.addEventListener('keydown', onKeyDown);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    backdrop.classList.remove('ew-visible');
    modal.classList.remove('ew-visible');
    fab.style.display = '';

    setTimeout(function () {
      backdrop.classList.remove('ew-open');
      modal.classList.remove('ew-open');
    }, 300);

    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') close();
  }

  fab.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.EfficientWidget.open  = open;
  window.EfficientWidget.close = close;

})();
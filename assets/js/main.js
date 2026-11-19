/* ==========================================================================
   u18ok H5 首页 — 交互 / main.js
   两件事，都是源站那种「无人值守」的动效：
     1) 优惠活动：一次一张，每 3 秒自动切下一张；指示点联动，可点、可拖/滑
     2) 游戏分类：横向无缝循环慢滚（复制一份内容 + translateX(-50% - gap/2)）
   无依赖、无构建，<script defer> 直接引入。
   ========================================================================== */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
     1. 优惠活动轮播
     ---------------------------------------------------------------------- */
  var offers = document.querySelector('.offers');
  if (offers) {
    var track = offers.querySelector('.offers__track');
    var slides = track ? Array.prototype.slice.call(track.children) : [];
    var dots = Array.prototype.slice.call(offers.querySelectorAll('.offers__dot'));
    var INTERVAL = 1500; // 1.5 秒一张
    var index = 0;
    var timer = null;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var syncDots = function () {
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === index);
        dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
    };

    var goTo = function (i, behavior) {
      if (!slides.length) return;
      index = (i + slides.length) % slides.length;
      track.scrollTo({
        left: index * track.clientWidth,
        behavior: behavior === false ? 'auto' : 'smooth'
      });
      syncDots();
    };

    // 手动滑动后同步指示点
    var raf = null;
    track.addEventListener('scroll', function () {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        var i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== index && i >= 0 && i < slides.length) { index = i; syncDots(); }
      });
    }, { passive: true });

    var stopAuto = function () { if (timer) { clearInterval(timer); timer = null; } };
    var startAuto = function () {
      stopAuto();
      if (reduceMotion) return;
      timer = setInterval(function () { goTo(index + 1); }, INTERVAL);
    };

    // 鼠标拖拽（触屏走原生滚动，不拦截）
    var dragging = false, startX = 0, startLeft = 0, moved = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') { stopAuto(); return; }
      dragging = true;
      moved = false;
      startX = e.clientX;
      startLeft = track.scrollLeft;
      track.classList.add('is-dragging');
      track.setPointerCapture && track.setPointerCapture(e.pointerId);
      stopAuto();
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startLeft - dx;
    });
    var endDrag = function () {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      goTo(Math.round(track.scrollLeft / track.clientWidth));
      startAuto();
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    // 阻止链接的原生拖拽，否则拖到一半会被浏览器接管
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });
    // 拖完别顺手触发卡片跳转
    track.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);

    // 鼠标悬停暂停、移开继续
    offers.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') stopAuto(); });
    offers.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') startAuto(); });

    // 点指示点直接跳
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); startAuto(); });
    });

    // 视口变化后重新对齐（旋转屏幕 / 桌面缩放）
    window.addEventListener('resize', function () { goTo(index, false); });

    goTo(0, false);
    startAuto();
  }

  /* ----------------------------------------------------------------------
     2. 游戏分类：横向无缝循环
     ---------------------------------------------------------------------- */
  var tracks = Array.prototype.slice.call(document.querySelectorAll('.marquee__track'));
  tracks.forEach(function (marqueeTrack) {
    var items = Array.prototype.slice.call(marqueeTrack.children);
    if (items.length === 0) return;

    // 复制一份：内容会被无限循环使用，副本对读屏和 Tab 焦点隐藏
    var fragment = document.createDocumentFragment();
    items.forEach(function (node) {
      var copy = node.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.setAttribute('tabindex', '-1');
      fragment.appendChild(copy);
    });
    marqueeTrack.appendChild(fragment);

    // 半条轨道 ≈ 一份内容的宽度；按恒速算周期（data-speed = px/s）
    var halfWidth = marqueeTrack.scrollWidth / 2;
    var speed = parseFloat(marqueeTrack.getAttribute('data-speed')) || 26;
    var cycle = Math.max(12, halfWidth / speed);
    marqueeTrack.style.setProperty('--cycle', cycle.toFixed(1) + 's');

    // 先量宽再起动画，避免首帧跳变
    requestAnimationFrame(function () { marqueeTrack.classList.add('is-animated'); });
  });

  /* ----------------------------------------------------------------------
     3. 活动抽屉：点底部「活动」从下方推上来，内容是优惠活动的竖排列表
        —— 卡片不在 HTML 里重复写，直接从首页轮播轨道拷贝过来
     ---------------------------------------------------------------------- */
  var drawer = document.getElementById('offersDrawer');
  var triggers = document.querySelectorAll('[data-drawer-open]');

  if (drawer && triggers.length) {
    var sheet = drawer.querySelector('.drawer__sheet');
    var list = drawer.querySelector('[data-drawer-list]');
    var lastFocus = null;
    var closeTimer = null;

    // 把轮播里的卡片拷一份进抽屉（只拷一次）
    var carousel = document.querySelector('.offers__track');
    if (list && carousel && list.children.length === 0) {
      Array.prototype.slice.call(carousel.children).forEach(function (node) {
        var copy = node.cloneNode(true);
        copy.removeAttribute('aria-hidden');
        copy.removeAttribute('tabindex');
        list.appendChild(copy);
      });
    }

    var openDrawer = function (trigger) {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      lastFocus = trigger || document.activeElement;
      drawer.hidden = false;
      // 强制回流，保证 transition 生效
      void drawer.offsetHeight;
      drawer.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      var closeBtn = drawer.querySelector('.drawer__close');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    };

    var closeDrawer = function () {
      drawer.classList.remove('is-open');
      document.body.style.overflow = '';
      closeTimer = setTimeout(function () {
        drawer.hidden = true;
        closeTimer = null;
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      }, 340);
    };

    Array.prototype.forEach.call(triggers, function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        if (drawer.classList.contains('is-open')) { closeDrawer(); return; }
        openDrawer(trigger);
      });
    });

    Array.prototype.forEach.call(drawer.querySelectorAll('[data-drawer-close]'), function (el) {
      el.addEventListener('click', closeDrawer);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
    });

    // 点卡片里的链接后自动收起，避免遮挡下一页
    if (list) {
      list.addEventListener('click', function (e) {
        if (e.target.closest('a')) closeDrawer();
      });
    }

    // 抽屉打开时，点遮罩以上的区域不穿透滚动
    if (sheet) {
      sheet.addEventListener('touchmove', function (e) { e.stopPropagation(); }, { passive: true });
    }
  }
})();

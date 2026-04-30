import { NODE_W, NODE_H } from "./config.js";

export function createViewportController(layout) {
  var transform = { x: 0, y: 0, scale: 1 };
  var dragging = false;
  var dragStart = null;

  function apply() {
    var viewport = document.getElementById("tree-viewport");
    if (!viewport) {
      return;
    }
    viewport.setAttribute(
      "transform",
      "translate(" + transform.x + "," + transform.y + ") scale(" + transform.scale + ")"
    );
  }

  function zoom(factor, cx, cy) {
    var wrapper = document.getElementById("tree-wrapper");
    if (!wrapper) {
      return;
    }
    var rect = wrapper.getBoundingClientRect();
    var mouseX = cx !== undefined ? cx : rect.width / 2;
    var mouseY = cy !== undefined ? cy : rect.height / 2;
    var nextScale = Math.max(0.15, Math.min(3, transform.scale * factor));
    var ratio = nextScale / transform.scale;

    transform.x = mouseX - ratio * (mouseX - transform.x);
    transform.y = mouseY - ratio * (mouseY - transform.y);
    transform.scale = nextScale;
    apply();
  }

  function fitAll() {
    var ids = Object.keys(layout.pos || {});
    if (!ids.length) {
      return;
    }

    var xs = ids.map(function (id) { return layout.pos[id].x; });
    var ys = ids.map(function (id) { return layout.pos[id].y; });
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs) + NODE_W;
    var minY = Math.min.apply(null, ys);
    var maxY = Math.max.apply(null, ys) + NODE_H;

    var wrapper = document.getElementById("tree-wrapper");
    if (!wrapper) {
      return;
    }
    var width = wrapper.clientWidth;
    var height = wrapper.clientHeight;
    var padding = 48;
    var scaleX = (width - padding * 2) / Math.max(1, (maxX - minX));
    var scaleY = (height - padding * 2) / Math.max(1, (maxY - minY));

    transform.scale = Math.min(scaleX, scaleY, 1.2);
    transform.x = width / 2 - (minX + (maxX - minX) / 2) * transform.scale;
    transform.y = height / 2 - (minY + (maxY - minY) / 2) * transform.scale;
    apply();
  }

  function centerOn(personId) {
    var point = layout.pos[personId];
    var wrapper = document.getElementById("tree-wrapper");
    if (!point || !wrapper) {
      return;
    }
    transform.x = wrapper.clientWidth / 2 - (point.x + NODE_W / 2) * transform.scale;
    transform.y = wrapper.clientHeight / 2 - (point.y + NODE_H / 2) * transform.scale;
    apply();
  }

  function bind() {
    var wrapper = document.getElementById("tree-wrapper");
    if (!wrapper) {
      return;
    }

    wrapper.addEventListener("mousedown", function (event) {
      if (event.target.closest(".tree-node-card, .tree-union-diamond")) {
        return;
      }
      dragging = true;
      dragStart = {
        x: event.clientX - transform.x,
        y: event.clientY - transform.y
      };
    });

    window.addEventListener("mousemove", function (event) {
      if (!dragging || !dragStart) {
        return;
      }
      transform.x = event.clientX - dragStart.x;
      transform.y = event.clientY - dragStart.y;
      apply();
    });

    window.addEventListener("mouseup", function () {
      dragging = false;
      dragStart = null;
    });

    wrapper.addEventListener("wheel", function (event) {
      event.preventDefault();
      var rect = wrapper.getBoundingClientRect();
      zoom(event.deltaY < 0 ? 1.1 : 0.9, event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });

    var lastTouch = null;
    wrapper.addEventListener("touchstart", function (event) {
      if (event.touches.length === 1) {
        lastTouch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }
    }, { passive: true });

    wrapper.addEventListener("touchmove", function (event) {
      if (event.touches.length !== 1 || !lastTouch) {
        return;
      }
      var dx = event.touches[0].clientX - lastTouch.x;
      var dy = event.touches[0].clientY - lastTouch.y;
      transform.x += dx;
      transform.y += dy;
      lastTouch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      apply();
    }, { passive: true });

    wrapper.addEventListener("touchend", function () {
      lastTouch = null;
    }, { passive: true });

    var zoomIn = document.getElementById("btn-zoom-in");
    var zoomOut = document.getElementById("btn-zoom-out");
    var fitBtn = document.getElementById("btn-fit");

    if (zoomIn) {
      zoomIn.addEventListener("click", function () { zoom(1.15); });
    }
    if (zoomOut) {
      zoomOut.addEventListener("click", function () { zoom(1 / 1.15); });
    }
    if (fitBtn) {
      fitBtn.addEventListener("click", fitAll);
    }
  }

  return {
    bind: bind,
    fitAll: fitAll,
    centerOn: centerOn
  };
}

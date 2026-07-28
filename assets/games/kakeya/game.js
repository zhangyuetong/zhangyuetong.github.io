(function () {
  "use strict";

  var canvas = document.getElementById("board");
  var ctx = canvas.getContext("2d");
  var areaEl = document.getElementById("area");
  var progressEl = document.getElementById("progress");
  var bestEl = document.getElementById("best");
  var overlayEl = document.getElementById("overlay");
  var completeEl = document.getElementById("complete");
  var finalKappaEl = document.getElementById("final-kappa");
  var compareMsgEl = document.getElementById("compare-msg");
  var recordMsgEl = document.getElementById("record-msg");
  var startBtn = document.getElementById("start-btn");
  var retryBtn = document.getElementById("retry-btn");

  var ANGLE_BINS = 180;
  var GRID_CELL = 1;
  var STICK_WIDTH = 6;
  var STORAGE_KEY = "kakeya-best-kappa";
  var LEGACY_STORAGE_KEY = "kakeya-best-area";

  var KAPPA_DELTOID = Math.PI / 8;
  var KAPPA_SEMICIRCLE = Math.PI / 4;

  var width = 0;
  var height = 0;
  var stickLength = 120;
  var gridCols = 0;
  var gridRows = 0;
  var grid = null;
  var sweepCanvas = null;
  var sweepCtx = null;

  var pointers = new Map();
  var angleVisited = new Uint8Array(ANGLE_BINS);
  var visitedCount = 0;
  var sweptCells = 0;
  var playing = false;
  var completed = false;

  var stick = {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    angle: 0
  };

  var prevStick = null;

  function normalizeDirected(angle) {
    return ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  }

  function toUndirected(angle) {
    var directed = normalizeDirected(angle);
    if (directed >= Math.PI) {
      directed -= Math.PI;
    }
    return directed;
  }

  function loadBest() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      var value = parseFloat(raw);
      if (isFinite(value)) {
        return value;
      }
    }

    var legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw !== null && stickLength > 0) {
      var legacyArea = parseFloat(legacyRaw);
      if (isFinite(legacyArea)) {
        var migrated = legacyArea / (stickLength * stickLength);
        saveBest(migrated);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      }
    }

    return null;
  }

  function saveBest(value) {
    localStorage.setItem(STORAGE_KEY, String(value));
  }

  function formatKappa(value) {
    return value.toFixed(2);
  }

  function areaCoefficient() {
    if (stickLength <= 0) {
      return 0;
    }
    return currentArea() / (stickLength * stickLength);
  }

  function updateBestDisplay() {
    var best = loadBest();
    bestEl.textContent = best === null ? "—" : formatKappa(best);
  }

  function updateScoreDisplay() {
    areaEl.textContent = formatKappa(areaCoefficient());
    progressEl.textContent = Math.round((visitedCount / ANGLE_BINS) * 100) + "%";
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    stickLength = Math.min(width, height) * 0.28;

    gridCols = Math.ceil(width / GRID_CELL);
    gridRows = Math.ceil(height / GRID_CELL);

    sweepCanvas = document.createElement("canvas");
    sweepCanvas.width = gridCols;
    sweepCanvas.height = gridRows;
    sweepCtx = sweepCanvas.getContext("2d");

    resetSession(false);
  }

  function resetSession(keepPlaying) {
    grid = new Uint8Array(gridCols * gridRows);
    angleVisited.fill(0);
    visitedCount = 0;
    sweptCells = 0;
    completed = false;
    prevStick = null;

    sweepCtx.clearRect(0, 0, gridCols, gridRows);

    var cx = width / 2;
    var cy = height / 2;
    stick.x1 = cx - stickLength / 2;
    stick.y1 = cy;
    stick.x2 = cx + stickLength / 2;
    stick.y2 = cy;
    stick.angle = 0;

    updateScoreDisplay();

    if (!keepPlaying) {
      playing = false;
      overlayEl.classList.remove("hidden");
      completeEl.classList.add("hidden");
    } else {
      playing = true;
      overlayEl.classList.add("hidden");
      completeEl.classList.add("hidden");
    }
  }

  function gridIndex(col, row) {
    return row * gridCols + col;
  }

  function markCell(col, row) {
    if (col < 0 || row < 0 || col >= gridCols || row >= gridRows) {
      return;
    }
    var idx = gridIndex(col, row);
    if (grid[idx] === 0) {
      grid[idx] = 1;
      sweptCells += 1;
      sweepCtx.fillStyle = "#38bdf8";
      sweepCtx.fillRect(col, row, 1, 1);
    }
  }

  function markDisc(cx, cy, radius) {
    var minCol = Math.max(0, Math.floor(cx - radius));
    var maxCol = Math.min(gridCols - 1, Math.floor(cx + radius));
    var minRow = Math.max(0, Math.floor(cy - radius));
    var maxRow = Math.min(gridRows - 1, Math.floor(cy + radius));
    var radiusSq = radius * radius;

    for (var row = minRow; row <= maxRow; row++) {
      for (var col = minCol; col <= maxCol; col++) {
        var dx = col + 0.5 - cx;
        var dy = row + 0.5 - cy;
        if (dx * dx + dy * dy <= radiusSq) {
          markCell(col, row);
        }
      }
    }
  }

  function markSegment(x1, y1, x2, y2, widthPx) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.hypot(dx, dy);
    if (len < 0.001) {
      markDisc(x1, y1, widthPx / 2);
      return;
    }

    var steps = Math.max(2, Math.ceil(len / 0.5));
    var half = widthPx / 2;

    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      markDisc(x1 + dx * t, y1 + dy * t, half);
    }
  }

  function markStickSweep(from, to) {
    if (from) {
      markSegment(from.x1, from.y1, from.x2, from.y2, STICK_WIDTH);
    }
    markSegment(to.x1, to.y1, to.x2, to.y2, STICK_WIDTH);
  }

  function markAngleBin(angle) {
    var undirected = toUndirected(angle);
    var bin = Math.min(
      ANGLE_BINS - 1,
      Math.floor((undirected / Math.PI) * ANGLE_BINS)
    );
    if (angleVisited[bin] === 0) {
      angleVisited[bin] = 1;
      visitedCount += 1;
    }
  }

  function markAngleArc(fromDirected, toDirected) {
    var from = normalizeDirected(fromDirected);
    var to = normalizeDirected(toDirected);
    var delta = to - from;

    if (delta > Math.PI) {
      delta -= Math.PI * 2;
    } else if (delta < -Math.PI) {
      delta += Math.PI * 2;
    }

    var step = Math.PI / ANGLE_BINS / 2;
    var steps = Math.max(1, Math.ceil(Math.abs(delta) / step));

    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      markAngleBin(from + delta * t);
    }
  }

  function currentArea() {
    return sweptCells * GRID_CELL * GRID_CELL;
  }

  function compareMessage(kappa) {
    if (kappa < KAPPA_DELTOID) {
      return "超越凸 Kakeya 最优！";
    }
    if (kappa < KAPPA_SEMICIRCLE) {
      return "接近经典 deltoid 构造，继续优化！";
    }
    return "面积大于定点半圆旋转，试试更紧凑的路径。";
  }

  function highlightCompareRow(kappa) {
    var rows = document.querySelectorAll(".compare-row");
    rows.forEach(function (row) {
      row.classList.remove("compare-row--highlight");
    });

    var targetId = "compare-semicircle";
    if (kappa < KAPPA_SEMICIRCLE) {
      targetId = "compare-deltoid";
    }

    var target = document.getElementById(targetId);
    if (target) {
      target.classList.add("compare-row--highlight");
    }
  }

  function updateStickFromPointers() {
    if (pointers.size < 2) {
      return false;
    }

    var pts = Array.from(pointers.values());
    var mx = (pts[0].x + pts[1].x) / 2;
    var my = (pts[0].y + pts[1].y) / 2;
    var angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    var half = stickLength / 2;

    prevStick = {
      x1: stick.x1,
      y1: stick.y1,
      x2: stick.x2,
      y2: stick.y2,
      angle: stick.angle
    };

    stick.x1 = mx - Math.cos(angle) * half;
    stick.y1 = my - Math.sin(angle) * half;
    stick.x2 = mx + Math.cos(angle) * half;
    stick.y2 = my + Math.sin(angle) * half;
    stick.angle = angle;

    markStickSweep(prevStick, stick);
    markAngleArc(prevStick.angle, stick.angle);

    updateScoreDisplay();

    if (!completed && visitedCount >= ANGLE_BINS) {
      finishRound();
    }

    return true;
  }

  function finishRound() {
    completed = true;
    playing = false;

    var kappa = areaCoefficient();
    finalKappaEl.textContent = formatKappa(kappa);
    compareMsgEl.textContent = compareMessage(kappa);
    highlightCompareRow(kappa);

    var best = loadBest();
    var isRecord = best === null || kappa < best;
    if (isRecord) {
      saveBest(kappa);
      updateBestDisplay();
      recordMsgEl.classList.remove("hidden");
    } else {
      recordMsgEl.classList.add("hidden");
    }

    completeEl.classList.remove("hidden");
  }

  function render() {
    ctx.fillStyle = "#0c0f16";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.drawImage(sweepCanvas, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = STICK_WIDTH;
    ctx.strokeStyle = "#38bdf8";
    ctx.shadowColor = "rgba(56, 189, 248, 0.55)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(stick.x1, stick.y1);
    ctx.lineTo(stick.x2, stick.y2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#7dd3fc";
    ctx.beginPath();
    ctx.arc(stick.x1, stick.y1, 7, 0, Math.PI * 2);
    ctx.arc(stick.x2, stick.y2, 7, 0, Math.PI * 2);
    ctx.fill();

    if (playing && pointers.size < 2) {
      ctx.fillStyle = "rgba(12, 15, 22, 0.55)";
      ctx.fillRect(0, height - 52, width, 52);
      ctx.fillStyle = "#8b97b8";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("请用两根手指按住屏幕", width / 2, height - 22);
    }

    requestAnimationFrame(render);
  }

  function pointerDown(event) {
    if (!playing || completed) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    updateStickFromPointers();
    event.preventDefault();
  }

  function pointerMove(event) {
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    updateStickFromPointers();
    event.preventDefault();
  }

  function pointerUp(event) {
    pointers.delete(event.pointerId);
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch (err) {
      // ignore
    }
    event.preventDefault();
  }

  startBtn.addEventListener("click", function () {
    resetSession(true);
  });

  retryBtn.addEventListener("click", function () {
    resetSession(true);
  });

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  window.addEventListener("resize", resize);

  updateBestDisplay();
  resize();
  render();
})();

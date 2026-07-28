(function () {
  "use strict";

  var canvas = document.getElementById("board");
  var ctx = canvas.getContext("2d");
  var areaEl = document.getElementById("area");
  var progressEl = document.getElementById("progress");
  var bestEl = document.getElementById("best");
  var overlayEl = document.getElementById("overlay");
  var completeEl = document.getElementById("complete");
  var finalAreaEl = document.getElementById("final-area");
  var recordMsgEl = document.getElementById("record-msg");
  var startBtn = document.getElementById("start-btn");
  var retryBtn = document.getElementById("retry-btn");

  var ANGLE_BINS = 360;
  var GRID_CELL = 3;
  var STICK_WIDTH = 6;
  var STORAGE_KEY = "kakeya-best-area";

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

  function loadBest() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    var value = parseFloat(raw);
    return isFinite(value) ? value : null;
  }

  function saveBest(value) {
    localStorage.setItem(STORAGE_KEY, String(value));
  }

  function formatArea(value) {
    return value.toFixed(1);
  }

  function updateBestDisplay() {
    var best = loadBest();
    bestEl.textContent = best === null ? "—" : formatArea(best);
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

    areaEl.textContent = "0";
    progressEl.textContent = "0%";

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

  function markDisc(cx, cy, radius) {
    var minCol = Math.max(0, Math.floor((cx - radius) / GRID_CELL));
    var maxCol = Math.min(gridCols - 1, Math.floor((cx + radius) / GRID_CELL));
    var minRow = Math.max(0, Math.floor((cy - radius) / GRID_CELL));
    var maxRow = Math.min(gridRows - 1, Math.floor((cy + radius) / GRID_CELL));
    var radiusSq = radius * radius;

    for (var row = minRow; row <= maxRow; row++) {
      for (var col = minCol; col <= maxCol; col++) {
        var px = (col + 0.5) * GRID_CELL;
        var py = (row + 0.5) * GRID_CELL;
        var dx = px - cx;
        var dy = py - cy;
        if (dx * dx + dy * dy > radiusSq) {
          continue;
        }
        var idx = gridIndex(col, row);
        if (grid[idx] === 0) {
          grid[idx] = 1;
          sweptCells += 1;
          sweepCtx.fillStyle = "#fff";
          sweepCtx.fillRect(col, row, 1, 1);
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

    var steps = Math.max(2, Math.ceil(len / (GRID_CELL * 0.5)));
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

  function markAngle(angle) {
    var normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    var bin = Math.floor((normalized / (Math.PI * 2)) * ANGLE_BINS) % ANGLE_BINS;
    if (angleVisited[bin] === 0) {
      angleVisited[bin] = 1;
      visitedCount += 1;
    }
  }

  function currentArea() {
    return sweptCells * GRID_CELL * GRID_CELL;
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
    markAngle(angle);

    areaEl.textContent = formatArea(currentArea());
    progressEl.textContent = Math.round((visitedCount / ANGLE_BINS) * 100) + "%";

    if (!completed && visitedCount >= ANGLE_BINS) {
      finishRound();
    }

    return true;
  }

  function finishRound() {
    completed = true;
    playing = false;

    var area = currentArea();
    finalAreaEl.textContent = formatArea(area);

    var best = loadBest();
    var isRecord = best === null || area < best;
    if (isRecord) {
      saveBest(area);
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
    ctx.globalAlpha = 0.35;
    ctx.drawImage(sweepCanvas, 0, 0, gridCols, gridRows, 0, 0, width, height);
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

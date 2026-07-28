(function () {
  "use strict";

  var canvas = document.getElementById("board");
  var ctx = canvas.getContext("2d");
  var scoreEl = document.getElementById("score");

  var gridSize = 20;
  var tileCount = canvas.width / gridSize;
  var snake = [{ x: 10, y: 10 }];
  var velocity = { x: 0, y: 0 };
  var food = spawnFood();
  var score = 0;
  var gameOver = false;

  function spawnFood() {
    return {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  }

  function resetGame() {
    snake = [{ x: 10, y: 10 }];
    velocity = { x: 0, y: 0 };
    food = spawnFood();
    score = 0;
    gameOver = false;
    scoreEl.textContent = String(score);
  }

  function drawCell(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * gridSize, y * gridSize, gridSize - 1, gridSize - 1);
  }

  function update() {
    if (gameOver) {
      return;
    }

    if (velocity.x === 0 && velocity.y === 0) {
      return;
    }

    var head = {
      x: snake[0].x + velocity.x,
      y: snake[0].y + velocity.y
    };

    if (
      head.x < 0 ||
      head.y < 0 ||
      head.x >= tileCount ||
      head.y >= tileCount
    ) {
      gameOver = true;
      return;
    }

    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        gameOver = true;
        return;
      }
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 1;
      scoreEl.textContent = String(score);
      food = spawnFood();
    } else {
      snake.pop();
    }
  }

  function render() {
    ctx.fillStyle = "#1a2030";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawCell(food.x, food.y, "#f06543");

    for (var i = 0; i < snake.length; i++) {
      drawCell(snake[i].x, snake[i].y, i === 0 ? "#6ee7b7" : "#34d399");
    }

    if (gameOver) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2);
      ctx.font = "14px sans-serif";
      ctx.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 28);
    }
  }

  function tick() {
    update();
    render();
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "ArrowUp" && velocity.y !== 1) {
      velocity = { x: 0, y: -1 };
    } else if (event.key === "ArrowDown" && velocity.y !== -1) {
      velocity = { x: 0, y: 1 };
    } else if (event.key === "ArrowLeft" && velocity.x !== 1) {
      velocity = { x: -1, y: 0 };
    } else if (event.key === "ArrowRight" && velocity.x !== -1) {
      velocity = { x: 1, y: 0 };
    } else if (event.key === "r" || event.key === "R") {
      resetGame();
    }
  });

  setInterval(tick, 120);
  render();
})();

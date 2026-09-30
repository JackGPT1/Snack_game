import { useEffect, useRef, useState, useCallback } from 'react';

// ===== 遊戲常數 =====
const GRID_SIZE = 20;       // 網格數量（20x20）
const CELL_SIZE = 20;       // 每格的像素大小
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE; // 400x400
const GAME_SPEED = 150;     // 遊戲速度（毫秒），越小越快

// 方向常數
const DIRECTIONS = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
} as const;

type Direction = typeof DIRECTIONS[keyof typeof DIRECTIONS];
type GameStatus = 'idle' | 'playing' | 'gameover';

interface Position {
  x: number;
  y: number;
}

// ===== 輔助函式 =====

// 取得反方向（用於防止蛇反向）
function getOppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case 'up': return 'down';
    case 'down': return 'up';
    case 'left': return 'right';
    case 'right': return 'left';
  }
}

// 根據方向計算新座標
function moveInDirection(head: Position, dir: Direction): Position {
  switch (dir) {
    case 'up':    return { x: head.x, y: head.y - 1 };
    case 'down':  return { x: head.x, y: head.y + 1 };
    case 'left':  return { x: head.x - 1, y: head.y };
    case 'right': return { x: head.x + 1, y: head.y };
  }
}

// 生成隨機食物位置（不能和蛇重疊）
function generateFood(snake: Position[]): Position {
  let food: Position;
  do {
    food = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(seg => seg.x === food.x && seg.y === food.y));
  return food;
}

// ===== 主元件 =====
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [highScore, setHighScore] = useState(0);

  // 使用 ref 來儲存遊戲狀態（避免 setInterval 的閉包問題）
  const snakeRef = useRef<Position[]>([]);
  const directionRef = useRef<Direction>(DIRECTIONS.RIGHT);
  const nextDirectionRef = useRef<Direction>(DIRECTIONS.RIGHT);
  const foodRef = useRef<Position>({ x: 10, y: 10 });
  const intervalRef = useRef<number | null>(null);
  const gameStatusRef = useRef<GameStatus>('idle');
  const scoreRef = useRef<number>(0); // 用 ref 追蹤分數，避免閉包問題

  // ===== 繪圖函式 =====
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清除畫布
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 繪製網格線（淡淡的，幫助視覺）
    ctx.strokeStyle = '#16213e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // 繪製食物（紅色圓形）
    const food = foodRef.current;
    ctx.fillStyle = '#e94560';
    ctx.shadowColor = '#e94560';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // 繪製蛇
    const snake = snakeRef.current;
    snake.forEach((segment, index) => {
      if (index === 0) {
        // 蛇頭：亮綠色
        ctx.fillStyle = '#4ecca3';
        ctx.shadowColor = '#4ecca3';
        ctx.shadowBlur = 6;
      } else {
        // 蛇身：漸層綠色
        const alpha = 1 - (index / snake.length) * 0.4;
        ctx.fillStyle = `rgba(78, 204, 163, ${alpha})`;
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      );

      // 蛇頭加上眼睛
      if (index === 0) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        const centerX = segment.x * CELL_SIZE + CELL_SIZE / 2;
        const centerY = segment.y * CELL_SIZE + CELL_SIZE / 2;
        const dir = directionRef.current;
        
        let eye1X = centerX, eye1Y = centerY;
        let eye2X = centerX, eye2Y = centerY;

        switch (dir) {
          case 'up':
            eye1X = centerX - 4; eye1Y = centerY - 3;
            eye2X = centerX + 4; eye2Y = centerY - 3;
            break;
          case 'down':
            eye1X = centerX - 4; eye1Y = centerY + 3;
            eye2X = centerX + 4; eye2Y = centerY + 3;
            break;
          case 'left':
            eye1X = centerX - 3; eye1Y = centerY - 4;
            eye2X = centerX - 3; eye2Y = centerY + 4;
            break;
          case 'right':
            eye1X = centerX + 3; eye1Y = centerY - 4;
            eye2X = centerX + 3; eye2Y = centerY + 4;
            break;
        }

        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 如果遊戲尚未開始，顯示提示文字
    if (gameStatusRef.current === 'idle') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐍 貪食蛇', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);
      ctx.font = '14px sans-serif';
      ctx.fillText('點擊「開始遊戲」按鈕', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 10);
      ctx.fillText('使用方向鍵或 WASD 控制', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 35);
    }

    // 如果遊戲結束，顯示 Game Over
    if (gameStatusRef.current === 'gameover') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = '#e94560';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('遊戲結束', CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px sans-serif';
      ctx.fillText(`分數：${scoreRef.current}`, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 15);
      ctx.font = '13px sans-serif';
      ctx.fillText('點擊「重新開始」再試一次', CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 45);
    }
  }, []);

  // ===== 遊戲更新函式（每幀執行） =====
  const update = useCallback(() => {
    // 1. 更新方向
    directionRef.current = nextDirectionRef.current;

    // 2. 計算蛇頭新位置
    const head = snakeRef.current[0];
    const newHead = moveInDirection(head, directionRef.current);

    // 3. 碰撞偵測 - 牆壁
    if (
      newHead.x < 0 ||
      newHead.x >= GRID_SIZE ||
      newHead.y < 0 ||
      newHead.y >= GRID_SIZE
    ) {
      gameStatusRef.current = 'gameover';
      setGameStatus('gameover');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setHighScore(prev => Math.max(prev, scoreRef.current));
      draw();
      return;
    }

    // 4. 碰撞偵測 - 自身
    if (snakeRef.current.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
      gameStatusRef.current = 'gameover';
      setGameStatus('gameover');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setHighScore(prev => Math.max(prev, scoreRef.current));
      draw();
      return;
    }

    // 5. 將新蛇頭加入陣列開頭
    snakeRef.current = [newHead, ...snakeRef.current];

    // 6. 檢查是否吃到食物
    const food = foodRef.current;
    if (newHead.x === food.x && newHead.y === food.y) {
      // 吃到食物：加分、生成新食物、不移除蛇尾
      scoreRef.current = snakeRef.current.length - 3; // 初始長度為 3
      setScore(scoreRef.current);
      foodRef.current = generateFood(snakeRef.current);
    } else {
      // 沒吃到食物：移除蛇尾（蛇保持原長度）
      snakeRef.current.pop();
    }

    // 7. 重新繪製畫面
    draw();
  }, [draw]);

  // ===== 初始化遊戲狀態 =====
  const initGame = useCallback(() => {
    // 初始蛇的位置（畫面中央，長度 3）
    const centerX = Math.floor(GRID_SIZE / 2);
    const centerY = Math.floor(GRID_SIZE / 2);
    snakeRef.current = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];
    directionRef.current = DIRECTIONS.RIGHT;
    nextDirectionRef.current = DIRECTIONS.RIGHT;
    foodRef.current = generateFood(snakeRef.current);
    scoreRef.current = 0;
    setScore(0);
    gameStatusRef.current = 'playing';
    setGameStatus('playing');
    draw();
  }, [draw]);

  // ===== 開始遊戲 =====
  const startGame = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    initGame();
    intervalRef.current = window.setInterval(update, GAME_SPEED);
  }, [initGame, update]);

  // ===== 重新開始遊戲 =====
  const restartGame = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    initGame();
    intervalRef.current = window.setInterval(update, GAME_SPEED);
  }, [initGame, update]);

  // ===== 鍵盤事件處理 =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果遊戲未開始，按方向鍵也可以開始
      if (gameStatusRef.current === 'idle') {
        const directionKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
        if (directionKeys.includes(e.key)) {
          startGame();
          return;
        }
      }

      // 遊戲結束時不處理方向鍵
      if (gameStatusRef.current === 'gameover') return;

      let newDirection: Direction | null = null;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          newDirection = DIRECTIONS.UP;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          newDirection = DIRECTIONS.DOWN;
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          newDirection = DIRECTIONS.LEFT;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          newDirection = DIRECTIONS.RIGHT;
          break;
      }

      // 防止反向移動
      if (newDirection && newDirection !== getOppositeDirection(directionRef.current)) {
        nextDirectionRef.current = newDirection;
      }

      // 防止方向鍵滾動頁面
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [startGame]);

  // ===== 初始繪製（顯示開始畫面） =====
  useEffect(() => {
    const centerX = Math.floor(GRID_SIZE / 2);
    const centerY = Math.floor(GRID_SIZE / 2);
    snakeRef.current = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];
    foodRef.current = generateFood(snakeRef.current);
    draw();
  }, [draw]);

  // ===== 清理 interval =====
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="game-container">
      <h1 className="game-title">🐍 貪食蛇遊戲</h1>

      <div className="score-board">
        <div className="score-item">
          <span className="score-label">目前分數</span>
          <span className="score-value">{score}</span>
        </div>
        <div className="score-item">
          <span className="score-label">最高分</span>
          <span className="score-value">{highScore}</span>
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="game-canvas"
        />
      </div>

      <div className="controls">
        {gameStatus === 'idle' && (
          <button className="btn btn-start" onClick={startGame}>
            🎮 開始遊戲
          </button>
        )}
        {gameStatus === 'playing' && (
          <button className="btn btn-restart" onClick={restartGame}>
            🔄 重新開始
          </button>
        )}
        {gameStatus === 'gameover' && (
          <button className="btn btn-restart" onClick={restartGame}>
            🔁 重新開始
          </button>
        )}
      </div>

      <div className="instructions">
        <p><strong>操作說明：</strong></p>
        <p>使用 <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> 或 <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> 控制蛇的移動方向</p>
        <p>吃到紅色食物可以加分並增長蛇身</p>
        <p>撞到牆壁或自己就會遊戲結束</p>
      </div>
    </div>
  );
}

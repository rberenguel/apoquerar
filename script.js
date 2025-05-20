const customAlertModal = document.getElementById("customAlertModal");
const customAlertMessage = document.getElementById("customAlertMessage");
const customAlertCloseButton = document.getElementById(
  "customAlertCloseButton",
);
const helpButton = document.getElementById("helpButton");
const helpModal = document.getElementById("helpModal");
const helpModalCloseButton = document.getElementById("helpModalCloseButton");
const helpContentDiv = document.getElementById("helpContent");
function showAlert(message) {
  customAlertMessage.textContent = message;
  customAlertModal.style.display = "flex";
}
customAlertCloseButton.onclick = function () {
  customAlertModal.style.display = "none";
};
window.onclick = function (event) {
  if (event.target == customAlertModal) {
    customAlertModal.style.display = "none";
  }
};

const localStore = {
  async get(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : undefined;
    } catch (e) {
      console.error("LS Error get:", e);
      return undefined;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("LS Error set:", e);
    }
  },
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameMessagesArea = document.getElementById("gameMessagesArea");
const highScoresDiv = document.getElementById("highScores");

const SUITS = ["H", "D", "C", "S"];
const RANKS = ["6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const RANK_VALUES = {
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const GRID_SIZE = 4;
const CELL_HEIGHT_BASE_DESIGN = 120;
const CELL_WIDTH_BASE_DESIGN = CELL_HEIGHT_BASE_DESIGN * (2 / 3);
const CARD_V_PADDING_BASE_DESIGN = 10;

let CELL_HEIGHT = 0;
let CELL_WIDTH = 0;
let CARD_HEIGHT = 0;
let CARD_WIDTH = 0;
let CARD_V_PADDING = 0;

let GRID_PADDING = 15;
let GRID_TOTAL_WIDTH = 0;
let GRID_TOTAL_HEIGHT = 0;
let GRID_OFFSET_X = 0;
let GRID_OFFSET_Y = 0; // Will be calculated after top score area

let TOP_SCORE_AREA_HEIGHT = 0; // For Corners and Potential Discard scores

let HAND_CARD_SPACING = 7;
let HAND_AREA_WIDTH = 0;
let HAND_OFFSET_X = 0;
let HAND_OFFSET_Y = 0;

let DISCARD_PILE_OFFSET_Y = 0;
let DISCARD_CARD_SPACING = 7;

let SCORE_TEXT_OFFSET_X = 10;
let SCORE_TEXT_OFFSET_Y = 20;
let SCORE_TEXT_LINE_HEIGHT_FACTOR = 1.2;

const HAND_SCORES = {
  PAIR: 10,
  TWO_PAIR: 20,
  THREE_OF_A_KIND: 50,
  STRAIGHT: 150,
  FLUSH: 50,
  FOUR_OF_A_KIND: 100,
  STRAIGHT_FLUSH: 200,
  CORNERS_MULTIPLIER: 2,
  DISCARD_BONUS_MULTIPLIER: 3,
};

let deck = [];
let grid = Array(GRID_SIZE)
  .fill(null)
  .map(() => Array(GRID_SIZE).fill(null));
let currentHand = [];
let discardedCardsPile = [];
let round = 0;
let totalScore = 0;
let placedThisRoundCount = 0;
let lineScores = {
  rows: Array(GRID_SIZE).fill(null),
  cols: Array(GRID_SIZE).fill(null),
  corners: null,
};
let gameMessages = [];

let draggingCard = null;
let dragOffsetX, dragOffsetY;
let dragOriginalGridR = -1,
  dragOriginalGridC = -1;
let overallScaleFactor = 1;

function resizeCanvasAndElements() {
  const containerWidth = canvas.parentElement.clientWidth - 40;
  const maxCanvasWidth = 600;
  const baseCanvasWidthForLayout = 600;

  canvas.width = Math.min(containerWidth, maxCanvasWidth);
  overallScaleFactor = canvas.width / baseCanvasWidthForLayout;

  // Calculate space needed for top scores first
  const scoreBaseFontSize = 14;
  const scoreFontSize = Math.max(10, scoreBaseFontSize * overallScaleFactor);
  const scoreLineHeight = scoreFontSize * SCORE_TEXT_LINE_HEIGHT_FACTOR;
  TOP_SCORE_AREA_HEIGHT = scoreLineHeight * 2 + 20 * overallScaleFactor; // Approx 2 lines + padding

  CELL_HEIGHT = CELL_HEIGHT_BASE_DESIGN * overallScaleFactor;
  CELL_WIDTH = CELL_WIDTH_BASE_DESIGN * overallScaleFactor;
  CARD_V_PADDING = CARD_V_PADDING_BASE_DESIGN * overallScaleFactor;

  CARD_HEIGHT = CELL_HEIGHT - CARD_V_PADDING * 2;
  CARD_WIDTH = CARD_HEIGHT * (2 / 3);

  GRID_PADDING = 15 * overallScaleFactor;
  GRID_TOTAL_WIDTH = GRID_SIZE * CELL_WIDTH;
  GRID_TOTAL_HEIGHT = GRID_SIZE * CELL_HEIGHT;

  const scoreTextAllowance = Math.max(
    130 * overallScaleFactor,
    GRID_TOTAL_HEIGHT * 0.15,
  );
  GRID_OFFSET_X = (canvas.width - GRID_TOTAL_WIDTH - scoreTextAllowance) / 2;
  GRID_OFFSET_Y = TOP_SCORE_AREA_HEIGHT + 15 * overallScaleFactor; // Grid starts below top score area

  HAND_CARD_SPACING = 7 * overallScaleFactor;
  HAND_AREA_WIDTH = 5 * (CARD_WIDTH + HAND_CARD_SPACING);
  HAND_OFFSET_X = (canvas.width - HAND_AREA_WIDTH) / 2;
  HAND_OFFSET_Y =
    GRID_OFFSET_Y +
    GRID_TOTAL_HEIGHT +
    GRID_PADDING +
    SCORE_TEXT_OFFSET_Y * 2.5 +
    30 * overallScaleFactor;

  DISCARD_PILE_OFFSET_Y = HAND_OFFSET_Y + CARD_HEIGHT + 20 * overallScaleFactor;
  DISCARD_CARD_SPACING = 7 * overallScaleFactor;
  // DISCARD_SCORE_TEXT_Y_OFFSET is now part of TOP_SCORE_AREA_HEIGHT

  canvas.height = DISCARD_PILE_OFFSET_Y + CARD_HEIGHT + 30 * overallScaleFactor;

  SCORE_TEXT_OFFSET_X = 10 * overallScaleFactor;
  SCORE_TEXT_OFFSET_Y = 20 * overallScaleFactor;

  if (round > 0 && round <= GRID_SIZE) {
    repositionHandCards();
  }
  drawGame();
}
window.addEventListener("resize", resizeCanvasAndElements);

function createDeck() {
  deck = [];
  SUITS.forEach((suit) =>
    RANKS.forEach((rank) => {
      deck.push({
        suit,
        rank,
        value: RANK_VALUES[rank],
        id: `${rank}${suit}-${Math.random().toString(36).substr(2, 5)}`,
        x: 0,
        y: 0,
        homeX: 0,
        homeY: 0,
        isPlaced: false,
        roundPlaced: -1,
      });
    }),
  );
}
function shuffleDeck() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}
function dealCards() {
  currentHand = [];
  placedThisRoundCount = 0;
  for (let i = 0; i < 5; i++) {
    if (deck.length > 0) {
      const card = deck.pop();
      card.isPlaced = false;
      card.roundPlaced = -1;
      currentHand.push(card);
    } else {
      console.error("Deck empty, cannot deal more cards.");
      break;
    }
  }
  repositionHandCards();
}
function repositionHandCards() {
  currentHand.forEach((card, i) => {
    card.homeX = HAND_OFFSET_X + i * (CARD_WIDTH + HAND_CARD_SPACING);
    card.homeY = HAND_OFFSET_Y;
    if (!draggingCard || draggingCard.id !== card.id) {
      card.x = card.homeX;
      card.y = card.homeY;
    }
  });
}

canvas.addEventListener("mousedown", (e) => {
  if (round === 0 || round > GRID_SIZE) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  for (let i = currentHand.length - 1; i >= 0; i--) {
    const card = currentHand[i];
    if (
      mouseX >= card.x &&
      mouseX <= card.x + CARD_WIDTH &&
      mouseY >= card.y &&
      mouseY <= card.y + CARD_HEIGHT
    ) {
      draggingCard = card;
      dragOriginalGridR = -1;
      dragOriginalGridC = -1;
      currentHand.splice(i, 1);
      currentHand.push(draggingCard);
      break;
    }
  }

  if (!draggingCard) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cellCard = grid[r][c];
        if (cellCard && cellCard.roundPlaced === round) {
          const cardXOnGrid =
            GRID_OFFSET_X + c * CELL_WIDTH + (CELL_WIDTH - CARD_WIDTH) / 2;
          const cardYOnGrid =
            GRID_OFFSET_Y + r * CELL_HEIGHT + (CELL_HEIGHT - CARD_HEIGHT) / 2;
          if (
            mouseX >= cardXOnGrid &&
            mouseX <= cardXOnGrid + CARD_WIDTH &&
            mouseY >= cardYOnGrid &&
            mouseY <= cardYOnGrid + CARD_HEIGHT
          ) {
            draggingCard = cellCard;
            dragOriginalGridR = r;
            dragOriginalGridC = c;
            grid[r][c] = null;
            placedThisRoundCount--;
            break;
          }
        }
      }
      if (draggingCard) break;
    }
  }

  if (draggingCard) {
    dragOffsetX = mouseX - draggingCard.x;
    dragOffsetY = mouseY - draggingCard.y;
    drawGame();
  }
});
canvas.addEventListener("mousemove", (e) => {
  if (!draggingCard) return;
  const rect = canvas.getBoundingClientRect();
  draggingCard.x = e.clientX - rect.left - dragOffsetX;
  draggingCard.y = e.clientY - rect.top - dragOffsetY;
  drawGame();
});
canvas.addEventListener("mouseup", (e) => {
  if (!draggingCard) return;
  const dropMouseX = draggingCard.x + CARD_WIDTH / 2;
  const dropMouseY = draggingCard.y + CARD_HEIGHT / 2;

  let placedOnGridThisDrop = false;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cellXStart = GRID_OFFSET_X + c * CELL_WIDTH;
      const cellYStart = GRID_OFFSET_Y + r * CELL_HEIGHT;
      const cellXEnd = cellXStart + CELL_WIDTH;
      const cellYEnd = cellYStart + CELL_HEIGHT;

      if (
        dropMouseX >= cellXStart &&
        dropMouseX <= cellXEnd &&
        dropMouseY >= cellYStart &&
        dropMouseY <= cellYEnd
      ) {
        if (grid[r][c] === null) {
          if (dragOriginalGridR === -1 && placedThisRoundCount < 4) {
            grid[r][c] = draggingCard;
            draggingCard.isPlaced = true;
            draggingCard.roundPlaced = round;
            currentHand = currentHand.filter(
              (cardInHand) => cardInHand.id !== draggingCard.id,
            );
            placedThisRoundCount++;
            placedOnGridThisDrop = true;
          } else if (dragOriginalGridR !== -1) {
            grid[r][c] = draggingCard;
            draggingCard.isPlaced = true;
            draggingCard.roundPlaced = round;
            placedThisRoundCount++;
            placedOnGridThisDrop = true;
          }
        }
        break;
      }
    }
    if (placedOnGridThisDrop) break;
  }

  if (!placedOnGridThisDrop) {
    if (dragOriginalGridR !== -1) {
      const handAreaYStart = HAND_OFFSET_Y - 10 * overallScaleFactor;
      const handAreaYEnd =
        HAND_OFFSET_Y + CARD_HEIGHT + 10 * overallScaleFactor;
      const handAreaXStart = HAND_OFFSET_X - 10 * overallScaleFactor;
      const handAreaXEnd =
        HAND_OFFSET_X + HAND_AREA_WIDTH + 10 * overallScaleFactor;

      if (
        dropMouseX >= handAreaXStart &&
        dropMouseX <= handAreaXEnd &&
        dropMouseY >= handAreaYStart &&
        dropMouseY <= handAreaYEnd &&
        currentHand.length < 5
      ) {
        currentHand.push(draggingCard);
        draggingCard.isPlaced = false;
        draggingCard.roundPlaced = -1;
      } else {
        grid[dragOriginalGridR][dragOriginalGridC] = draggingCard;
        placedThisRoundCount++;
      }
    } else {
      currentHand = currentHand.filter((card) => card.id !== draggingCard.id);
      currentHand.push(draggingCard);
    }
  }

  draggingCard = null;
  repositionHandCards();
  evaluateAllBoardScores();
  drawGame();
});

const nextRoundButton = document.getElementById("nextRoundButton");
nextRoundButton.addEventListener("click", () => {
  gameMessages = [];
  if (round === 0) {
    startGame();
    return;
  }

  if (round > GRID_SIZE) return;

  if (placedThisRoundCount === 4 && currentHand.length === 1) {
    const cardToDiscard = currentHand[0];
    discardedCardsPile.push(cardToDiscard);
    currentHand = [];

    round++;
    if (round > GRID_SIZE) {
      endGame();
    } else {
      dealCards();
      nextRoundButton.textContent =
        round === GRID_SIZE ? "Confirm & Finish Game" : "Draw next";
    }
  } else {
    showAlert(
      `Please place exactly 4 cards on the grid (currently ${placedThisRoundCount} placed from active hand) and have 1 card remaining in your hand to discard (currently ${currentHand.length} in hand).`,
    );
  }
  evaluateAllBoardScores();
  drawGame();
});

document.getElementById("playAgainButton").addEventListener("click", () => {
  highScoresDiv.style.display = "none";
  document.getElementById("playAgainButton").style.display = "none";
  nextRoundButton.style.display = "inline-block";
  nextRoundButton.disabled = false;
  startGame();
});

if (helpButton) {
  // Check if element exists before adding listener
  helpButton.addEventListener("click", showHelpModal);
}
if (helpModalCloseButton) {
  helpModalCloseButton.addEventListener("click", closeHelpModal);
}

const originalWindowOnClick = window.onclick; // Store original if it exists
window.onclick = function (event) {
  if (typeof originalWindowOnClick === "function") {
    originalWindowOnClick(event); // Call original if it exists (e.g. for alert modal)
  }
  if (event.target == helpModal) {
    closeHelpModal();
  }
};

function showHelpModal() {
  const helpText = `
        <p><strong>Goal:</strong> Score the most points by forming poker hands on the grid.</p>
        <p>In each round:</strong></p>
        <ul>
            <li>You get 5 cards.</li>
            <li>Place 4 on the grid.</li>
            <li>1 card is discarded.</li>
        </ul>
        <p><strong>Scoring:</strong></p>
        <ul>
            <li>Hands score for each row, column, and the 4 corners.</li>
            <li>Corner hands get a 2x score multiplier.</li>
        </ul>
        <p><strong>Bonus:</strong> If all 9 hands (4 rows, 4 cols, 1 corners) are made, your final 4-card discard pile gets a 3x score bonus!</p>
    `;
  helpContentDiv.innerHTML = helpText;
  helpModal.style.display = "flex";
}

function closeHelpModal() {
  helpModal.style.display = "none";
}

function startGame() {
  createDeck();
  shuffleDeck();
  grid = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(null));
  discardedCardsPile = [];
  currentHand = [];
  gameMessages = [];
  updateGameMessagesUI();
  round = 1;
  totalScore = 0;
  placedThisRoundCount = 0;
  lineScores = {
    rows: Array(GRID_SIZE).fill(null),
    cols: Array(GRID_SIZE).fill(null),
    corners: null,
  };

  highScoresDiv.style.display = "none";
  nextRoundButton.textContent = "Next";
  document.getElementById("scoreBoard").textContent =
    `Total Score: 0 | Round: 1`;

  dealCards();
  loadHighScores();
  evaluateAllBoardScores();
  resizeCanvasAndElements();
}

function evaluateLine(lineCards) {
  const actualCards = lineCards.filter((c) => c !== null);
  if (actualCards.length < 2) return null;

  const ranks = actualCards.map((c) => c.value).sort((a, b) => a - b);
  const suits = actualCards.map((c) => c.suit);
  const rankCounts = {};
  actualCards.forEach(
    (c) => (rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1),
  );
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  let result = null;

  if (actualCards.length === 4) {
    const isFlush = suits.every((s) => s === suits[0]);
    let isStraight = true;
    for (let i = 0; i < 3; i++) {
      if (ranks[i + 1] !== ranks[i] + 1) {
        isStraight = false;
        break;
      }
    }
    if (isStraight && isFlush)
      result = { type: "Str Flush", score: HAND_SCORES.STRAIGHT_FLUSH };
    else if (counts[0] === 4)
      result = { type: "4 of Kind", score: HAND_SCORES.FOUR_OF_A_KIND };
    else if (isFlush) result = { type: "Flush", score: HAND_SCORES.FLUSH };
    else if (isStraight)
      result = { type: "Straight", score: HAND_SCORES.STRAIGHT };
    else if (counts[0] === 3)
      result = { type: "3 of Kind", score: HAND_SCORES.THREE_OF_A_KIND };
    else if (counts[0] === 2 && counts.length > 1 && counts[1] === 2)
      result = { type: "Two Pair", score: HAND_SCORES.TWO_PAIR };
    else if (counts[0] === 2)
      result = { type: "Pair", score: HAND_SCORES.PAIR };
  } else if (actualCards.length === 3) {
    if (counts[0] === 3)
      result = { type: "3 of Kind", score: HAND_SCORES.THREE_OF_A_KIND };
    else if (counts[0] === 2)
      result = { type: "Pair", score: HAND_SCORES.PAIR };
  } else if (actualCards.length === 2) {
    if (counts[0] === 2) result = { type: "Pair", score: HAND_SCORES.PAIR };
  }
  return result;
}

function evaluateAllBoardScores() {
  let currentGridScore = 0;
  let madeHandsCount = 0;

  for (let r = 0; r < GRID_SIZE; r++) {
    lineScores.rows[r] = evaluateLine(grid[r]);
    if (lineScores.rows[r]) {
      currentGridScore += lineScores.rows[r].score;
      madeHandsCount++;
    }
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    const colCards = grid.map((row) => row[c]);
    lineScores.cols[c] = evaluateLine(colCards);
    if (lineScores.cols[c]) {
      currentGridScore += lineScores.cols[c].score;
      madeHandsCount++;
    }
  }

  const cornerCards = [
    grid[0][0],
    grid[0][GRID_SIZE - 1],
    grid[GRID_SIZE - 1][0],
    grid[GRID_SIZE - 1][GRID_SIZE - 1],
  ];
  lineScores.corners = evaluateLine(cornerCards); // Evaluate corners with partial hands too
  if (lineScores.corners) {
    currentGridScore +=
      lineScores.corners.score * HAND_SCORES.CORNERS_MULTIPLIER;
    madeHandsCount++;
  }

  totalScore = currentGridScore;
  document.getElementById("scoreBoard").textContent =
    `Total Score: ${totalScore}` +
    (round <= GRID_SIZE && round > 0
      ? ` | Round: ${round}`
      : round === 0
        ? ""
        : ` | Game Over!`);
  return madeHandsCount;
}

function endGame() {
  nextRoundButton.textContent = "Game Over";
  nextRoundButton.disabled = true;
  nextRoundButton.style.display = "none";
  document.getElementById("playAgainButton").style.display = "inline-block";
  highScoresDiv.style.display = "block";

  const madeHandsCount = evaluateAllBoardScores();

  if (
    madeHandsCount === GRID_SIZE * 2 + 1 &&
    discardedCardsPile.length === GRID_SIZE
  ) {
    const discardHandResult = evaluateLine(discardedCardsPile);
    if (discardHandResult) {
      const bonusAmount =
        discardHandResult.score * HAND_SCORES.DISCARD_BONUS_MULTIPLIER;
      totalScore += bonusAmount;
      gameMessages.push(
        `All Hands Bonus! Discarded (${discardHandResult.type}): +${bonusAmount}`,
      );
    } else {
      gameMessages.push(`All Hands Made! No score from discards.`);
    }
  } else if (discardedCardsPile.length === GRID_SIZE) {
    gameMessages.push(`Game complete. Discards not eligible for bonus.`);
  }

  document.getElementById("scoreBoard").textContent =
    `Total Score: ${totalScore} | Game Over!`;
  updateGameMessagesUI();
  saveHighScore(totalScore);
  loadHighScores();
  drawGame();
}

function drawCard(card, x, y, isDiscardedVisual = false) {
  if (!card) return;

  const displayWidth = isDiscardedVisual ? CARD_WIDTH * 0.85 : CARD_WIDTH;
  const displayHeight = isDiscardedVisual ? CARD_HEIGHT * 0.85 : CARD_HEIGHT;

  if (draggingCard && draggingCard.id === card.id) {
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--violet")
      .trim();
  } else {
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--base02")
      .trim();
  }

  if (
    card.isPlaced &&
    card.roundPlaced === round &&
    !isDiscardedVisual &&
    round > 0
  ) {
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--yellow")
      .trim();
    ctx.lineWidth = 2.5 * overallScaleFactor;
  } else {
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--base00")
      .trim();
    ctx.lineWidth = 1.5 * overallScaleFactor;
  }

  ctx.beginPath();
  ctx.roundRect(x, y, displayWidth, displayHeight, [6 * overallScaleFactor]);
  ctx.fill();
  ctx.stroke();

  const suitColor =
    card.suit === "H" || card.suit === "D"
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--orange")
          .trim()
      : getComputedStyle(document.documentElement)
          .getPropertyValue("--cyan")
          .trim();

  const displayRank = card.rank === "T" ? "10" : card.rank;
  const cardInternalPadding = 10 * overallScaleFactor;

  const suitFontSizeBase = isDiscardedVisual ? 28 : 36;
  const suitFontSize = Math.max(18, suitFontSizeBase * overallScaleFactor);
  ctx.font = `bold ${suitFontSize}px 'Arial', sans-serif`;
  ctx.fillStyle = suitColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(
    getSuitSymbol(card.suit),
    x + displayWidth / 2,
    y + cardInternalPadding,
  );

  const rankFontSizeBase = isDiscardedVisual ? 30 : 38;
  const rankFontSize = Math.max(20, rankFontSizeBase * overallScaleFactor);
  ctx.font = `bold ${rankFontSize}px 'Arial', sans-serif`;
  ctx.fillStyle = suitColor;
  ctx.textBaseline = "bottom";
  ctx.fillText(
    displayRank,
    x + displayWidth / 2,
    y + displayHeight - cardInternalPadding,
  );
}

function getSuitSymbol(suit) {
  return { H: "♥", D: "♦", C: "♣", S: "♠" }[suit] || suit;
}

function updateGameMessagesUI() {
  gameMessagesArea.innerHTML = gameMessages.join("<br>");
}

function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- Draw Top Area Scores (Corners & Potential Discard) ---
  const scoreBaseFontSize = 14;
  const scoreFontSize = Math.max(10, scoreBaseFontSize * overallScaleFactor);
  const scoreLineHeight = scoreFontSize * SCORE_TEXT_LINE_HEIGHT_FACTOR;
  ctx.font = `${scoreFontSize}px 'Arial', sans-serif`;
  ctx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--yellow")
    .trim();

  const topScoreYStart = 15 * overallScaleFactor; // Starting Y for this section
  let currentTopY = topScoreYStart;

  // Potential Discard Score
  if (round > 0 && round <= GRID_SIZE && discardedCardsPile.length >= 2) {
    const potentialDiscardHand = evaluateLine(discardedCardsPile);
    if (potentialDiscardHand) {
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const discardText1 = `Discard (pot.): ${potentialDiscardHand.type}`;
      const discardText2 = `(${potentialDiscardHand.score})`;
      ctx.fillText(discardText1, 15 * overallScaleFactor, currentTopY);
      ctx.fillText(
        discardText2,
        15 * overallScaleFactor,
        currentTopY + scoreLineHeight,
      );
      currentTopY += scoreLineHeight * 2 + 5 * overallScaleFactor; // Move down for next item
    }
  }

  // Corner Scores
  if (lineScores.corners) {
    ctx.textAlign = "left"; // Or 'center' if you prefer it centered in top area
    ctx.textBaseline = "top";
    const cornerText1 = `Corners: ${lineScores.corners.type}`;
    const cornerText2 = `(${
      lineScores.corners.score * HAND_SCORES.CORNERS_MULTIPLIER
    })`;
    ctx.fillText(
      cornerText1,
      15 * overallScaleFactor, //canvas.width / 2,
      currentTopY,
    );
    ctx.fillText(
      cornerText2,
      15 * overallScaleFactor, //canvas.width / 2,
      currentTopY + scoreLineHeight,
    );
  }

  // --- Draw Grid ---
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue("--base01")
        .trim();
      ctx.lineWidth = 1 * overallScaleFactor;

      const cellX = GRID_OFFSET_X + c * CELL_WIDTH;
      const cellY = GRID_OFFSET_Y + r * CELL_HEIGHT;
      ctx.strokeRect(cellX, cellY, CELL_WIDTH, CELL_HEIGHT);

      const card = grid[r][c];
      if (card) {
        drawCard(
          card,
          cellX + (CELL_WIDTH - CARD_WIDTH) / 2,
          cellY + (CELL_HEIGHT - CARD_HEIGHT) / 2,
        );
      }
    }
  }

  // --- Draw Row and Column Scores ---
  ctx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--yellow")
    .trim();
  ctx.font = `${scoreFontSize}px 'Arial', sans-serif`; // Ensure font is set again

  for (let r = 0; r < GRID_SIZE; r++) {
    if (lineScores.rows[r]) {
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const yPos = GRID_OFFSET_Y + r * CELL_HEIGHT + CELL_HEIGHT / 2;
      ctx.fillText(
        `${lineScores.rows[r].type}`,
        GRID_OFFSET_X + GRID_TOTAL_WIDTH + SCORE_TEXT_OFFSET_X,
        yPos - scoreLineHeight / 2 + 2 * overallScaleFactor,
      );
      ctx.fillText(
        `(${lineScores.rows[r].score})`,
        GRID_OFFSET_X + GRID_TOTAL_WIDTH + SCORE_TEXT_OFFSET_X,
        yPos + scoreLineHeight / 2 + 2 * overallScaleFactor,
      );
    }
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    if (lineScores.cols[c]) {
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const xPos = GRID_OFFSET_X + c * CELL_WIDTH + CELL_WIDTH / 2;
      ctx.fillText(
        `${lineScores.cols[c].type}`,
        xPos,
        GRID_OFFSET_Y + GRID_TOTAL_HEIGHT + SCORE_TEXT_OFFSET_Y,
      );
      ctx.fillText(
        `(${lineScores.cols[c].score})`,
        xPos,
        GRID_OFFSET_Y +
          GRID_TOTAL_HEIGHT +
          SCORE_TEXT_OFFSET_Y +
          scoreLineHeight,
      );
    }
  }

  // --- Draw Hand and Discard Pile Visuals ---
  currentHand.forEach((card) => {
    if (!draggingCard || draggingCard.id !== card.id)
      drawCard(card, card.x, card.y);
  });
  if (draggingCard) drawCard(draggingCard, draggingCard.x, draggingCard.y);

  updateGameMessagesUI();

  const discardPileStartX = HAND_OFFSET_X;
  discardedCardsPile.forEach((card, index) => {
    const discardCardX = discardPileStartX + index * (CARD_WIDTH * 0.85 * 0.6);
    if (discardCardX + CARD_WIDTH * 0.85 < canvas.width) {
      drawCard(card, discardCardX, DISCARD_PILE_OFFSET_Y, true);
    }
  });

  // --- Game Over Screen ---
  if (round > GRID_SIZE) {
    ctx.fillStyle = "rgba(0, 43, 54, 0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--base2")
      .trim();
    const gameOverTitleBaseSize = 44;
    const gameOverTitleSize = Math.max(
      22,
      gameOverTitleBaseSize * overallScaleFactor,
    );
    ctx.font = `bold ${gameOverTitleSize}px 'Arial', sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(
      `Game Over!`,
      canvas.width / 2,
      canvas.height / 2 - 65 * overallScaleFactor,
    );

    const finalScoreBaseSize = 33;
    const finalScoreSize = Math.max(
      17,
      finalScoreBaseSize * overallScaleFactor,
    );
    ctx.font = `bold ${finalScoreSize}px 'Arial', sans-serif`;
    ctx.fillText(
      `Final Score: ${totalScore}`,
      canvas.width / 2,
      canvas.height / 2 - 25 * overallScaleFactor,
    );

    let msgY = canvas.height / 2 + 25 * overallScaleFactor;
    const bonusMsgBaseSize = 20;
    const bonusMsgSize = Math.max(12, bonusMsgBaseSize * overallScaleFactor);
    ctx.font = `${bonusMsgSize}px 'Arial', sans-serif`;
    gameMessages.forEach((msg) => {
      ctx.fillText(msg, canvas.width / 2, msgY);
      msgY += 28 * overallScaleFactor;
    });
  }
  // Removed direct call to drawWelcomeScreen, game starts immediately
}

const HIGH_SCORES_KEY = "apoquerar001";
const MAX_HIGH_SCORES = 5;

async function saveHighScore(score) {
  if (typeof score !== "number" || isNaN(score)) {
    console.error("Invalid score for saving:", score);
    return;
  }
  const newScoreEntry = { score, date: new Date().toLocaleDateString() };
  let highScores = (await localStore.get(HIGH_SCORES_KEY)) || [];
  highScores.push(newScoreEntry);
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, MAX_HIGH_SCORES);
  await localStore.set(HIGH_SCORES_KEY, highScores);
}
async function loadHighScores() {
  const highScoresList = document.getElementById("highScoresList");
  highScoresList.innerHTML = "";
  const highScores = (await localStore.get(HIGH_SCORES_KEY)) || [];
  if (highScores.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No scores yet. Be the first!";
    highScoresList.appendChild(li);
  } else {
    highScores.forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = `${entry.score} points - ${entry.date}`;
      highScoresList.appendChild(li);
    });
  }
}

// Initial Setup
loadHighScores();
highScoresDiv.style.display = "none";
startGame(); // Start the game directly
// resizeCanvasAndElements() is called within startGame after first deal

import { haptic } from "./haptic.js";

const customAlertModal = document.getElementById("customAlertModal");
const customAlertMessage = document.getElementById("customAlertMessage");
const customAlertCloseButton = document.getElementById(
  "customAlertCloseButton",
);

function showAlert(message) {
  customAlertMessage.textContent = message;
  customAlertModal.style.display = "flex";
}
customAlertCloseButton.onclick = function () {
  customAlertModal.style.display = "none";
};

let originalWindowOnClick = window.onclick;
window.onclick = function (event) {
  if (
    typeof originalWindowOnClick === "function" &&
    event.target !== helpModal &&
    event.target !== customAlertModal
  ) {
    originalWindowOnClick(event);
  }
  if (event.target == customAlertModal) {
    customAlertModal.style.display = "none";
  }
  if (event.target == helpModal) {
    closeHelpModal();
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

const helpButton = document.getElementById("helpButton");
const helpModal = document.getElementById("helpModal");
const helpModalCloseButton = document.getElementById("helpModalCloseButton");
const helpContentDiv = document.getElementById("helpContent");

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
let GRID_OFFSET_Y = 0;

let TOP_SCORE_AREA_HEIGHT = 0;

let HAND_CARD_SPACING = 7;
let HAND_AREA_WIDTH = 0;
let HAND_OFFSET_X = 0;
let HAND_OFFSET_Y = 0;

let DISCARD_PILE_OFFSET_Y = 0;
let DISCARD_CARD_SPACING = 7;
let DISCARD_SCORE_TEXT_Y_OFFSET = 0;

let SCORE_TEXT_OFFSET_X = 10;
let SCORE_TEXT_OFFSET_Y = 20;
let SCORE_TEXT_LINE_HEIGHT_FACTOR = 1.2;

const HAND_SCORES = {
  PAIR: 5,
  TWO_PAIR: 60,
  THREE_OF_A_KIND: 125,
  STRAIGHT: 180,
  FLUSH: 80,
  FOUR_OF_A_KIND: 325,
  STRAIGHT_FLUSH: 450,
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

function showHelpModal() {
  haptic();
  const helpText = `
                <h4>A barebones version of <a href="https://www.puzzmo.com/game/pile-up-poker/">Pile up Poker</a> by Zach Gage, playable for real in <a href="https://www.puzzmo.com/">Puzzmo</a></h4>
                <hr/>
                <p><strong>Goal:</strong> Score the most points by forming poker hands on the 4x4 grid.</p>
                <p><strong>Rounds:</strong> 4 rounds. In each round:</p>
                <ul>
                    <li>You are dealt 5 cards.</li>
                    <li>Place 4 cards onto the grid.</li>
                    <li>The 1 remaining card is discarded.</li>
                </ul>
                <p><strong>Scoring:</strong></p>
                <ul>
                    <li>Hands are scored for each of the 4 rows, each of the 4 columns, and the 4 corners.</li>
                    <li>Pairs (2 cards) and Three-of-a-Kind (3 cards) score as you place them.</li>
                    <li>Straights, Flushes, Four-of-a-Kind, and Straight Flushes require 4 cards in a line.</li>
                    <li>Corner hands also score with 2, 3, or 4 cards and get a 2x score multiplier.</li>
                </ul>
                <p><strong>Bonus:</strong> If all 9 scoring areas (4 rows, 4 columns, 1 corners) form a valid poker hand at the end of the game, your final 4-card discard pile is evaluated. If it also forms a hand, its score is tripled and added to your total!</p>
                <p><strong>Discard Pile:</strong> The potential score of your discard pile is shown at the top left as you discard cards.</p>
            `;
  helpContentDiv.innerHTML = helpText;
  helpModal.style.display = "flex";
}

function closeHelpModal() {
  helpModal.style.display = "none";
}

if (helpButton) {
  helpButton.addEventListener("click", showHelpModal);
}
if (helpModalCloseButton) {
  helpModalCloseButton.addEventListener("click", closeHelpModal);
}

function resizeCanvasAndElements() {
  const containerWidth = canvas.parentElement.clientWidth - 40;
  const maxCanvasWidth = 600;
  const baseCanvasWidthForLayout = 600;

  canvas.width = Math.min(containerWidth, maxCanvasWidth);
  overallScaleFactor = canvas.width / baseCanvasWidthForLayout;

  const scoreBaseFontSize = 14;
  const scoreFontSize = Math.max(10, scoreBaseFontSize * overallScaleFactor);
  const scoreLineHeight = scoreFontSize * SCORE_TEXT_LINE_HEIGHT_FACTOR;
  TOP_SCORE_AREA_HEIGHT = scoreLineHeight * 2 * 2 + 25 * overallScaleFactor;

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
  GRID_OFFSET_Y = TOP_SCORE_AREA_HEIGHT;

  HAND_CARD_SPACING = 7 * overallScaleFactor;
  HAND_AREA_WIDTH = 5 * (CARD_WIDTH + HAND_CARD_SPACING);
  HAND_OFFSET_X = (canvas.width - HAND_AREA_WIDTH) / 2;
  HAND_OFFSET_Y =
    GRID_OFFSET_Y + GRID_TOTAL_HEIGHT + GRID_PADDING + SCORE_TEXT_OFFSET_Y * 2;

  DISCARD_PILE_OFFSET_Y = HAND_OFFSET_Y + CARD_HEIGHT + 20 * overallScaleFactor;
  DISCARD_CARD_SPACING = 7 * overallScaleFactor;
  DISCARD_SCORE_TEXT_Y_OFFSET =
    DISCARD_PILE_OFFSET_Y + CARD_HEIGHT * 0.85 + 10 * overallScaleFactor; // This is used for top score area now

  canvas.height = HAND_OFFSET_Y + CARD_HEIGHT + 30 * overallScaleFactor;

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
        vx: 0,
        vy: 0,
        isPlaced: false,
        roundPlaced: -1,
        isFlipped: false,
        flipScaleX: 1,
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

function animateCardFlip(card) {
  let isShrinking = true;
  const animationTime = 150; // ms for one direction
  const intervalTime = 10;
  const step = 1 / (animationTime / intervalTime);

  const animInterval = setInterval(() => {
    if (isShrinking) {
      card.flipScaleX -= step;
      if (card.flipScaleX <= 0) {
        card.flipScaleX = 0;
        isShrinking = false;
        card.isFlipped = true;
      }
    } else {
      // Growing
      card.flipScaleX += step;
      if (card.flipScaleX >= 1) {
        card.flipScaleX = 1;
        clearInterval(animInterval);
      }
    }
    drawGame();
  }, intervalTime);
}

function animateCardMovement(card) {
  const stiffness = 0.08;
  const damping = 0.85;
  const intervalTime = 10;

  const moveInterval = setInterval(() => {
    const distX = card.homeX - card.x;
    const distY = card.homeY - card.y;

    const accelX = distX * stiffness;
    const accelY = distY * stiffness;
    card.vx += accelX;
    card.vy += accelY;
    card.vx *= damping;
    card.vy *= damping;
    card.x += card.vx;
    card.y += card.vy;

    const isSettled =
      Math.abs(distX) < 0.5 &&
      Math.abs(distY) < 0.5 &&
      Math.abs(card.vx) < 0.5 &&
      Math.abs(card.vy) < 0.5;

    if (isSettled) {
      clearInterval(moveInterval);
      card.x = card.homeX;
      card.y = card.homeY;
      animateCardFlip(card); // Flip card *after* it lands
    }

    drawGame();
  }, intervalTime);
}

function animateDeal() {
  currentHand.forEach((card, index) => {
    setTimeout(() => {
      animateCardMovement(card);
    }, index * 120); // Stagger the dealing of each card
  });
}

function dealCards() {
  currentHand = [];
  placedThisRoundCount = 0;
  for (let i = 0; i < 5; i++) {
    if (deck.length > 0) {
      const card = deck.pop();
      card.isPlaced = false;
      card.roundPlaced = -1;
      card.isFlipped = false;
      card.flipScaleX = 1;
      card.vx = 0;
      card.vy = 0;
      card.x = canvas.width / 2 - CARD_WIDTH / 2;
      card.y = -CARD_HEIGHT * 2;
      currentHand.push(card);
    } else {
      console.error("Deck empty, cannot deal more cards.");
      break;
    }
  }
  repositionHandCards(); // Sets the destination homeX/homeY for cards
  animateDeal(); // Starts the new animation sequence
}

function repositionHandCards() {
  currentHand.forEach((card, i) => {
    card.homeX = HAND_OFFSET_X + i * (CARD_WIDTH + HAND_CARD_SPACING);
    card.homeY = HAND_OFFSET_Y;
    // Don't snap position here, animation will handle it
  });
}

// --- Touch Event Handling ---
function getTouchPos(canvasDom, touchEvent) {
  const rect = canvasDom.getBoundingClientRect();
  return {
    x: touchEvent.touches[0].clientX - rect.left,
    y: touchEvent.touches[0].clientY - rect.top,
  };
}

canvas.addEventListener(
  "touchstart",
  function (e) {
    if (round === 0 || round > GRID_SIZE) return;
    // Only prevent default if a card is successfully picked up
    // This allows other touch interactions on the page if not dragging a card

    const touchPos = getTouchPos(canvas, e);
    const mouseX = touchPos.x;
    const mouseY = touchPos.y;
    let cardFound = false;

    for (let i = currentHand.length - 1; i >= 0; i--) {
      const card = currentHand[i];
      if (
        card.isFlipped &&
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
        cardFound = true;
        break;
      }
    }

    if (!cardFound) {
      // Renamed from draggingCard to cardFound for clarity
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
              cardFound = true;
              break;
            }
          }
        }
        if (cardFound) break;
      }
    }

    if (draggingCard) {
      // if cardFound is true, draggingCard is set
      // If picked from grid, ensure its x,y are its visual grid coordinates before offset calculation
      if (dragOriginalGridR !== -1 && dragOriginalGridC !== -1) {
        // Indicates it was picked from grid
        draggingCard.x =
          GRID_OFFSET_X +
          dragOriginalGridC * CELL_WIDTH +
          (CELL_WIDTH - CARD_WIDTH) / 2;
        draggingCard.y =
          GRID_OFFSET_Y +
          dragOriginalGridR * CELL_HEIGHT +
          (CELL_HEIGHT - CARD_HEIGHT) / 2;
      }
      e.preventDefault(); // Prevent scrolling ONLY if we are starting a drag
      dragOffsetX = mouseX - draggingCard.x;
      dragOffsetY = mouseY - draggingCard.y;
      // drawGame(); // Not needed, touchmove handles drawing
    }
  },
  { passive: false },
);

canvas.addEventListener(
  "touchmove",
  function (e) {
    if (!draggingCard) return;
    e.preventDefault();

    const touchPos = getTouchPos(canvas, e);
    draggingCard.x = touchPos.x - dragOffsetX;
    draggingCard.y = touchPos.y - dragOffsetY;
    drawGame();
  },
  { passive: false },
);

canvas.addEventListener("touchend", function (e) {
  // No e.preventDefault() needed typically on touchend for drag operations
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

// --- Mouse Event Handling (remains largely the same) ---
canvas.addEventListener("mousedown", (e) => {
  if (round === 0 || round > GRID_SIZE) return;
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  for (let i = currentHand.length - 1; i >= 0; i--) {
    const card = currentHand[i];
    if (
      card.isFlipped &&
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
    // If picked from grid, ensure its x,y are its visual grid coordinates before offset calculation
    if (dragOriginalGridR !== -1 && dragOriginalGridC !== -1) {
      // Indicates it was picked from grid
      draggingCard.x =
        GRID_OFFSET_X +
        dragOriginalGridC * CELL_WIDTH +
        (CELL_WIDTH - CARD_WIDTH) / 2;
      draggingCard.y =
        GRID_OFFSET_Y +
        dragOriginalGridR * CELL_HEIGHT +
        (CELL_HEIGHT - CARD_HEIGHT) / 2;
    }
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
  haptic();
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
  haptic.confirm();
  highScoresDiv.style.display = "none";
  document.getElementById("playAgainButton").style.display = "none";
  nextRoundButton.style.display = "inline-block";
  nextRoundButton.disabled = false;
  startGame();
});

function getScoreMultiplier(numberOfHands) {
  if (numberOfHands >= 10) return 6;
  if (numberOfHands >= 8) return 5;
  if (numberOfHands >= 6) return 4;
  if (numberOfHands >= 4) return 3;
  if (numberOfHands >= 2) return 2;
  return 1;
}

function startGame() {
  createDeck();
  shuffleDeck();
  grid = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(null));
  discardedCardsPile = [];
  currentHand = [];
  gameMessages = []; // Clear previous game messages
  round = 1;
  totalScore = 0;
  placedThisRoundCount = 0;
  lineScores = {
    rows: Array(GRID_SIZE).fill(null),
    cols: Array(GRID_SIZE).fill(null),
    corners: null,
  };

  highScoresDiv.style.display = "none";
  document.getElementById("playAgainButton").style.display = "none";
  nextRoundButton.style.display = "inline-block";
  nextRoundButton.disabled = false;
  nextRoundButton.textContent = "Draw next";

  // Set initial scoreboard text; evaluateAllBoardScores will refine it shortly
  document.getElementById("scoreBoard").textContent =
    `Total Score: 0 | Multiplier: x1`;

  dealCards(); // This also calls repositionHandCards
  loadHighScores();
  evaluateAllBoardScores(); // This will calculate initial score (0) and set multiplier (x1)
  resizeCanvasAndElements(); // This calls drawGame
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
      result = { type: "2 Pair", score: HAND_SCORES.TWO_PAIR };
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
  let rawGridScore = 0;
  let madeHandsCount = 0;

  lineScores = {
    // Resetting lineScores for fresh evaluation
    rows: Array(GRID_SIZE).fill(null),
    cols: Array(GRID_SIZE).fill(null),
    corners: null,
  };

  for (let r = 0; r < GRID_SIZE; r++) {
    lineScores.rows[r] = evaluateLine(grid[r]);
    if (lineScores.rows[r]) {
      rawGridScore += lineScores.rows[r].score;
      madeHandsCount++;
    }
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    const colCards = grid.map((row) => row[c]);
    lineScores.cols[c] = evaluateLine(colCards);
    if (lineScores.cols[c]) {
      rawGridScore += lineScores.cols[c].score;
      madeHandsCount++;
    }
  }

  const cornerCards = [
    grid[0][0],
    grid[0][GRID_SIZE - 1],
    grid[GRID_SIZE - 1][0],
    grid[GRID_SIZE - 1][GRID_SIZE - 1],
  ];
  lineScores.corners = evaluateLine(cornerCards);
  if (lineScores.corners) {
    rawGridScore += lineScores.corners.score * HAND_SCORES.CORNERS_MULTIPLIER;
    madeHandsCount++;
  }

  const currentMultiplier = getScoreMultiplier(madeHandsCount);
  totalScore = rawGridScore * currentMultiplier;

  const scoreBoard = document.getElementById("scoreBoard");
  let scoreBoardText = `Total Score: ${totalScore} | Multiplier: x${currentMultiplier}`;
  // The "Game Over!" part of the scoreboard text is definitively set by endGame
  if (scoreBoard) scoreBoard.textContent = scoreBoardText;

  return { rawGridScore, madeHandsCount, currentMultiplier };
}

function endGame() {
  nextRoundButton.textContent = "Game Over";
  nextRoundButton.disabled = true;
  nextRoundButton.style.display = "none";
  document.getElementById("playAgainButton").style.display = "inline-block";
  highScoresDiv.style.display = "block";

  const boardEvalData = evaluateAllBoardScores(); // This updates score based on board hands
  let finalRawScore = boardEvalData.rawGridScore;
  let finalMadeHandsCount = boardEvalData.madeHandsCount;

  // Store messages for game over screen separately to avoid duplication if endGame is called multiple times
  let endOfGameSpecificMessages = [];

  if (
    finalMadeHandsCount === GRID_SIZE * 2 + 1 && // All 9 board hands made
    discardedCardsPile.length === GRID_SIZE
  ) {
    const discardHandResult = evaluateLine(discardedCardsPile);
    if (discardHandResult) {
      const bonusAmount =
        discardHandResult.score * HAND_SCORES.DISCARD_BONUS_MULTIPLIER;
      finalRawScore += bonusAmount; // Add raw bonus to raw score total
      finalMadeHandsCount++; // Increment hand count, potentially to 10
      endOfGameSpecificMessages.push(
        `All Hands Bonus! Discarded (${discardHandResult.type}): +${bonusAmount} (raw).`,
      );
    } else {
      endOfGameSpecificMessages.push(
        `All 9 Board Hands Made! No score from discards.`,
      );
    }
  } else if (discardedCardsPile.length === GRID_SIZE) {
    endOfGameSpecificMessages.push(
      `Game complete. Discards not eligible for bonus.`,
    );
  }

  const finalMultiplier = getScoreMultiplier(finalMadeHandsCount);
  totalScore = finalRawScore * finalMultiplier; // Calculate final total score with the new multiplier

  if (endOfGameSpecificMessages.length > 0) {
    gameMessages.push(...endOfGameSpecificMessages); // Add these to the main game messages
  }
  gameMessages.push(
    `Base score ${finalRawScore} with x${finalMultiplier} multiplier = ${totalScore} pts`,
  );

  document.getElementById("scoreBoard").textContent =
    `Total Score: ${totalScore} | Multiplier: x${finalMultiplier} | Game Over!`;
  updateGameMessagesUI();
  saveHighScore(totalScore);
  loadHighScores();
  drawGame(); // drawGame will display game over screen and messages
}

function drawCardBack(card, x, y, width, height) {
  const cornerRadius = 6 * overallScaleFactor;
  ctx.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--base02")
    .trim();
  ctx.strokeStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--base01")
    .trim();
  ctx.lineWidth = 1.5 * overallScaleFactor;

  // Clip to rounded rectangle shape
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, [cornerRadius]);
  ctx.fill();
  ctx.stroke();
  ctx.clip();

  // Draw diagonal stripes
  ctx.strokeStyle = getComputedStyle(document.documentElement)
    .getPropertyValue("--red")
    .trim();
  ctx.lineWidth = 5 * overallScaleFactor; // Thinner stripes
  const stripeCount = 10;
  for (let i = -stripeCount; i < stripeCount * 1.5; i++) {
    // Loop more to cover card
    ctx.beginPath();
    const xStart = x + i * 15 * overallScaleFactor - 10 * overallScaleFactor;
    const yStart = y - 10 * overallScaleFactor;
    const xEnd =
      x + i * 15 * overallScaleFactor - 10 * overallScaleFactor + width * 2;
    const yEnd = y + height + 10 * overallScaleFactor;

    ctx.moveTo(xStart, yStart);
    ctx.lineTo(xEnd, yEnd);
    ctx.stroke();
  }

  ctx.restore(); // Remove clipping mask
}

function drawCard(card, x, y, isDiscardedVisual = false) {
  if (!card) return;

  const baseHeight = isDiscardedVisual ? CARD_HEIGHT * 0.85 : CARD_HEIGHT;
  const baseWidth = isDiscardedVisual ? CARD_WIDTH * 0.85 : CARD_WIDTH;

  const scale = card.flipScaleX !== undefined ? card.flipScaleX : 1;
  const displayWidth = baseWidth * scale;
  const centeredX = x + (baseWidth - displayWidth) / 2;

  if (!card.isFlipped) {
    drawCardBack(card, centeredX, y, displayWidth, baseHeight);
    return; // Stop here if card is face down
  }

  // --- Draw Card Face ---
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
  ctx.roundRect(centeredX, y, displayWidth, baseHeight, [
    6 * overallScaleFactor,
  ]);
  ctx.fill();
  ctx.stroke();

  // Don't draw text/symbols if card is mostly flipped
  if (scale < 0.4) return;

  let suitColor;
  if (card.suit === "H") {
    suitColor = "#933";
  } else if (card.suit === "D") {
    suitColor = "#993";
  } else if (card.suit === "S") {
    suitColor = "#339";
  } else if (card.suit === "C") {
    suitColor = "#393";
  }

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
    centeredX + displayWidth / 2,
    y + cardInternalPadding,
  );

  const rankFontSizeBase = isDiscardedVisual ? 30 : 38;
  const rankFontSize = Math.max(20, rankFontSizeBase * overallScaleFactor);
  ctx.font = `bold ${rankFontSize}px 'Arial', sans-serif`;
  ctx.fillStyle = suitColor;
  ctx.textBaseline = "bottom";
  ctx.fillText(
    displayRank,
    centeredX + displayWidth / 2,
    y + baseHeight - cardInternalPadding,
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

  const scoreBaseFontSize = 14;
  const scoreFontSize = Math.max(10, scoreBaseFontSize * overallScaleFactor);
  const scoreLineHeight = scoreFontSize * SCORE_TEXT_LINE_HEIGHT_FACTOR;
  ctx.font = `${scoreFontSize}px 'Arial', sans-serif`;

  const topScoreYStart = 15 * overallScaleFactor;
  let currentTopY = topScoreYStart; // Used to stack top scores if both are present

  // Potential Discard Score (Top Left)
  if (round > 0 && round <= GRID_SIZE && discardedCardsPile.length >= 2) {
    const potentialDiscardHand = evaluateLine(discardedCardsPile);
    if (potentialDiscardHand) {
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue("--base1")
        .trim();
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
      currentTopY += scoreLineHeight * 2 + 5 * overallScaleFactor;
    }
  }

  // Corner Scores (Top Right or below Discard if on left)
  if (lineScores.corners) {
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--yellow")
      .trim();
    ctx.textAlign = "right"; // Align to right for top-right placement
    ctx.textBaseline = "top";
    const cornerText1 = `Corners: ${lineScores.corners.type}`;
    const cornerText2 = `(${
      lineScores.corners.score * HAND_SCORES.CORNERS_MULTIPLIER
    })`;
    ctx.fillText(
      cornerText1,
      canvas.width - 15 * overallScaleFactor,
      topScoreYStart,
    );
    ctx.fillText(
      cornerText2,
      canvas.width - 15 * overallScaleFactor,
      topScoreYStart + scoreLineHeight,
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
      ctx.beginPath();
      ctx.roundRect(cellX, cellY, CELL_WIDTH, CELL_HEIGHT, [
        8 * overallScaleFactor,
      ]);
      ctx.stroke();

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
  ctx.font = `${scoreFontSize}px 'Arial', sans-serif`;

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
    // This now draws cards that are in motion from the top
    if (!draggingCard || draggingCard.id !== card.id)
      drawCard(card, card.x, card.y);
  });
  if (draggingCard) drawCard(draggingCard, draggingCard.x, draggingCard.y);

  updateGameMessagesUI();

  const discardPileStartX =
    GRID_OFFSET_X +
    GRID_TOTAL_WIDTH +
    SCORE_TEXT_OFFSET_X * 2 +
    80 * overallScaleFactor;
  const discardCardYStep = CARD_HEIGHT * 0.85 * 1.1;
  discardedCardsPile.forEach((card, index) => {
    const discardCardY = GRID_OFFSET_Y + index * discardCardYStep;
    drawCard(card, discardPileStartX, discardCardY, true);
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
  if (!highScoresList) return;
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
if (highScoresDiv) highScoresDiv.style.display = "none";
startGame();

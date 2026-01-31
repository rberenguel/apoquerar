import { haptic } from "./haptic.js";

// --- Constants & Config ---
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

// --- Game State ---
let deck = [];
let grid = Array(GRID_SIZE)
  .fill(null)
  .map(() => Array(GRID_SIZE).fill(null));
let currentHand = [];
let discardedCardsPile = [];
let round = 1;
let totalScore = 0;
let placedThisRoundCount = 0;
const HIGH_SCORES_KEY = "apo2_highscores";
const MAX_HIGH_SCORES = 5;

// --- DOM Elements ---
const lblTotalScore = document.getElementById("lbl-total-score");
const lblMultiplier = document.getElementById("lbl-multiplier");
const lblRound = document.getElementById("lbl-round");
const btnNext = document.getElementById("btn-next");
const btnRestart = document.getElementById("btn-restart");
const messageArea = document.getElementById("message-area");
const gridSlots = document.querySelectorAll("#board-assembly .slot");
const handSlots = document.querySelectorAll("#active-hand .hand-slot");
const discardSlots = document.querySelectorAll("#board-assembly .discard-slot");
const rowScoreSlots = Array.from({ length: 4 }, (_, i) =>
  document.getElementById(`row-score-${i}`),
);
const colScoreSlots = Array.from({ length: 4 }, (_, i) =>
  document.getElementById(`col-score-${i}`),
);
const cornersLabelContainer = document.getElementById(
  "corners-label-container",
);
const discardScoreContainer = document.getElementById("discard-score");
const scoreModal = document.getElementById("score-modal");
const btnModalClose = document.getElementById("modal-close-btn");
const helpModal = document.getElementById("help-modal");
const btnHelp = document.getElementById("btn-help");
const btnHelpClose = document.getElementById("help-close-btn");

// --- Core Logic ---

function createDeck() {
  deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}`, rank, suit, value: RANK_VALUES[rank] });
    }
  }
}

function shuffleDeck() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealCards() {
  if (round > GRID_SIZE) return;
  currentHand = deck.splice(0, 5).map((card) => ({ ...card, isNew: true }));
  placedThisRoundCount = 0;
  renderHand();

  if (round === GRID_SIZE) {
    btnNext.textContent = "Confirm & Finish Game";
  } else {
    btnNext.textContent = "Draw next";
  }

  updateStatus(`Round ${round}: Place 4 cards. 1 will be discarded.`);
}

// --- Rendering ---

function renderHand() {
  handSlots.forEach((slot, idx) => {
    const card = currentHand[idx];
    const existingCardEl = slot.querySelector(".card");

    if (!card) {
      if (existingCardEl) slot.innerHTML = "";
      return;
    }

    if (!existingCardEl || existingCardEl.dataset.cardId !== card.id) {
      slot.innerHTML = "";
      slot.appendChild(createCardElement(card));
    }
  });
}

function renderGrid() {
  gridSlots.forEach((slot) => {
    const r = parseInt(slot.dataset.r);
    const c = parseInt(slot.dataset.c);
    const card = grid[r][c];
    const existingCardEl = slot.querySelector(".card");

    if (!card) {
      if (existingCardEl) slot.innerHTML = "";
      return;
    }

    const isLockedState =
      (card.roundPlaced !== undefined && card.roundPlaced < round) ||
      card.isDiscarded;

    if (
      !existingCardEl ||
      existingCardEl.dataset.cardId !== card.id ||
      existingCardEl.classList.contains("locked") !== isLockedState
    ) {
      slot.innerHTML = "";
      slot.appendChild(createCardElement(card));
    }
  });
}

function renderDiscardPile() {
  discardSlots.forEach((slot, idx) => {
    const card = discardedCardsPile[idx];
    const existingCardEl = slot.querySelector(".card");

    if (!card) {
      if (existingCardEl) slot.innerHTML = "";
      return;
    }

    if (!existingCardEl || existingCardEl.dataset.cardId !== card.id) {
      slot.innerHTML = "";
      slot.appendChild(createCardElement(card));
    }
  });

  // Show discard hand if any
  const res = evaluateLine(discardedCardsPile);
  const existingLabel = discardScoreContainer.querySelector(".hand-label");
  const handKey = res ? `${res.type}-${res.score}` : "none";

  if (discardScoreContainer.dataset.lastHand !== handKey) {
    discardScoreContainer.innerHTML = "";
    if (res) {
      const bonusScore = res.score * HAND_SCORES.DISCARD_BONUS_MULTIPLIER;
      const el = document.createElement("div");
      el.className = "hand-label";
      el.innerHTML = `${res.type}<br><span>${bonusScore}</span><br><div style="font-size:0.55rem; opacity:0.6;">(x${HAND_SCORES.DISCARD_BONUS_MULTIPLIER} Score)</div>`;
      discardScoreContainer.appendChild(el);
    }
    discardScoreContainer.dataset.lastHand = handKey;
  }
}

function createCardElement(card) {
  const el = document.createElement("div");
  el.className = `card suit-${card.suit}`;
  el.dataset.cardId = card.id;
  if (card.isNew) {
    el.classList.add("new");
    // Stagger animation based on card index if in hand
    const cardIndex = currentHand.findIndex((c) => c.id === card.id);
    if (cardIndex !== -1) {
      el.style.animationDelay = `${cardIndex * 0.1}s`;
    }
    delete card.isNew;
  }

  // Distinguish previous rounds or discarded cards
  const isLocked =
    (card.roundPlaced !== undefined && card.roundPlaced < round) ||
    card.isDiscarded;
  const isActive =
    card.roundPlaced !== undefined &&
    card.roundPlaced === round &&
    !card.isDiscarded;

  if (isLocked) {
    el.classList.add("locked");
    el.draggable = false;
  } else {
    if (isActive) el.classList.add("active");
    el.draggable = true;
  }

  el.innerHTML = `
        <div class="rank">${card.rank === "T" ? "10" : card.rank}</div>
        <div class="suit">${getSuitSymbol(card.suit)}</div>
    `;

  if (el.draggable) {
    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", card.id);
      el.classList.add("dragging");
    });

    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
    });

    el.addEventListener(
      "touchstart",
      (e) => {
        if (isLocked) return;
        const touch = e.touches[0];
        el.dataset.dragStartX = touch.clientX;
        el.dataset.dragStartY = touch.clientY;
        el.classList.add("dragging");
        el.classList.add("touch-dragging");
        // Prevent scrolling while dragging card
        e.preventDefault();
      },
      { passive: false },
    );

    el.addEventListener(
      "touchmove",
      (e) => {
        if (isLocked) return;
        const touch = e.touches[0];
        const dx = touch.clientX - parseFloat(el.dataset.dragStartX);
        const dy = touch.clientY - parseFloat(el.dataset.dragStartY);
        el.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;
        el.style.zIndex = "1000";
        e.preventDefault();
      },
      { passive: false },
    );

    el.addEventListener("touchend", (e) => {
      if (isLocked) return;

      const touch = e.changedTouches[0];
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetSlot = targetEl
        ? targetEl.closest(".slot, .hand-slot, .discard-slot")
        : null;

      el.classList.remove("dragging");
      el.classList.remove("touch-dragging");
      el.style.transform = "";
      el.style.zIndex = "";

      if (targetSlot) {
        executeDrop(card.id, targetSlot);
      }
    });
  }

  return el;
}

function getSuitSymbol(suit) {
  return { H: "♥", D: "♦", C: "♣", S: "♠" }[suit];
}

function updateStatus(msg) {
  messageArea.textContent = msg;
}

// --- Drag & Drop Handlers ---

function setupDragAndDrop() {
  [...gridSlots, ...handSlots, ...discardSlots].forEach((slot) => {
    slot.addEventListener("dragover", (e) => e.preventDefault());
    slot.addEventListener("drop", handleDrop);
  });
}

function handleDrop(e) {
  e.preventDefault();
  const cardId = e.dataTransfer.getData("text/plain");
  const targetSlot = e.target.closest(".slot, .hand-slot, .discard-slot");
  if (targetSlot) {
    executeDrop(cardId, targetSlot);
  }
}

function executeDrop(cardId, targetSlot) {
  if (!targetSlot) return;

  // Find card in hand or grid
  let card = currentHand.find((c) => c.id === cardId);
  let fromGrid = false;
  let fromR, fromC;

  if (!card) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] && grid[r][c].id === cardId) {
          card = grid[r][c];
          fromGrid = true;
          fromR = r;
          fromC = c;
          break;
        }
      }
      if (card) break;
    }
  }

  if (!card) {
    // Check if card is already in a discard slot (moving it back)
    const discIdx = discardedCardsPile.findIndex((c) => c && c.id === cardId);
    if (discIdx !== -1) {
      card = discardedCardsPile[discIdx];
    }
  }

  if (!card) return;

  // Handle dropping onto grid
  if (targetSlot.classList.contains("slot")) {
    const toR = parseInt(targetSlot.dataset.r);
    const toC = parseInt(targetSlot.dataset.c);

    if (grid[toR][toC]) return; // Slot occupied

    if (!fromGrid && placedThisRoundCount >= 4) {
      updateStatus("You can only place 4 cards on the grid this round.");
      return;
    }

    grid[toR][toC] = card;
    card.roundPlaced = round; // Tag card with current round
    if (!fromGrid) {
      currentHand = currentHand.filter((c) => c.id !== cardId);
      placedThisRoundCount++;
    } else {
      grid[fromR][fromC] = null;
    }
    haptic();
  }
  // Handle dropping onto discard pile
  else if (targetSlot.classList.contains("discard-slot")) {
    const slotIdx = parseInt(targetSlot.id.split("-")[1]);
    if (slotIdx !== round - 1) return; // Only allow discarding for the current round slot
    if (discardedCardsPile[slotIdx]) return; // Slot occupied (could implement swap later)

    if (fromGrid) {
      grid[fromR][fromC] = null;
      placedThisRoundCount--;
    } else {
      currentHand = currentHand.filter((c) => c.id !== cardId);
    }

    card.isDiscarded = true;
    discardedCardsPile[slotIdx] = card;
    haptic();
  }
  // Handle dropping back to hand
  else if (targetSlot.classList.contains("hand-slot")) {
    if (fromGrid) {
      grid[fromR][fromC] = null;
      currentHand.push(card);
      placedThisRoundCount--;
      haptic();
    } else if (card.isDiscarded) {
      // Remove from discard pile
      const discIdx = discardedCardsPile.findIndex((c) => c && c.id === cardId);
      if (discIdx !== -1) {
        discardedCardsPile[discIdx] = null;
        card.isDiscarded = false;
        currentHand.push(card);
        haptic();
      }
    }
  }

  renderGrid();
  renderHand();
  renderDiscardPile();
  evaluateAllBoardScores();
}

// --- Evaluation (Ported and simplified from apoquerar) ---

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

  if (actualCards.length === 4) {
    const isFlush = suits.every((s) => s === suits[0]);
    let isStraight = true;
    for (let i = 0; i < 3; i++)
      if (ranks[i + 1] !== ranks[i] + 1) isStraight = false;

    if (isStraight && isFlush)
      return { type: "Str Flush", score: HAND_SCORES.STRAIGHT_FLUSH };
    if (counts[0] === 4)
      return { type: "4 of Kind", score: HAND_SCORES.FOUR_OF_A_KIND };
    if (isFlush) return { type: "Flush", score: HAND_SCORES.FLUSH };
    if (isStraight) return { type: "Straight", score: HAND_SCORES.STRAIGHT };
    if (counts[0] === 3)
      return { type: "3 of Kind", score: HAND_SCORES.THREE_OF_A_KIND };
    if (counts[0] === 2 && counts[1] === 2)
      return { type: "2 Pair", score: HAND_SCORES.TWO_PAIR };
    if (counts[0] === 2) return { type: "Pair", score: HAND_SCORES.PAIR };
  } else if (actualCards.length >= 2) {
    if (counts[0] === 3)
      return { type: "3 of Kind", score: HAND_SCORES.THREE_OF_A_KIND };
    if (counts[0] === 2) return { type: "Pair", score: HAND_SCORES.PAIR };
  }
  return null;
}

function evaluateAllBoardScores() {
  let rawScore = 0;
  let madeHandsCount = 0;

  // Helper to update specific slot
  const updateLineLabel = (slot, res, isVertical) => {
    const handKey = res ? `${res.type}-${res.score}` : "none";

    if (slot.dataset.lastHand !== handKey) {
      slot.innerHTML = "";
      if (res) {
        slot.appendChild(createHandLabel(res, isVertical));
      }
      slot.dataset.lastHand = handKey;
    }
  };

  for (let r = 0; r < GRID_SIZE; r++) {
    const res = evaluateLine(grid[r]);
    if (res) {
      rawScore += res.score;
      madeHandsCount++;
    }
    updateLineLabel(rowScoreSlots[r], res, true);
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    const colCards = grid.map((row) => row[c]);
    const res = evaluateLine(colCards);
    if (res) {
      rawScore += res.score;
      madeHandsCount++;
    }
    updateLineLabel(colScoreSlots[c], res, false);
  }

  const corners = [grid[0][0], grid[0][3], grid[3][0], grid[3][3]];
  const resCorners = evaluateLine(corners);
  const cornerKey = resCorners
    ? `${resCorners.type}-${resCorners.score}`
    : "none";

  if (cornersLabelContainer.dataset.lastHand !== cornerKey) {
    cornersLabelContainer.innerHTML = "";
    if (resCorners) {
      const bonusAmount = resCorners.score * HAND_SCORES.CORNERS_MULTIPLIER;
      rawScore += bonusAmount;
      madeHandsCount++;
      cornersLabelContainer.innerHTML = `<div class="corners-label">4 Corners: ${resCorners.type} (x2 Score)</div>`;
    }
    cornersLabelContainer.dataset.lastHand = cornerKey;
  } else if (resCorners) {
    // Still need to add to score even if not re-rendering
    rawScore += resCorners.score * HAND_SCORES.CORNERS_MULTIPLIER;
    madeHandsCount++;
  }

  const multiplier = getScoreMultiplier(madeHandsCount);
  totalScore = rawScore * multiplier;

  lblTotalScore.textContent = totalScore;
  lblMultiplier.textContent = multiplier;

  return { rawScore, madeHandsCount, multiplier };
}

function createHandLabel(res, isVertical = false) {
  const el = document.createElement("div");
  el.className = "hand-label";
  if (isVertical) el.classList.add("vertical");

  // Shorten types for vertical display if too long
  let typeDisplay = res.type;
  if (isVertical) {
    if (typeDisplay === "3 of Kind") typeDisplay = "3-Kind";
    if (typeDisplay === "4 of Kind") typeDisplay = "4-Kind";
    if (typeDisplay === "Str Flush") typeDisplay = "S-Flush";
  }

  el.innerHTML = isVertical
    ? `${typeDisplay}<br><span>${res.score}</span>`
    : `${typeDisplay}: <span>${res.score}</span>`;
  return el;
}

function getScoreMultiplier(hands) {
  if (hands >= 10) return 7;
  if (hands >= 9) return 6;
  if (hands >= 7) return 5;
  if (hands >= 5) return 4;
  if (hands >= 3) return 3;
  if (hands >= 1) return 2;
  return 1;
}

// --- Initialization ---

btnNext.addEventListener("click", () => {
  if (round > GRID_SIZE) return;

  // In proactive mode, we check if 4 are on board and 1 is in discard
  let discardForThisRound = discardedCardsPile[round - 1];

  // Fallback: If no proactive discard, but 4 cards placed and 1 left in hand -> auto-discard
  if (
    placedThisRoundCount === 4 &&
    !discardForThisRound &&
    currentHand.length === 1
  ) {
    const cardToAutoDiscard = currentHand[0];
    cardToAutoDiscard.isDiscarded = true;
    discardedCardsPile[round - 1] = cardToAutoDiscard;
    currentHand = [];
    discardForThisRound = cardToAutoDiscard;
  }

  if (placedThisRoundCount === 4 && discardForThisRound) {
    if (round === GRID_SIZE) {
      endGame();
    } else {
      round++;
      dealCards();
    }
    renderHand();
    renderGrid();
    renderDiscardPile();
  } else {
    updateStatus("Place 4 cards on grid and 1 in the discard slot.");
  }
  lblRound.textContent = Math.min(round, GRID_SIZE);
});

function endGame() {
  round++; // Move to state after round 4
  const boardResults = evaluateAllBoardScores();
  let finalRawScore = boardResults.rawScore;
  let finalMadeHandsCount = boardResults.madeHandsCount;
  let cornersReached = cornersLabelContainer.innerHTML !== "";
  let discardBonusReached = false;

  // Discard bonus logic: all 9 board hands made
  if (
    finalMadeHandsCount === GRID_SIZE * 2 + 1 &&
    discardedCardsPile.length === GRID_SIZE
  ) {
    const discardRes = evaluateLine(discardedCardsPile);
    if (discardRes) {
      const bonus = discardRes.score * HAND_SCORES.DISCARD_BONUS_MULTIPLIER;
      finalRawScore += bonus;
      finalMadeHandsCount++;
      discardBonusReached = true;
      updateStatus(`Giga Bonus! Discarded ${discardRes.type}: +${bonus} raw!`);
    } else {
      updateStatus("Game Over! All board hands made, but no discard bonus.");
    }
  } else {
    updateStatus("Game Over!");
  }

  const finalMultiplier = getScoreMultiplier(finalMadeHandsCount);
  totalScore = finalRawScore * finalMultiplier;

  lblTotalScore.textContent = totalScore;
  lblMultiplier.textContent = finalMultiplier;

  // Fill Modal
  document.getElementById("modal-raw-score").textContent = finalRawScore;
  const cornBadge = document.getElementById("modal-corners-status");
  cornBadge.textContent = cornersReached ? "Active" : "None";
  cornBadge.className = cornersReached ? "status-badge active" : "status-badge";

  const discBadge = document.getElementById("modal-discard-status");
  discBadge.textContent = discardBonusReached ? "Active" : "None";
  discBadge.className = discardBonusReached
    ? "status-badge active"
    : "status-badge";

  document.getElementById("modal-multiplier").textContent =
    `x${finalMultiplier}`;
  document.getElementById("modal-total-score").textContent = totalScore;

  saveHighScore(totalScore);
  displayHighScores(totalScore);

  scoreModal.style.display = "flex";

  btnNext.style.display = "none";
  btnRestart.style.display = "inline-block";
  haptic(100);
}

function saveHighScore(score) {
  if (score <= 0) return;
  let highScores = JSON.parse(localStorage.getItem(HIGH_SCORES_KEY) || "[]");
  highScores.push({ score, date: new Date().toISOString() });
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, MAX_HIGH_SCORES);
  localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(highScores));
}

function displayHighScores(currentScore) {
  const list = document.getElementById("high-scores-list");
  const highScores = JSON.parse(localStorage.getItem(HIGH_SCORES_KEY) || "[]");
  list.innerHTML = "";

  highScores.forEach((entry, idx) => {
    const el = document.createElement("div");
    el.className = "high-score-entry";
    if (entry.score === currentScore) {
      el.classList.add("new-record");
    }
    el.innerHTML = `<span>#${idx + 1}</span> <strong>${entry.score}</strong>`;
    list.appendChild(el);
  });
}

btnRestart.addEventListener("click", resetGame);
btnModalClose.addEventListener("click", () => {
  scoreModal.style.display = "none";
  resetGame();
});

// Help Modal
btnHelp.addEventListener("click", () => {
  helpModal.style.display = "flex";
  haptic(50);
});
btnHelpClose.addEventListener(
  "click",
  () => (helpModal.style.display = "none"),
);
window.addEventListener("click", (e) => {
  if (e.target === helpModal) helpModal.style.display = "none";
  if (e.target === scoreModal) scoreModal.style.display = "none";
});

function resetGame() {
  btnRestart.style.display = "none";
  btnNext.style.display = "inline-block";
  btnNext.disabled = false;
  btnNext.textContent = "Deal Cards";

  totalScore = 0;
  round = 1;
  grid = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill(null));
  discardedCardsPile = [];
  currentHand = [];

  lblTotalScore.textContent = "0";
  lblMultiplier.textContent = "1";
  lblRound.textContent = "1";

  // Explicitly clear DOM state to avoid carrying over visuals
  renderGrid();
  renderDiscardPile();
  evaluateAllBoardScores();

  init();
}

function init() {
  createDeck();
  shuffleDeck();
  setupDragAndDrop();
  dealCards();
}

init();

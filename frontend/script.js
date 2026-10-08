"use strict";

// Point this at the backend (same value as the server's PORT / deployed URL).
const SERVER_URL =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://pig-game-z6o6.onrender.com";
const socket = io(SERVER_URL);

// ---------- elements ----------
const scoreEls = [
  document.getElementById("score--0"),
  document.getElementById("score--1"),
];
const currentEls = [
  document.getElementById("current--0"),
  document.getElementById("current--1"),
];
const nameEls = [
  document.getElementById("name--0"),
  document.getElementById("name--1"),
];
const playerEls = [
  document.querySelector(".player--0"),
  document.querySelector(".player--1"),
];

const diceEl = document.querySelector(".dice");
const btnNew = document.querySelector(".btn--new");
const btnRoll = document.querySelector(".btn--roll");
const btnHold = document.querySelector(".btn--hold");
const statusEl = document.getElementById("status");

const rematchPrompt = document.getElementById("rematch-prompt");
const rematchAccept = document.getElementById("rematch-accept");
const rematchDecline = document.getElementById("rematch-decline");

const lobby = document.getElementById("lobby");
const lobbyForm = document.getElementById("lobby-form");
const lobbyMsg = document.getElementById("lobby-msg");
const createRoomBtn = document.getElementById("create-room");
const joinRoomBtn = document.getElementById("join-room");
const roomInput = document.getElementById("room-input");

// ---------- client state ----------
// The server owns the real game state. These are only what we need to render
// and to decide which buttons are usable.
let mySeat = null; // 0 or 1, assigned by the server in room:ready
let activePlayer = 0;
let playing = false; // a round is in progress
let mustLeave = false; // opponent left or declined: "New game" means a fresh page

// ---------- helpers ----------
const setStatus = (msg) => (statusEl.textContent = msg);

const turnMessage = () =>
  activePlayer === mySeat ? "Your turn" : "Opponent's turn";

const renderControls = () => {
  const myTurn = playing && activePlayer === mySeat;
  btnRoll.disabled = !myTurn;
  btnHold.disabled = !myTurn;
  // New game is only usable once a round is over (rematch) or the room is dead (new room)
  btnNew.disabled = playing || mySeat === null;
};

const renderScores = (state) => {
  scoreEls[0].textContent = state.scores[0];
  scoreEls[1].textContent = state.scores[1];
  // the server tracks one running "current" for whoever's turn it is
  currentEls[0].textContent = state.activePlayer === 0 ? state.current : 0;
  currentEls[1].textContent = state.activePlayer === 1 ? state.current : 0;
};

const renderActive = () => {
  playerEls[0].classList.toggle(
    "player--active",
    playing && activePlayer === 0,
  );
  playerEls[1].classList.toggle(
    "player--active",
    playing && activePlayer === 1,
  );
};

const clearWinner = () => {
  // clear on BOTH players, not just the currently active one
  playerEls.forEach((el) => el.classList.remove("player--winner"));
};

const showDice = (value) => {
  diceEl.classList.remove("hidden");
  diceEl.src = `dice-${value}.png`;
};

// ---------- lobby ----------
createRoomBtn.addEventListener("click", () => {
  createRoomBtn.disabled = true;
  lobbyMsg.textContent = "Creating room…";
  socket.emit("room:create");
});

const joinRoom = () => {
  const code = roomInput.value.trim().toUpperCase();
  if (code.length !== 6) {
    lobbyMsg.textContent = "Room codes are 6 characters.";
    return;
  }
  lobbyMsg.textContent = "Joining…";
  socket.emit("room:join", code);
};
joinRoomBtn.addEventListener("click", joinRoom);
roomInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinRoom();
});

socket.on("room:created", (roomCode) => {
  lobbyForm.classList.add("hidden");
  lobbyMsg.innerHTML = `Room is ready!<br>Send this code to your opponent:<br><span class="room-code">${roomCode}</span>`;
});

socket.on("room:not-found", ({ message }) => {
  lobbyMsg.textContent = `${message}. Check the code and try again.`;
});

socket.on("room:full", ({ message }) => {
  lobbyMsg.textContent = `${message}. Ask for a new room code.`;
});

socket.on("room:ready", ({ seat }) => {
  mySeat = seat;
  nameEls[seat].textContent = "You";
  nameEls[1 - seat].textContent = "Opponent";
});

// ---------- game flow (everything below reacts to the server) ----------
socket.on("game:start", (state) => {
  playing = true;
  activePlayer = state.activePlayer;

  clearWinner();
  diceEl.classList.add("hidden");
  rematchPrompt.classList.add("hidden");
  lobby.classList.add("hidden");

  renderScores(state);
  renderActive();
  renderControls();
  setStatus(turnMessage());
});

socket.on("game:state", (state) => {
  activePlayer = state.activePlayer;

  if (state.dice !== undefined) showDice(state.dice);
  renderScores(state);
  renderActive();
  renderControls();

  if (state.dice === 1) {
    setStatus(
      state.rolledBy === mySeat
        ? "You rolled a 1. Turn lost."
        : "Opponent rolled a 1. Your turn.",
    );
  } else {
    setStatus(turnMessage());
  }
});

socket.on("game:winner", ({ winnerSeat, reason }) => {
  playing = false;
  diceEl.classList.add("hidden");

  // On a disconnect the only player left is the winner, whatever seat the
  // server reports, so don't trust winnerSeat in that case.
  const iWon = reason === "disconnect" ? true : winnerSeat === mySeat;
  const winnerIdx = iWon ? mySeat : 1 - mySeat;

  playerEls[winnerIdx].classList.add("player--winner");
  playerEls[0].classList.remove("player--active");
  playerEls[1].classList.remove("player--active");

  if (reason === "disconnect") {
    mustLeave = true;
    setStatus("Opponent left. You win!");
  } else {
    setStatus(iWon ? "You win! " : "Opponent wins.");
  }
  renderControls();
});

// ---------- actions ----------
btnRoll.addEventListener("click", () => {
  if (playing && activePlayer === mySeat) socket.emit("pig:roll");
});

btnHold.addEventListener("click", () => {
  if (playing && activePlayer === mySeat) socket.emit("pig:hold");
});

// ---------- rematch ----------
btnNew.addEventListener("click", () => {
  if (mustLeave) {
    location.reload(); // back to the lobby to make or join a new room
    return;
  }
  btnNew.disabled = true;
  setStatus("Rematch requested. Waiting for your opponent…");
  socket.emit("game:rematch-request");
});

socket.on("game:rematch-request", () => {
  setStatus("Opponent wants a rematch.");
  rematchPrompt.classList.remove("hidden");
});

rematchAccept.addEventListener("click", () => {
  rematchPrompt.classList.add("hidden");
  socket.emit("game:rematch-accepted"); // server replies with game:start
});

rematchDecline.addEventListener("click", () => {
  rematchPrompt.classList.add("hidden");
  socket.emit("game:rematch-declined");
});

socket.on("game:rematch-declined", () => {
  rematchPrompt.classList.add("hidden");
  mustLeave = true;
  setStatus("No rematch. Hit New game to start a fresh room.");
  btnNew.disabled = false;
});

// ---------- connection health ----------
socket.on("connect_error", () => {
  lobbyMsg.textContent = "Can't reach the server. Is the backend running?";
  createRoomBtn.disabled = false;
});

socket.on("disconnect", () => {
  playing = false;
  mustLeave = true;
  setStatus("Connection lost.");
  btnRoll.disabled = true;
  btnHold.disabled = true;
  btnNew.disabled = false;
});

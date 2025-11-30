'use strict';

// selecting elements
const score0El = document.querySelector('#score--0');
const score1El = document.getElementById('score--1');
const current0EL = document.getElementById('current--0');
const current1EL = document.getElementById('current--1');

const diceEl = document.querySelector('.dice');
const btnNew = document.querySelector('.btn--new');
const btnRoll = document.querySelector('.btn--roll');
const btnold = document.querySelector('.btn--hold');

const newplay = document.querySelector('.player--1');
const oldplay = document.querySelector('.player--0');

let scores, currentscore, activePlayer, playing;

const init = function () {
  scores = [0, 0];
  currentscore = 0;
  activePlayer = 0;
  playing = true;

  score0El.textContent = 0;
  score1El.textContent = 0;
  current0EL.textContent = 0;
  current1EL.textContent = 0;
  diceEl.classList.add('hidden');

  document
    .querySelector(`.player--${activePlayer}`)
    .classList.remove(`player--winner`);

  oldplay.classList.add('player--active');
  newplay.classList.remove('player--active');
};

init();

// starting conditions
score0El.textContent = 0;
score1El.textContent = 0;
diceEl.classList.add('hidden');
// switch player

const switchPlayer = function () {
  document.getElementById(`current--${activePlayer}`).textContent = 0;
  activePlayer = activePlayer === 0 ? 1 : 0;
  currentscore = 0;
  oldplay.classList.toggle('player--active');
  newplay.classList.toggle('player--active');
};

// rolling dice functionality
btnRoll.addEventListener('click', function () {
  if (playing) {
    const dice = Math.trunc(Math.random() * 6) + 1;
    console.log(dice);
    // 1.generating a random dice roll

    // 2 display dice
    diceEl.classList.remove('hidden');
    diceEl.src = `dice-${dice}.png`;

    // 3. check for rolled 1: if true ,switch to next player
    if (dice !== 1) {
      // add dice to current score
      currentscore += dice;
      document.getElementById(`current--${activePlayer}`).textContent =
        currentscore;
      // current0EL.textContent = currentscore;
    } else {
      // switch to next person
      // oldplay.classList.remove('player--active');
      // newplay.classList.add('player--active');
      switchPlayer();
    }
  }
});

btnold.addEventListener('click', function () {
  if (playing) {
    // add current score to active player
    scores[activePlayer] += currentscore;
    // scores[1] = scores[1] + currentscore
    document.getElementById(`score--${activePlayer}`).textContent =
      scores[activePlayer];
    // check if player score is less than 100
    if (scores[activePlayer] >= 100) {
      playing = false;
      document
        .querySelector(`.player--${activePlayer}`)
        .classList.add(`player--winner`);
      diceEl.classList.add('hidden');

      document
        .querySelector(`.player--${activePlayer}`)
        .classList.remove(`player--active`);
    } else {
      // switch to the next player
      switchPlayer();
    }
    // finish the game
  }
});

// restarting the game

btnNew.addEventListener('click', init);

// when i restart
// all values reset
// but values are still stored so they are added to the scores

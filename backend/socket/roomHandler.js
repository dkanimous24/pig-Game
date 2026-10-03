const WIN_SCORE = 100;
const rooms = new Map(); // roomCode -> { players, scores, current, active, started, finished, rematchTimeout }

const generateRoomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const resetGame = (room) => {
  room.scores = [0, 0];
  room.current = 0;
  room.active = 0;
  room.finished = false;
  room.started = true;
};

const snapshot = (room, extra = {}) => ({
  scores: room.scores,
  current: room.current,
  activePlayer: room.active,
  ...extra,
});

const cleanupRoom = (roomCode) => {
  const room = rooms.get(roomCode);
  if (room?.rematchTimeout) clearTimeout(room.rematchTimeout);
  rooms.delete(roomCode);
};

const clearRematch = (room) => {
  if (room.rematchTimeout) clearTimeout(room.rematchTimeout);
  room.rematchTimeout = null;
};

const roomHandler = (io, socket) => {
  socket.on("room:create", () => {
    const roomCode = generateRoomCode();
    socket.join(roomCode);
    socket.roomCode = roomCode;

    rooms.set(roomCode, {
      players: [socket.id], // index in this array = seat (0 or 1)
      scores: [0, 0],
      current: 0,
      active: 0,
      started: false,
      finished: false,
      rematchTimeout: null,
    });

    socket.emit("room:created", roomCode);
  });

  socket.on("room:join", (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room) return socket.emit("room:not-found", { message: "Room does not exist" });
    if (room.players.length >= 2) return socket.emit("room:full", { message: "Room is full" });

    socket.join(roomCode);
    socket.roomCode = roomCode;
    room.players.push(socket.id);

    // tell each client which seat they hold
    room.players.forEach((id, seat) => io.to(id).emit("room:ready", { seat }));

    resetGame(room);
    io.to(roomCode).emit("game:start", snapshot(room));
  });

  socket.on("pig:roll", () => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.started || room.finished) return;
    if (room.players[room.active] !== socket.id) return; // not your turn

    const dice = Math.trunc(Math.random() * 6) + 1;
    const seat = room.active;

    if (dice === 1) {
      room.current = 0;
      room.active = 1 - room.active;
    } else {
      room.current += dice;
    }

    io.to(socket.roomCode).emit("game:state", snapshot(room, { dice, rolledBy: seat }));
  });

  socket.on("pig:hold", () => {
    const room = rooms.get(socket.roomCode);
    if (!room || !room.started || room.finished) return;
    if (room.players[room.active] !== socket.id) return;

    const seat = room.active;
    room.scores[seat] += room.current;
    room.current = 0;

    if (room.scores[seat] >= WIN_SCORE) {
      room.finished = true;
      io.to(socket.roomCode).emit("game:state", snapshot(room));
      io.to(socket.roomCode).emit("game:winner", { winnerSeat: seat, reason: "finished" });
      return;
    }

    room.active = 1 - room.active;
    io.to(socket.roomCode).emit("game:state", snapshot(room));
  });

  socket.on("game:rematch-request", () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.players.length < 2 || !room.finished) return;

    socket.to(socket.roomCode).emit("game:rematch-request");
    clearRematch(room);
    room.rematchTimeout = setTimeout(() => {
      io.to(socket.roomCode).emit("game:rematch-declined");
      room.rematchTimeout = null;
    }, 30000);
  });

  socket.on("game:rematch-accepted", () => {
    const room = rooms.get(socket.roomCode);
    if (!room || room.players.length < 2 || !room.finished) return;

    clearRematch(room);
    resetGame(room);
    io.to(socket.roomCode).emit("game:start", snapshot(room));
  });

  socket.on("game:rematch-declined", () => {
    const room = rooms.get(socket.roomCode);
    if (!room) return;
    clearRematch(room);
    io.to(socket.roomCode).emit("game:rematch-declined");
  });

  socket.on("disconnect", () => {
    const roomCode = socket.roomCode;
    const room = rooms.get(roomCode);
    if (!room) return;

    clearRematch(room);
    room.players = room.players.filter((id) => id !== socket.id);

    if (room.players.length === 0) return cleanupRoom(roomCode);

    if (room.started && !room.finished) {
      room.finished = true;
      io.to(roomCode).emit("game:winner", { winnerSeat: 0, reason: "disconnect" });
    }
  });
};

module.exports = roomHandler;

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const roomHandler = require("./socket/roomHandler");

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;
// comma-separated, so one value can allow both local dev and the deployed site
const origins = (process.env.CLIENT_URL || "http://localhost:5500").split(",");

const io = new Server(server, {
  cors: { origin: origins, methods: ["GET", "POST"], credentials: true },
});

app.use(cors({ origin: origins, credentials: true }));

app.get("/health", (req, res) => res.send("ok"));

io.on("connection", (socket) => roomHandler(io, socket));

server.listen(port, () => console.log(`Listening on: ${port}`));

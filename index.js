require("dotenv").config();
const env = process.env.NODE_ENV || "development";
const config = require("./config/core")[env];
const configDB = require("./config/db")[env];
const cors = require("cors");
const express = require("express");
const socketIo = require("socket.io");
const app = express();
const server = require("http").Server(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("New Client connected");

  socket.on("join", (room) => {
    socket.join(room);
  });

  socket.on("message", ({ room, message }) => {
    console.log("message : ", message);
    const { action } = message;

    if (action == "add-device") {
    } else if (action == "send-message") {
    } else if (action == "close-session") {
    } else if (action == "end-session") {
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const port = config.port;
server.listen(port, () => console.log(`Socket Listening on port ${port}`));

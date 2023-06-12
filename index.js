require("dotenv").config();
const {
  addDevice,
  closeSession,
  endSession,
  sendMessage,
} = require("./lib/tool");
const env = process.env.NODE_ENV || "development";
const config = require("./config/core")[env];
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
    const { action, data } = message;

    if (action == "add-device") {
      addDevice(room, socket);
    } else if (action == "send-message") {
      sendMessage(room, socket, data);
    } else if (action == "close-session") {
      closeSession(room, socket);
    } else if (action == "end-session") {
      endSession(room, socket);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const port = config.port;
server.listen(port, () => console.log(`Socket Listening on port ${port}`));

/**
 * - DOCS
 * add-device (add new device for multiple connection)
 * close-session (close the session properly to ensure the session is saved for the next time you log in)
 * end-session (delete session)
 * send-message (send new message when session active)
 * 
 * payload request
 *{
    "room": "room1",
    "message": {
        "action": "send-message",
        "data": {
            "direction": "08388562496",
            "message": "Testing"
        }
    }
  }
 */

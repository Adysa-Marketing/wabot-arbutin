require("dotenv").config();
const {
  addDevice,
  closeSession,
  endSession,
  reConnect,
} = require("./lib/tool");
const env = process.env.NODE_ENV || "development";
const config = require("./config/core")[env];
const express = require("express");
const cors = require("cors");
const socketIo = require("socket.io");
const app = express();
const server = require("http").Server(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
});
const { WaBot } = require("./models");
const apiWa = require("./api/wa");

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/", apiWa);

// Reconnect instance
async function running() {
  try {
    let clientInstance = await WaBot.findAll({
      attributes: ["id", "key", "status", "remark"],
      where: {
        status: 1,
      },
    });

    if (clientInstance.length) {
      clientInstance = JSON.parse(JSON.stringify(clientInstance));
      for (const instance of clientInstance) {
        await reConnect(instance.key);
      }
    }

    io.on("connection", (socket) => {
      console.log("New Client connected");

      socket.on("join", (room) => {
        console.log("join : ", room);
        socket.join(room);
      });

      socket.on("message", ({ room, message }) => {
        console.log("message : ", message);
        const { action } = message;

        if (action == "add-device") {
          addDevice(room, socket);
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
  } catch (error) {
    console.log(`[!] Error : `, error);
  }
}

running();
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

const venom = require("venom-bot");
const fs = require("fs-extra");
const path = require("path");
const { WaBot } = require("../../models");

/**Add Devices */
let dataSession = [];
async function addDevice(sessionKey, socket) {
  try {
    const session = await WaBot.findOne({
      attributes: ["status"],
      where: {
        key: sessionKey.toString(),
      },
    });
    const exist = dataSession.find(
      (session) => session.sessionKey == sessionKey
    );

    if (session && session.status == 1 && exist) {
      emitSocket(socket, sessionKey, 409, "Session anda masih aktif");
    } else {
      venom
        .create(sessionKey, (base64Qrimg) => {
          // send qrcode
          emitSocket(socket, sessionKey, 201, base64Qrimg);
        })
        .then(async (client) => {
          exist
            ? (exist.client = client)
            : dataSession.push({ client, sessionKey });

          await WaBot.update(
            { status: 1 },
            { where: { key: sessionKey } }
          );

          // Listen to state changes
          client.onStateChange((state) => {
            console.log("state : ", state);
            if (state === "CONFLICT" || state === "UNLAUNCHED") {
              endSession(sessionKey, socket);
              return;
            }
            if (state === "CONNECTED") {
              emitSocket(socket, sessionKey, 200, "Success Continue Session");
            }
          });

          start(client, socket, sessionKey);
        })
        .catch(async (error) => {
          session &&
            (await WaBot.update(
              { status: 0 },
              { where: { key: sessionKey } }
            ));
          console.log("error : ", error);
          emitSocket(socket, sessionKey, 500, error);
        });
    }
  } catch (error) {
    console.log("error : ", error.message);
    if (error == "Not Logged") {
      session &&
        (await WaBot.update(
          { status: 0 },
          { where: { key: sessionKey } }
        ));
    }
    emitSocket(socket, sessionKey, 500, error.message);
  }
}

/**
 * start manage message
 */
async function start(client, socket, sessionKey) {
  try {
    emitSocket(socket, sessionKey, 200, "Login Success");

    await client.onMessage(async (message) => {
      console.log("[!] Pesan masuk : ", message.body);
    });
  } catch (error) {
    console.log("error : ", error);
    emitSocket(socket, sessionKey, 500, error);
  }
}

/**
 * manual send message
 */
async function sendMessage(sessionName, socket, data) {
  // cari data session
  const session = await WaBot.findOne({
    attributes: ["id"],
    where: { key: sessionName, status: 1 },
  });
  const exist = dataSession.find(
    (session) => session.sessionName == sessionName
  );

  if (session && exist) {
    const { direction, message } = data;
    const regex = /^62/;
    let phoneNumber;
    if (!regex.test(direction)) {
      // Menghapus karakter awal '0' jika ada
      phoneNumber = direction.replace(/^0+/, "");
      // Menambahkan kode negara '62' di depan nomor
      phoneNumber = "62" + phoneNumber;
    } else {
      phoneNumber = direction;
    }

    exist.client
      .sendText(`${phoneNumber}@c.us`, message)
      .then((response) => console.log("[!] send message"))
      .catch((error) => {
        console.log("[!] filed send message : ", error);
        emitSocket(socket, configSocket.room, 500, error);
      });
  } else {
    console.log("[!] session tidak ditemukan");
    emitSocket(socket, configSocket.room, 404, "[!] session tidak ditemukan");
  }
}

/**
 * Close session
 * Close the session properly to ensure the session is saved for the next time you log in
 * */
async function closeSession(sessionKey, socket) {
  // cari data session
  try {
    const session = await WaBot.findOne({
      attributes: ["id"],
      key: sessionKey,
    });
    const exist = dataSession.find(
      (session) => session.sessionKey == sessionKey
    );

    if (session && exist) {
      exist.client
        .close()
        .then(async () => {
          // update status
          console.log(`Close Session ${sessionKey}`);
          dataSession = dataSession.filter(
            (session) => session.sessionKey !== sessionKey
          );
          emitSocket(socket, sessionKey, 200, "Sukses menutup session");
          await WaBot.update(
            { status: 0 },
            { where: { key: sessionKey } }
          );
        })
        .catch((err) => {
          const message = `Terjadi kesalahan saat mengakhiri session ${sessionKey} : ${err}`;
          console.log(message);
          emitSocket(socket, sessionKey, 500, message);
        });
    } else {
      console.log("[!] session tidak ditemukan");
      await WaBot.update({ status: 0 }, { where: { key: sessionKey } });
      emitSocket(socket, sessionKey, 404, "Session tidak ditemukan");
    }
  } catch (error) {
    console.log("error : ", error.message);
    emitSocket(socket, sessionKey, 500, error.message);
  }
}

/**
 * end session
 * Close and delete session and you need to scan qr code again when you log in
 */
async function endSession(sessionKey, socket) {
  // cari data session
  const exist = dataSession.find((session) => session.sessionKey == sessionKey);
  const sessionPath = path.resolve(__dirname, `../../tokens/${sessionKey}`);
  try {
    exist &&
      (await exist.client.close()) &&
      (dataSession = dataSession.filter(
        (session) => session.sessionKey !== sessionKey
      ));
    await fs.emptyDir(sessionPath);
    await fs.remove(sessionPath);
    emitSocket(socket, sessionKey, 200, `Sukses menghapus instance`);
  } catch (error) {
    const message = `Gagal menghapus instance : ${error}`;
    console.log(message);
    emitSocket(socket, sessionKey, 500, message);
  }
}

/**
 * Emit Webcosket
 */
function emitSocket(socket, room, status, message) {
  return socket.emit("message", {
    room: room,
    message: {
      status,
      data: message,
    },
  });
}

module.exports = {
  addDevice,
  sendMessage,
  closeSession,
  endSession,
};

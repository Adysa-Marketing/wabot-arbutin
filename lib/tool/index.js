const venom = require("venom-bot");
const fs = require("fs-extra");
const path = require("path");
const { WaBot } = require("../../models");
const moment = require("moment");

/**Add Devices */
let dataSession = [];
async function addDevice(sessionKey, socket) {
  try {
    const session = await WaBot.findOne({
      where: {
        key: sessionKey,
      },
    });
    const exist = dataSession.find(
      (session) => session.sessionKey == sessionKey
    );

    if (session && session.status == 1 && exist) {
      emitSocket(socket, sessionKey, 409, "Session anda masih aktif");
    } else {
      venom
        .create({
          session: sessionKey,
          catchQR: (base64Qrimg) => {
            // send qrcode
            emitSocket(socket, sessionKey, 201, base64Qrimg);
          },
          statusFind: (statusSession, session) => {
            console.log("status session : ", statusSession);
            console.log("Session name: ", session);
          },
          headless: true,
          puppeteerOptions: {
            executablePath: "/usr/bin/google-chrome",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          },
          // browser: browser,
        })
        .then(async (client) => {
          exist
            ? (exist.client = client)
            : dataSession.push({ client, sessionKey });

          await session.update({ status: 1 });

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
          session && (await session.update({ status: 0 }));
          console.log("error : ", error);
          emitSocket(socket, sessionKey, 500, error);
        });
    }
  } catch (error) {
    console.log("error : ", error.message);
    if (error == "Not Logged") {
      session &&
        (await WaBot.update({ status: 0 }, { where: { key: sessionKey } }));
    }
    emitSocket(socket, sessionKey, 500, error.message);
  }
}

/**
 * start manage message
 */
async function start(client, socket, sessionKey) {
  try {
    if (socket) emitSocket(socket, sessionKey, 200, "Login Success");
    console.log("start session ");

    await client.onMessage(async (message) => {
      console.log("[!] Pesan masuk : ", message.body);
      let { body, from, to } = message;

      // type chat
      if (message.isGroupMsg === false) {
        if (message.type == "chat") {
          if (body == "/status") {
            const chat = `Status: Aktif
Last Check : ${moment().utc().add(7, "hours").format("YYYY-MM-DD HH:mm:ss")}`;
            client
              .sendText(message.from, chat)
              .then((result) => {
                console.log("Message Send");
              })
              .catch((erro) => {
                console.error("Error when sending: ", erro); //return object error
              });
          }
        }
      }
    });
  } catch (error) {
    console.log("error : ", error);
    if (socket) emitSocket(socket, sessionKey, 500, error);
  }
}

/**
 * Close session
 * Close the session properly to ensure the session is saved for the next time you log in
 * */
async function closeSession(sessionKey, socket) {
  // cari data session
  const exist = dataSession.find((session) => session.sessionKey == sessionKey);
  const sessionPath = path.resolve(__dirname, `../../tokens/${sessionKey}`);
  try {
    const session = await WaBot.findOne({
      where: {
        key: sessionKey,
      },
    });
    if (session && exist) {
      let isConnected = await exist.client.isConnected();
      if (isConnected) {
        await exist.client.close();
        // update status
        console.log(`Close Session : ${sessionKey}`);
        dataSession = dataSession.filter(
          (session) => session.sessionKey !== sessionKey
        );
        await session.update({ status: 0 });
        emitSocket(socket, sessionKey, 200, "Sukses menutup session");
      }
      return;
    } else {
      console.log(`[!] Session tidak ditemukan`);
      await session.update({ status: 0 });
      emitSocket(socket, sessionKey, 404, "Session tidak ditemukan");
      return;
    }
  } catch (error) {
    if (error?.message.includes("WAPI is not defined")) {
      console.log("error : ", error);
      dataSession = dataSession.filter(
        (session) => session.sessionKey !== sessionKey
      );

      WaBot.update({ status: 0 }, { where: { key: sessionKey } })
        .then(() => {
          console.log("status instrance updated");
          fs.emptyDirSync(sessionPath);
          console.log(`Direktori ${sessionPath} berhasil di-empty.`);
          fs.removeSync(sessionPath);
          console.log(`Direktori ${sessionPath} berhasil dihapus.`);
          emitSocket(socket, sessionKey, 200, "Sukses menutup session");
        })
        .catch((err) => console.log("error update instance : ", err));
    } else {
      console.log("error : ", error.message);
      emitSocket(socket, sessionKey, 500, error.message);
    }
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
    if (exist) {
      let isConnected = await exist.client.isConnected();
      if (isConnected) {
        await exist.client.close();
        dataSession = dataSession.filter(
          (session) => session.sessionKey !== sessionKey
        );
        await fs.emptyDir(sessionPath);
        console.log(`Direktori ${sessionPath} berhasil di-empty.`);
        await fs.remove(sessionPath);
        console.log(`Direktori ${sessionPath} berhasil dihapus.`);
        emitSocket(socket, sessionKey, 200, `Sukses menghapus instance`);
      }
    } else {
      await fs.emptyDir(sessionPath);
      console.log(`Direktori ${sessionPath} berhasil di-empty.`);
      await fs.remove(sessionPath);
      console.log(`Direktori ${sessionPath} berhasil dihapus.`);
      emitSocket(socket, sessionKey, 200, `Sukses menghapus instance`);
    }
    return;
  } catch (error) {
    if (error?.message.includes("WAPI is not defined")) {
      console.log("error : ", error.message);
      dataSession = dataSession.filter(
        (session) => session.sessionKey !== sessionKey
      );
      fs.emptyDirSync(sessionPath);
      console.log(`Direktori ${sessionPath} berhasil di-empty.`);
      fs.removeSync(sessionPath);
      console.log(`Direktori ${sessionPath} berhasil dihapus.`);
      emitSocket(socket, sessionKey, 200, `Sukses menghapus instance`);
    } else {
      const message = `Gagal menghapus instance : ${error}`;
      console.log(message);
      emitSocket(socket, sessionKey, 500, message);
    }
  }
}

/**
 * Reconnect when restart
 */
async function reConnect(sessionKey) {
  console.log("Reconnect to :", sessionKey);
  try {
    const exist = dataSession.find(
      (session) => session.sessionKey == sessionKey
    );
    const session = await WaBot.findOne({ where: { key: sessionKey } });
    if (session && session.status == 1 && exist) {
      console.log("Session masih aktif");
      return "Session masih aktif";
    } else {
      venom
        .create({
          session: sessionKey,
          statusFind: (statusSession, session) => {
            console.log("status session : ", statusSession);
            console.log("Session name: ", session);
          },
          headless: true,
          puppeteerOptions: {
            executablePath: "/usr/bin/google-chrome",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          },
        })
        .then(async (client) => {
          exist
            ? (exist.client = client)
            : dataSession.push({ client, sessionKey });

          await session.update({ status: 1 });

          // Listen to state changes
          client.onStateChange((state) => {
            console.log("state : ", state);
            if (state === "CONFLICT" || state === "UNLAUNCHED") {
              console.log("state : ", state);
              return;
            }
            if (state === "CONNECTED") {
              console.log("Success Continue Session");
            }
          });

          start(client, null, sessionKey);
        })
        .catch(async (error) => {
          session &&
            (await ClientInstance.findOneAndUpdate(
              { _id: sessionKey },
              { status: 0 }
            ));
          console.log("error : ", error);
        });
    }
  } catch (error) {
    console.log("error : ", error.message);
    session &&
      (await ClientInstance.findOneAndUpdate(
        { _id: sessionKey },
        { status: 0 }
      ));
  }
}

/**
 * Handle SendChat
 */
async function sendChat(device, recipient, data, sessionKey) {
  let client = device;
  try {
    if (!device) {
      const session = dataSession.find(
        (session) => session.sessionKey == sessionKey
      );
      if (!session) {
        throw new Error("Session tidak ditemukan");
      }
      client = session.client;
    }

    if (data.image) {
      const filename = `image.${
        data.image.replace("data:image/", "").split(";base64")[0]
      }`;
      await client.sendImageFromBase64(
        recipient,
        data.image,
        filename,
        data.message
      );
    } else {
      await client.sendText(recipient, data.message);
    }
    console.log(`Send Message from : [${sessionKey}] to : [${recipient}]`);
    return "Send Message";
  } catch (error) {
    console.error(
      `Error when sending from : [${sessionKey}] to : [${recipient}] `,
      error.message || error.text
    );
    return error.message || error.text;
  }
}

/**
 * Close session Via API
 * Close the session properly to ensure the session is saved for the next time you log in
 * */
async function handleClose(sessionKey) {
  // cari data session
  const session = await WaBot.findOne({ key: sessionKey });
  const exist = dataSession.find((session) => session.sessionKey == sessionKey);
  const sessionPath = path.resolve(__dirname, `../../tokens/${sessionKey}`);
  try {
    if (session && exist) {
      let isConnected = await exist.client.isConnected();
      if (isConnected) {
        await exist.client.close();
        // update status
        console.log(`Close Session ${sessionKey}`);
        dataSession = dataSession.filter(
          (session) => session.sessionKey !== sessionKey
        );
        await session.update({ status: 0 });
      }
      return "Close Session Successfull";
    } else {
      console.log("[!] session tidak ditemukan");
      return "Session tidak ditemukan";
    }
  } catch (error) {
    if (error?.message.includes("WAPI is not defined")) {
      console.log("error : ", error.message);
      dataSession = dataSession.filter(
        (session) => session.sessionKey !== sessionKey
      );

      WaBot.update({ status: 0 }, { where: { key: sessionKey } })
        .then(() => {
          console.log("status instrance updated");
          fs.emptyDirSync(sessionPath);
          console.log(`Direktori ${sessionPath} berhasil di-empty.`);
          fs.removeSync(sessionPath);
          console.log(`Direktori ${sessionPath} berhasil dihapus.`);
        })
        .catch((err) => console.log("error update instance : ", err));
    } else {
      console.log("error : ", error.message);
      return error.message;
    }
  }
}

/**
 * handle remove session
 * Close and delete session and you need to scan qr code again when you log in
 */
async function handleRemoveInstance(sessionKey) {
  // cari data session
  const exist = dataSession.find((session) => session.sessionKey == sessionKey);
  const sessionPath = path.resolve(__dirname, `../../tokens/${sessionKey}`);
  try {
    let isConnected = await exist.client.isConnected();
    if (isConnected) {
      await exist.client.close();
      dataSession = dataSession.filter(
        (session) => session.sessionKey !== sessionKey
      );
      await fs.emptyDir(sessionPath);
      console.log(`Direktori ${sessionPath} berhasil di-empty.`);
      await fs.remove(sessionPath);
      console.log(`Direktori ${sessionPath} berhasil dihapus.`);
      return "Remove Session Instance Successfull";
    }
  } catch (error) {
    if (error?.message.includes("WAPI is not defined")) {
      console.log("error : ", error.message);
      dataSession = dataSession.filter(
        (session) => session.sessionKey !== sessionKey
      );
      fs.emptyDirSync(sessionPath);
      console.log(`Direktori ${sessionPath} berhasil di-empty.`);
      fs.removeSync(sessionPath);
      console.log(`Direktori ${sessionPath} berhasil dihapus.`);
      return "Remove Session Instance Successfull";
    } else {
      const message = `Gagal menghapus instance : ${error}`;
      console.log(message);
      return message;
    }
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
  closeSession,
  endSession,
  reConnect,
  sendChat,
  handleClose,
  handleRemoveInstance,
};

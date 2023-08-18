const express = require("express");
const app = express();
const {
  sendChat,
  handleClose,
  reConnect,
  handleRemoveInstance,
} = require("../lib/tool");

app.post("/api/send-chat", async (req, res, next) => {
  let sessionKey = req.headers.token;
  let source = req.body;
  if (!source.to || !source.message) {
    return res.json({ status: 500, message: "Missing payload data" });
  } else {
    const to = source.to.replace(new RegExp("^08"), "628") + "@c.us";
    const payload = {
      message: source.message,
      image: source.image ? source.image : null,
    };
    const result = await sendChat(null, to, payload, sessionKey);
    if (result !== "Send Message") {
      return res.json({
        status: 500,
        message: result,
      });
    }

    return res.json({
      status: 200,
      data: {
        msg: {
          to: to.replace("@c.us", ""),
          body: {
            text: source.message,
          },
        },
      },
    });
  }
});

app.post("/api/close-instance", async (req, res, next) => {
  try {
    const { sessionName, status } = req.body;
    if (!sessionName || !status)
      return res.json({ status: 400, message: "Missing payload data" });

    if (status == 2) {
      const result = await handleClose(sessionName);
      if (result !== "Close Session Successfull") {
        return res.json({ status: 500, message: result });
      }

      return res.json({
        status: 200,
        message: result,
      });
    } else {
      res.json({ status: 500, message: "Payload status must be 2" });
    }
  } catch (error) {
    res.json({ status: 500, message: error.message });
  }
});

app.post("/api/reconnect-instance", async (req, res, next) => {
  const { sessionName } = req.body;
  if (!sessionName)
    return res.json({ status: 400, message: "Missing payload data" });

  reConnect(sessionName);
  return res.json({
    status: 200,
    message: "Connecting in progress",
  });
});

app.post("/api/remove-instance", async (req, res, next) => {
  const { sessionName } = req.body;
  try {
    if (!sessionName)
      return res.json({ status: 400, message: "Missing payload data" });

    const removeInstance = await handleRemoveInstance(sessionName);
    return res.json({ status: 200, message: removeInstance });
  } catch (error) {
    return res.json({ status: 500, message: error });
  }
});

module.exports = app;

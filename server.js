const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static("public"));

const users = new Map();
const MESSAGE_RATE_LIMIT = 5;
const messageCounts = new Map();

io.on("connection", socket => {
  const username = `User-${socket.id.slice(0, 4)}`;
  socket.username = username;

  users.set(socket.id, { id: socket.id, username });

  socket.emit("your-info", {
    id: socket.id,
    username
  });

  socket.emit("all-users",
    [...users.values()].filter(u => u.id !== socket.id)
  );

  socket.broadcast.emit("user-joined", {
    id: socket.id,
    username
  });

  socket.on("set-username", name => {
    const clean = name.trim().slice(0, 20);
    if (clean) {
      socket.username = clean;
      users.set(socket.id, { id: socket.id, username: clean });
      io.emit("user-renamed", { id: socket.id, username: clean });
    }
  });

  socket.on("offer", payload => {
    io.to(payload.target).emit("offer", payload);
  });

  socket.on("answer", payload => {
    io.to(payload.target).emit("answer", payload);
  });

  socket.on("ice-candidate", incoming => {
    io.to(incoming.target).emit("ice-candidate", incoming.candidate);
  });

  socket.on("chat-message", data => {
    const now = Date.now();
    const recent = messageCounts.get(socket.id) || [];
    const clean = recent.filter(t => now - t < 5000);
    if (clean.length >= MESSAGE_RATE_LIMIT) return;
    clean.push(now);
    messageCounts.set(socket.id, clean);

    const msg = (data.message || "").trim().slice(0, 500);
    if (!msg) return;

    io.emit("chat-message", {
      sender: socket.username,
      senderId: socket.id,
      message: msg,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  socket.on("call-ended", target => {
    if (target) io.to(target).emit("call-ended", socket.id);
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    messageCounts.delete(socket.id);
    io.emit("user-left", { id: socket.id, username: socket.username });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Running on http://localhost:${PORT}`);
});

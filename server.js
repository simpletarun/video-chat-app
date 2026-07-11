const express = require("express");
const helmet = require("helmet");

const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e6
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'", "wss:", "ws:"]
      }
    }
  })
);
app.disable("x-powered-by");
app.use(express.static("public"));

// userId -> { id, username, room }
const users = new Map();
// room -> Set of socket ids
const rooms = new Map();

const MESSAGE_RATE_LIMIT = 5;
const RATE_WINDOW_MS = 5000;
const messageCounts = new Map();

function sanitize(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function roomUserList(room) {
  const ids = rooms.get(room);
  if (!ids) return [];
  const list = [];
  ids.forEach(id => {
    const u = users.get(id);
    if (u) list.push({ id: u.id, username: u.username });
  });
  return list;
}

function leaveCurrentRoom(socket) {
  const u = users.get(socket.id);
  const room = u && u.room;
  if (!room) return;
  const ids = rooms.get(room);
  if (ids) {
    ids.delete(socket.id);
    if (ids.size === 0) rooms.delete(room);
  }
  socket.leave(room);
  socket.to(room).emit("user-left", { id: socket.id, username: u.username });
}

io.on("connection", socket => {
  const username = `User-${socket.id.slice(0, 4)}`;
  users.set(socket.id, { id: socket.id, username, room: null });
  socket.emit("your-info", { id: socket.id, username });

  socket.on("join-room", payload => {
    const data = payload && typeof payload === "object" ? payload : {};
    const roomName = sanitize(data.room, 40) || "lobby";
    const u = users.get(socket.id);
    if (!u) return;

    if (u.room === roomName) {
      socket.emit("room-joined", { room: roomName, users: roomUserList(roomName) });
      return;
    }

    leaveCurrentRoom(socket);
    u.room = roomName;

    const name = sanitize(data.username, 20);
    if (name) {
      u.username = name;
      socket.emit("your-info", { id: socket.id, username: name });
    }

    socket.join(roomName);
    if (!rooms.has(roomName)) rooms.set(roomName, new Set());
    rooms.get(roomName).add(socket.id);

    socket.emit("room-joined", { room: roomName, users: roomUserList(roomName) });
    socket.to(roomName).emit("user-joined", { id: socket.id, username: u.username });
  });

  socket.on("set-username", name => {
    const u = users.get(socket.id);
    if (!u) return;
    const clean = sanitize(name, 20);
    if (!clean) return;
    u.username = clean;
    socket.emit("your-info", { id: socket.id, username: clean });
    if (u.room) {
      io.to(u.room).emit("user-renamed", { id: socket.id, username: clean });
    }
  });

  function deliver(event, payload) {
    if (!payload || !payload.target || !users.has(payload.target)) return;
    io.to(payload.target).emit(event, payload);
  }

  socket.on("offer", payload => deliver("offer", payload));
  socket.on("answer", payload => deliver("answer", payload));
  socket.on("ice-candidate", payload => {
    if (!payload || !payload.target || !users.has(payload.target)) return;
    io.to(payload.target).emit("ice-candidate", payload.candidate);
  });

  socket.on("chat-message", data => {
    const u = users.get(socket.id);
    if (!u || !u.room) return;

    const now = Date.now();
    const recent = (messageCounts.get(socket.id) || []).filter(t => now - t < RATE_WINDOW_MS);
    if (recent.length >= MESSAGE_RATE_LIMIT) return;
    recent.push(now);
    messageCounts.set(socket.id, recent);

    const msg = sanitize(data && data.message, 500);
    if (!msg) return;

    io.to(u.room).emit("chat-message", {
      sender: u.username,
      senderId: socket.id,
      message: msg,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  socket.on("call-ended", target => {
    if (target && users.has(target)) io.to(target).emit("call-ended", socket.id);
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket);
    users.delete(socket.id);
    messageCounts.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Running on http://localhost:${PORT}`);
});

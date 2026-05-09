const express = require("express");
const app = express();

const server = require("http").createServer(app);

const io = require("socket.io")(server);

app.use(express.static("public"));

let users = [];

io.on("connection", socket => {

  console.log("Connected:", socket.id);

  users.push(socket.id);

  socket.emit("all-users",
    users.filter(id => id !== socket.id)
  );

  socket.broadcast.emit("user-joined", socket.id);

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
    io.emit("chat-message", {
      sender: socket.id.slice(0,5),
      message: data.message
    });
  });

  socket.on("disconnect", () => {
    users = users.filter(id => id !== socket.id);
    io.emit("user-left", socket.id);
  });

});

server.listen(3000, "0.0.0.0", () => {
  console.log("Running on http://localhost:3000");
});

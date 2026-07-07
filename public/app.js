const socket = io();

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const localLabel = document.getElementById("localLabel");
const remoteLabel = document.getElementById("remoteLabel");
const callBtn = document.getElementById("callBtn");
const endCallBtn = document.getElementById("endCallBtn");
const muteBtn = document.getElementById("muteBtn");
const videoBtn = document.getElementById("videoBtn");
const sendBtn = document.getElementById("sendBtn");
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const remoteStatus = document.getElementById("remoteStatus");
const userList = document.getElementById("userList");
const usernameInput = document.getElementById("usernameInput");
const setNameBtn = document.getElementById("setNameBtn");
const incomingCallModal = document.getElementById("incomingCallModal");
const callerName = document.getElementById("callerName");
const acceptCallBtn = document.getElementById("acceptCallBtn");
const rejectCallBtn = document.getElementById("rejectCallBtn");

let localStream;
let peer;
let targetUser;
let myId;
let myUsername = "";
let isMuted = false;
let isVideoOff = false;
let incomingCallData = null;

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

function setStatus(state) {
  statusIndicator.className = "status-dot " + state;
  if (state === "online") statusText.textContent = "Connected";
  else if (state === "connecting") statusText.textContent = "Connecting...";
  else statusText.textContent = "Disconnected";
}

function addMessage(sender, text, time) {
  const div = document.createElement("div");
  div.className = "message";

  const senderSpan = document.createElement("span");
  senderSpan.className = "msg-sender";
  senderSpan.textContent = sender;

  const timeSpan = document.createElement("span");
  timeSpan.className = "msg-time";
  timeSpan.textContent = time || "";

  const textSpan = document.createElement("span");
  textSpan.textContent = " " + text;

  div.appendChild(senderSpan);
  div.appendChild(timeSpan);
  div.appendChild(textSpan);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function addSystemMessage(text) {
  const div = document.createElement("div");
  div.className = "message";
  div.style.textAlign = "center";
  div.style.color = "#94a3b8";
  div.style.fontStyle = "italic";
  div.style.fontSize = "13px";
  div.style.background = "transparent";
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function updateUserList(users) {
  userList.innerHTML = "";
  users.forEach(u => {
    const li = document.createElement("li");
    li.textContent = u.username + (u.id === myId ? " (you)" : "");
    li.dataset.id = u.id;
    userList.appendChild(li);
  });
}

function resetCallUI() {
  if (peer) {
    peer.close();
    peer = null;
  }
  targetUser = null;
  callBtn.disabled = false;
  endCallBtn.disabled = true;
  muteBtn.disabled = true;
  videoBtn.disabled = true;
  remoteVideo.srcObject = null;
  remoteStatus.classList.add("hidden");
  remoteLabel.textContent = "Remote User";
  incomingCallModal.classList.add("hidden");
  incomingCallData = null;
  isMuted = false;
  isVideoOff = false;
  muteBtn.textContent = "🎤 Mute";
  videoBtn.textContent = "📹 Video Off";
}

async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    localVideo.srcObject = localStream;
    setStatus("online");
  } catch (err) {
    console.error("Media error:", err);
    setStatus("offline");
    addSystemMessage("Camera/microphone access denied. Please grant permissions.");
  }
}

function createPeer() {
  if (peer) {
    peer.close();
    peer = null;
  }

  peer = new RTCPeerConnection(servers);

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peer.addTrack(track, localStream);
    });
  }

  peer.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
    remoteStatus.classList.add("hidden");
  };

  peer.onicecandidate = event => {
    if (event.candidate && targetUser) {
      socket.emit("ice-candidate", {
        target: targetUser,
        candidate: event.candidate
      });
    }
  };

  peer.oniceconnectionstatechange = () => {
    if (peer.iceConnectionState === "disconnected" || peer.iceConnectionState === "failed") {
      remoteStatus.classList.remove("hidden");
      addSystemMessage("Call ended or connection lost.");
      resetCallUI();
    }
  };
}

socket.on("connect", () => setStatus("online"));

socket.on("disconnect", () => {
  setStatus("offline");
  addSystemMessage("Disconnected from server.");
  resetCallUI();
});

socket.on("your-info", info => {
  myId = info.id;
  myUsername = info.username;
  localLabel.textContent = `${info.username} (You)`;
});

socket.on("all-users", users => {
  updateUserList(users);
  if (users.length > 0 && !targetUser) {
    targetUser = users[0].id;
  }
});

socket.on("user-joined", user => {
  const li = document.createElement("li");
  li.textContent = user.username + (user.id === myId ? " (you)" : "");
  li.dataset.id = user.id;
  userList.appendChild(li);
  addSystemMessage(`${user.username} joined the room`);
  if (!targetUser) targetUser = user.id;
});

socket.on("user-left", user => {
  document.querySelectorAll("#userList li").forEach(li => {
    if (li.dataset.id === user.id) li.remove();
  });
  addSystemMessage(`${user.username} left the room`);
  if (targetUser === user.id) {
    remoteStatus.classList.remove("hidden");
    resetCallUI();
  }
});

socket.on("user-renamed", user => {
  const items = document.querySelectorAll("#userList li");
  items.forEach(li => {
    if (li.dataset.id === user.id) {
      li.textContent = user.username + (user.id === myId ? " (you)" : "");
    }
  });
  if (user.id === myId) {
    myUsername = user.username;
    localLabel.textContent = `${user.username} (You)`;
  }
});

callBtn.onclick = async () => {
  if (!targetUser) {
    alert("No user online");
    return;
  }
  if (!localStream) {
    alert("Camera not available. Check permissions.");
    return;
  }

  callBtn.disabled = true;
  createPeer();

  try {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("offer", {
      target: targetUser,
      caller: myId,
      callerName: myUsername,
      sdp: offer
    });
    endCallBtn.disabled = false;
    muteBtn.disabled = false;
    videoBtn.disabled = false;
    addSystemMessage("Calling...");
  } catch (err) {
    console.error("Offer error:", err);
    callBtn.disabled = false;
  }
};

socket.on("offer", async incoming => {
  if (incomingCallData) return;

  incomingCallData = incoming;
  const name = incoming.callerName || `User-${incoming.caller.slice(0, 4)}`;
  callerName.textContent = `${name} is calling...`;
  incomingCallModal.classList.remove("hidden");
});

acceptCallBtn.onclick = async () => {
  if (!incomingCallData) return;
  incomingCallModal.classList.add("hidden");
  const incoming = incomingCallData;

  targetUser = incoming.caller;
  callBtn.disabled = true;
  createPeer();

  try {
    await peer.setRemoteDescription(new RTCSessionDescription(incoming.sdp));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", {
      target: incoming.caller,
      sdp: answer
    });
    endCallBtn.disabled = false;
    muteBtn.disabled = false;
    videoBtn.disabled = false;
    addSystemMessage("Call connected.");
  } catch (err) {
    console.error("Answer error:", err);
    callBtn.disabled = false;
    resetCallUI();
  }
  incomingCallData = null;
};

rejectCallBtn.onclick = () => {
  if (incomingCallData) {
    socket.emit("call-ended", incomingCallData.caller);
  }
  incomingCallModal.classList.add("hidden");
  incomingCallData = null;
};

socket.on("answer", async incoming => {
  try {
    await peer.setRemoteDescription(new RTCSessionDescription(incoming.sdp));
    addSystemMessage("Call connected.");
  } catch (err) {
    console.error("Answer set error:", err);
  }
});

socket.on("ice-candidate", async candidate => {
  try {
    if (peer) await peer.addIceCandidate(candidate);
  } catch (e) {
    console.error("ICE error:", e);
  }
});

endCallBtn.onclick = () => {
  if (targetUser) socket.emit("call-ended", targetUser);
  addSystemMessage("You ended the call.");
  resetCallUI();
};

socket.on("call-ended", () => {
  addSystemMessage("Remote user ended the call.");
  resetCallUI();
});

muteBtn.onclick = () => {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
  muteBtn.textContent = isMuted ? "🎤 Unmute" : "🎤 Mute";
};

videoBtn.onclick = () => {
  if (!localStream) return;
  isVideoOff = !isVideoOff;
  localStream.getVideoTracks().forEach(t => t.enabled = !isVideoOff);
  videoBtn.textContent = isVideoOff ? "📹 Video On" : "📹 Video Off";
};

sendBtn.onclick = () => {
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit("chat-message", { message: text });
  messageInput.value = "";
};

messageInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendBtn.onclick();
});

socket.on("chat-message", data => {
  addMessage(data.sender, data.message, data.timestamp);
});

setNameBtn.onclick = () => {
  const name = usernameInput.value.trim();
  if (name) {
    socket.emit("set-username", name);
    usernameInput.value = "";
  }
};

usernameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") setNameBtn.onclick();
});

initMedia();

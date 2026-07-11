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
const roomInput = document.getElementById("roomInput");
const nameInput = document.getElementById("nameInput");
const joinBtn = document.getElementById("joinBtn");
const roomIndicator = document.getElementById("roomIndicator");
const roomCount = document.getElementById("roomCount");
const incomingCallModal = document.getElementById("incomingCallModal");
const callerName = document.getElementById("callerName");
const acceptCallBtn = document.getElementById("acceptCallBtn");
const rejectCallBtn = document.getElementById("rejectCallBtn");

let localStream;
let peer;
let targetUser;
let myId;
let myUsername = "";
let myRoom = null;
let isMuted = false;
let isVideoOff = false;
let incomingCallData = null;
let pendingCandidates = [];
const knownUsers = new Map();

const servers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
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
  div.className = "message system";
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function renderUserList() {
  userList.innerHTML = "";
  roomCount.textContent = String(knownUsers.size);
  knownUsers.forEach((username, id) => {
    const li = document.createElement("li");
    li.className = "user-item";
    if (id === myId) li.classList.add("self");
    if (id === targetUser) li.classList.add("selected");
    li.textContent = username + (id === myId ? " (you)" : "");
    li.dataset.id = id;
    if (id !== myId) {
      li.addEventListener("click", () => selectUser(id));
    }
    userList.appendChild(li);
  });
}

function selectUser(id) {
  if (id === myId) return;
  targetUser = id;
  renderUserList();
  addSystemMessage(`Selected ${knownUsers.get(id) || "user"} as call target.`);
}

function resetCallUI() {
  if (peer) {
    try { peer.close(); } catch (e) {}
    peer = null;
  }
  pendingCandidates = [];
  targetUser = null;
  callBtn.disabled = false;
  endCallBtn.disabled = true;
  muteBtn.disabled = true;
  videoBtn.disabled = true;
  remoteVideo.srcObject = null;
  remoteStatus.classList.remove("hidden");
  remoteStatus.textContent = "No one connected";
  remoteLabel.textContent = "Remote User";
  incomingCallModal.classList.add("hidden");
  incomingCallData = null;
  isMuted = false;
  isVideoOff = false;
  muteBtn.textContent = "🎤 Mute";
  videoBtn.textContent = "📹 Video Off";
  renderUserList();
}

async function initMedia() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error("Media error:", err);
    addSystemMessage("Camera/microphone access denied. You can still receive calls.");
  }
}

function createPeer() {
  if (peer) {
    try { peer.close(); } catch (e) {}
    peer = null;
  }
  pendingCandidates = [];

  peer = new RTCPeerConnection(servers);

  if (localStream) {
    localStream.getTracks().forEach(track => {
      peer.addTrack(track, localStream);
    });
  }

  peer.ontrack = event => {
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
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
    if (!peer) return;
    if (peer.iceConnectionState === "failed" || peer.iceConnectionState === "closed") {
      addSystemMessage("Call ended or connection lost.");
      resetCallUI();
    } else if (peer.iceConnectionState === "disconnected") {
      remoteStatus.classList.remove("hidden");
      remoteStatus.textContent = "Reconnecting...";
    } else if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
      remoteStatus.classList.add("hidden");
    }
  };
}

function addCandidate(candidate) {
  if (peer && peer.remoteDescription && peer.remoteDescription.type) {
    peer.addIceCandidate(candidate).catch(e => console.error("addIceCandidate:", e));
  } else {
    pendingCandidates.push(candidate);
  }
}

function flushCandidates() {
  if (!peer) return;
  pendingCandidates.forEach(c => {
    peer.addIceCandidate(c).catch(e => console.error("flushIce:", e));
  });
  pendingCandidates = [];
}

socket.on("connect", () => {
  setStatus("online");
  joinRoom(roomInput.value.trim() || "lobby", nameInput.value.trim());
});

socket.on("disconnect", () => {
  setStatus("offline");
  addSystemMessage("Disconnected from server.");
  knownUsers.clear();
  renderUserList();
  resetCallUI();
});

socket.on("your-info", info => {
  myId = info.id;
  myUsername = info.username;
  localLabel.textContent = `${info.username} (You)`;
});

socket.on("room-joined", data => {
  myRoom = data.room;
  roomIndicator.textContent = "Room: " + data.room;
  roomIndicator.classList.remove("hidden");
  knownUsers.clear();
  (data.users || []).forEach(u => knownUsers.set(u.id, u.username));
  renderUserList();
  addSystemMessage(`Joined room "${data.room}".`);
  const others = [...knownUsers.keys()].filter(id => id !== myId);
  if (others.length > 0 && !targetUser) selectUser(others[0]);
});

socket.on("user-joined", user => {
  knownUsers.set(user.id, user.username);
  renderUserList();
  addSystemMessage(`${user.username} joined the room`);
  if (!targetUser) selectUser(user.id);
});

socket.on("user-left", user => {
  knownUsers.delete(user.id);
  if (targetUser === user.id) {
    addSystemMessage(`${user.username} left the room`);
    resetCallUI();
  } else {
    addSystemMessage(`${user.username} left the room`);
  }
  renderUserList();
});

socket.on("user-renamed", user => {
  knownUsers.set(user.id, user.username);
  if (user.id === myId) {
    myUsername = user.username;
    localLabel.textContent = `${user.username} (You)`;
  }
  renderUserList();
});

callBtn.onclick = async () => {
  if (!targetUser) {
    alert("Select a user to call from the online list.");
    return;
  }
  if (!localStream) {
    alert("Camera not available. Check permissions.");
    return;
  }

  callBtn.disabled = true;
  createPeer();
  remoteLabel.textContent = knownUsers.get(targetUser) || "Remote User";

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
  incomingCallData = null;

  targetUser = incoming.caller;
  remoteLabel.textContent = incoming.callerName || knownUsers.get(incoming.caller) || "Remote User";
  callBtn.disabled = true;
  createPeer();

  try {
    await peer.setRemoteDescription(new RTCSessionDescription(incoming.sdp));
    flushCandidates();
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
    flushCandidates();
    addSystemMessage("Call connected.");
  } catch (err) {
    console.error("Answer set error:", err);
  }
});

socket.on("ice-candidate", async candidate => {
  if (candidate) addCandidate(candidate);
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
  localStream.getAudioTracks().forEach(t => (t.enabled = !isMuted));
  muteBtn.textContent = isMuted ? "🎤 Unmute" : "🎤 Mute";
};

videoBtn.onclick = () => {
  if (!localStream) return;
  isVideoOff = !isVideoOff;
  localStream.getVideoTracks().forEach(t => (t.enabled = !isVideoOff));
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

function joinRoom(room, name) {
  socket.emit("join-room", { room, username: name });
}

joinBtn.onclick = () => {
  const room = roomInput.value.trim() || "lobby";
  const name = nameInput.value.trim();
  joinRoom(room, name);
};

nameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") joinBtn.onclick();
});
roomInput.addEventListener("keydown", e => {
  if (e.key === "Enter") joinBtn.onclick();
});

initMedia();

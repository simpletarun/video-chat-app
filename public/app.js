const socket = io();

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const callBtn = document.getElementById("callBtn");

const sendBtn = document.getElementById("sendBtn");

const messageInput = document.getElementById("messageInput");

const messages = document.getElementById("messages");

let localStream;
let peer;
let targetUser;

const servers = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};

async function initMedia() {

  localStream =
    await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

  localVideo.srcObject = localStream;
}

initMedia();

socket.on("all-users", users => {
  if (users.length > 0) {
    targetUser = users[0];
  }
});

socket.on("user-joined", userId => {
  targetUser = userId;
});

function createPeer() {

  peer = new RTCPeerConnection(servers);

  localStream.getTracks().forEach(track => {
    peer.addTrack(track, localStream);
  });

  peer.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  peer.onicecandidate = event => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        target: targetUser,
        candidate: event.candidate
      });
    }
  };
}

callBtn.onclick = async () => {

  if (!targetUser) {
    alert("No user online");
    return;
  }

  createPeer();

  const offer = await peer.createOffer();

  await peer.setLocalDescription(offer);

  socket.emit("offer", {
    target: targetUser,
    caller: socket.id,
    sdp: offer
  });
};

socket.on("offer", async incoming => {

  targetUser = incoming.caller;

  createPeer();

  await peer.setRemoteDescription(
    new RTCSessionDescription(incoming.sdp)
  );

  const answer = await peer.createAnswer();

  await peer.setLocalDescription(answer);

  socket.emit("answer", {
    target: incoming.caller,
    sdp: answer
  });
});

socket.on("answer", async incoming => {

  await peer.setRemoteDescription(
    new RTCSessionDescription(incoming.sdp)
  );
});

socket.on("ice-candidate", async candidate => {

  try {
    await peer.addIceCandidate(candidate);
  } catch (e) {
    console.error(e);
  }
});

sendBtn.onclick = () => {

  const message = messageInput.value;

  if (!message) return;

  socket.emit("chat-message", {
    message
  });

  messageInput.value = "";
};

socket.on("chat-message", data => {

  const div = document.createElement("div");

  div.classList.add("message");

  div.innerHTML =
    `<b>${data.sender}</b>: ${data.message}`;

  messages.appendChild(div);

  messages.scrollTop = messages.scrollHeight;
});

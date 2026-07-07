# Video Chat App

A peer-to-peer video calling and chat application powered by WebRTC and Socket.IO.

## Features

- **1-on-1 video calls** — WebRTC peer-to-peer with STUN/TURN fallback
- **Real-time chat** — with timestamps and custom display names
- **Call controls** — mute audio, disable video, end call
- **Incoming call notification** — accept or decline
- **Online user list** — see who's connected
- **Connection status** — live indicator of server connectivity
- **Responsive dark theme** UI

## Try It

[https://video-chat-app-2-mru3.onrender.com/](https://video-chat-app-2-mru3.onrender.com/)

Open in two browser tabs/windows to test.

## Run Locally

```bash
git clone https://github.com/simpletarun/video-chat-app.git
cd video-chat-app
npm install
npm start
```

Open `http://localhost:3000` in two browser tabs.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js, Express, Socket.IO |
| Real-time signaling | Socket.IO (WebSocket) |
| Media | WebRTC (browser native `RTCPeerConnection`) |
| STUN | `stun.l.google.com:19302` |
| TURN | `openrelay.metered.ca` (free relay) |
| Frontend | Vanilla HTML, CSS, JavaScript |

## How It Works

1. Both users open the app and get assigned a socket connection
2. When one user clicks **Start Call**, an **offer** (SDP) is sent via Socket.IO to the other user
3. The other user receives the offer, creates an **answer**, and sends it back
4. ICE candidates are exchanged to find the best network path (STUN/TURN)
5. Once connected, media flows peer-to-peer via WebRTC
6. Chat messages are relayed through the Socket.IO server

## Project Structure

```
video-chat-app/
├── package.json          # Dependencies and start script
├── server.js             # Express + Socket.IO signaling server
├── public/
│   ├── index.html        # Main page layout
│   ├── style.css         # Dark theme styling
│   └── app.js            # WebRTC + Socket.IO client logic
└── .gitignore
```

## Deployment

The app is ready for deployment on Render, Heroku, or any Node.js host:

```bash
npm start
```

The server listens on `process.env.PORT` (default 3000).

## License

ISC

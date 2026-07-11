# Video Chat App

A peer-to-peer video calling and chat application powered by WebRTC and Socket.IO, with **rooms** so multiple people can connect without interfering with each other.

## Features

- **Rooms** — join a named room; see and call only people in your room
- **1-on-1 video calls** — WebRTC peer-to-peer with STUN/TURN fallback
- **Click-to-call** — pick any online user as your call target
- **Real-time chat** — with timestamps and custom display names (per room)
- **Call controls** — mute audio, disable video, end call
- **Incoming call modal** — accept or decline
- **Online user list** — live, with a selected-call-target highlight
- **Connection status** — live indicator of server connectivity
- **Responsive dark theme** UI

## Try It

Open the deployed app URL in two browser tabs/windows, join the same room name, and click a user to call them.

## Run Locally

```bash
git clone https://github.com/simpletarun/video-chat-app.git
cd video-chat-app
npm install
npm start
```

Open `http://localhost:3000` in two browser tabs, join the **same room**, and click a user to start a call.

## How to test a call properly (important)

Camera/mic problems are almost always a **test setup** issue, not a code bug:

1. **Use two DIFFERENT browsers** (e.g. Chrome + Firefox/Edge) on the same machine, or two devices on the same network. Opening two tabs in the **same** browser shares one camera — the second tab's `getUserMedia` will fail because the device is already in use by the first tab.
2. **Grant camera + microphone permission** when the browser prompts. If you denied it once, click the camera icon in the address bar to reset it, then click **Join Room** again (the app re-requests media on Join).
3. **`localhost` counts as a secure context**, so the camera works over plain `http://localhost`. If you host it anywhere else, it **must be HTTPS** or `getUserMedia` is blocked by the browser.
4. **Join the same room name** in both clients, then click the other user in the online list and press **Start Call**.
5. The local preview appears immediately after permission is granted. The remote video appears once the peer connection is established (watch the status text).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js, Express, Socket.IO, Helmet |
| Real-time signaling | Socket.IO (WebSocket) |
| Media | WebRTC (browser native `RTCPeerConnection`) |
| STUN | `stun.l.google.com:19302` |
| TURN | `openrelay.metered.ca` (free relay) |
| Frontend | Vanilla HTML, CSS, JavaScript |

## How It Works

1. A user opens the app, picks a room + display name, and joins
2. The server tracks users **per room** and broadcasts the room's user list
3. Clicking a user selects them as the call target; **Start Call** sends an **offer** (SDP) to just that user
4. The target receives the offer, creates an **answer**, and sends it back
5. ICE candidates are exchanged (queued until the remote description is set) to find the best network path (STUN/TURN)
6. Once connected, media flows peer-to-peer via WebRTC; chat is relayed through the server to the room only

## Project Structure

```
video-chat-app/
├── package.json          # Dependencies and scripts
├── server.js             # Express + Socket.IO signaling server (rooms, security)
├── public/
│   ├── index.html        # Main page layout
│   ├── style.css         # Dark theme styling
│   └── app.js            # WebRTC + Socket.IO client logic
├── .gitignore
└── LICENSE               # MIT
```

## Security

- `helmet` adds secure HTTP headers (CSP, etc.)
- Socket.IO `maxHttpBufferSize` caps message size
- Relay targets are validated against connected users
- Chat messages are length-limited and rate-limited per socket
- Chat is scoped per room

> The bundled TURN credentials are a shared free relay and may be rate-limited. For production, host your own `coturn` server with ephemeral credentials via environment variables.

## Deployment

Ready for Render, Heroku, or any Node.js host:

```bash
npm install
npm start
```

The server listens on `process.env.PORT` (default 3000).

## License

MIT

import { useEffect, useRef, useState } from "react";
import { Video, Phone, PhoneOff, Copy } from "lucide-react";

const BACKEND_URL = "https://houseofazaan.ca";

export default function App() {
  const [mode, setMode] = useState("menu"); // menu | call
  const [room, setRoom] = useState("");
  const [name, setName] = useState("");
  const [connected, setConnected] = useState(false);

  const pc = useRef(null);
  const localVideo = useRef();
  const remoteVideo = useRef();
  const lastId = useRef(0);

  useEffect(() => {
    if (connected) {
      const poll = setInterval(fetchSignals, 2000);
      return () => clearInterval(poll);
    }
  }, [connected]);

  const fetchSignals = async () => {
    const res = await fetch(`${BACKEND_URL}/get_signals.php?room=${room}&since=${lastId.current}`);
    const signals = await res.json();
    for (const s of signals) {
      lastId.current = s.id;
      if (s.sender === name) continue;
      if (s.type === "offer") {
        await pc.current.setRemoteDescription(new RTCSessionDescription(s.data));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        sendSignal("answer", answer);
      } else if (s.type === "answer") {
        await pc.current.setRemoteDescription(new RTCSessionDescription(s.data));
      } else if (s.type === "candidate") {
        try {
          await pc.current.addIceCandidate(new RTCIceCandidate(s.data));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      }
    }
  };

  const sendSignal = async (type, data) => {
    await fetch(`${BACKEND_URL}/send_signal.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, sender: name, type, data })
    });
  };

  const startCall = async () => {
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pc.current.onicecandidate = (e) => {
      if (e.candidate) sendSignal("candidate", e.candidate);
    };

    pc.current.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
    };

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));
    localVideo.current.srcObject = stream;

    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);
    sendSignal("offer", offer);

    setConnected(true);
    setMode("call");
  };

  const createRoom = () => {
    const newRoom = Math.random().toString(36).substr(2, 6).toUpperCase();
    setRoom(newRoom);
    setMode("join");
  };

  const joinRoom = () => {
    if (name && room) startCall();
  };

  const copyRoom = () => {
    navigator.clipboard.writeText(window.location.origin + "?room=" + room);
    alert("Room link copied!");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      {mode === "menu" && (
        <div className="bg-gray-900 p-6 rounded-2xl shadow-lg max-w-md w-full text-center">
          <h1 className="text-3xl font-bold mb-6"> WEBRTC Video Chat</h1>
          <input
            className="w-full p-3 rounded-lg bg-gray-800 text-white mb-4"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-col gap-3">
            <button
              onClick={createRoom}
              disabled={!name}
              className="w-full bg-green-500 hover:bg-green-600 p-3 rounded-lg font-semibold"
            >
              Create Room
            </button>
            <button
              onClick={() => setMode("join")}
              disabled={!name}
              className="w-full bg-blue-500 hover:bg-blue-600 p-3 rounded-lg font-semibold"
            >
              Join Room
            </button>
          </div>
        </div>
      )}

      {mode === "join" && (
        <div className="bg-gray-900 p-6 rounded-2xl shadow-lg max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-4">Join Room</h2>
          <input
            className="w-full p-3 rounded-lg bg-gray-800 text-white mb-4"
            placeholder="Room Code"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
          <div className="flex gap-2 justify-center mb-4">
            <button onClick={copyRoom} className="bg-gray-700 p-2 rounded-lg">
              <Copy size={18} />
            </button>
          </div>
          <button
            onClick={joinRoom}
            className="w-full bg-green-500 hover:bg-green-600 p-3 rounded-lg font-semibold"
          >
            Start Call
          </button>
        </div>
      )}

      {mode === "call" && (
        <div className="w-full max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <video ref={localVideo} autoPlay playsInline muted className="w-full rounded-xl bg-black" />
            <video ref={remoteVideo} autoPlay playsInline className="w-full rounded-xl bg-black" />
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 p-3 rounded-full shadow-lg"
            >
              <PhoneOff /> Leave
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

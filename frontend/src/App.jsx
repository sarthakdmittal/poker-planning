import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Landing from "./components/Landing.jsx";
import CreateRoom from "./components/CreateRoom.jsx";
import JoinRoom from "./components/JoinRoom.jsx";
import RoomRouter from "./components/RoomRouter.jsx";
import { socket } from "./socket";
import '../jira-content.css';

function App() {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedName = localStorage.getItem("pokerUserName");
    if (savedName) {
      setName(savedName);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetch("https://poker-planning-1.onrender.com")
      .then(() => console.log("Backend awake"))
      .catch(() => console.log("Backend waking..."));
  }, []);

  const handleSetName = (newName) => {
    setName(newName);
    localStorage.setItem("pokerUserName", newName);
  };

  const handleLeaveRoom = () => {
    setName("");
  };

  if (isLoading) {
    return <div className="loading-app">Loading...</div>;
  }

  return (
    <Router>
      <div className="jira-content">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/create-room" element={<CreateRoom setName={handleSetName} />} />
          <Route path="/join-room" element={<JoinRoom setName={handleSetName} />} />
          <Route path="/room/:roomId" element={<RoomRouter name={name} onLeaveRoom={handleLeaveRoom} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
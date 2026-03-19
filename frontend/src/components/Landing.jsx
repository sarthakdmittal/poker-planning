// components/Landing.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from "../socket";

export default function Landing() {
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    navigate('/create-room');
  };

  const handleJoinRoom = () => {
    navigate('/join-room');
  };

  return (
    <div className="landing-page">
      <div className="landing-card">
        <h1 className="landing-title">Planning Poker</h1>
        <p className="landing-subtitle">Choose an option to continue</p>

        <div className="landing-options">
          <div className="landing-option create-option" onClick={handleCreateRoom}>
            <div className="option-icon">➕</div>
            <h2>Create a Room</h2>
            <p>Start a new planning poker session</p>
          </div>

          <div className="landing-option join-option" onClick={handleJoinRoom}>
            <div className="option-icon">🔗</div>
            <h2>Join a Room</h2>
            <p>Join an existing session with room ID</p>
          </div>
        </div>
      </div>
    </div>
  );
}
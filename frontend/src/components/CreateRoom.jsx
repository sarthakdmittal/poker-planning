// components/CreateRoom.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from "../socket";
import { FaCopy, FaRegCopy } from "react-icons/fa";

export default function CreateRoom({ setName }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [roomIdCopied, setRoomIdCopied] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [userNameState, setUserNameState] = useState('');

  useEffect(() => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGeneratedRoomId(newRoomId);
  }, []);

  useEffect(() => {
    const onConnect = () => {
      console.log("Socket connected in CreateRoom");
      setSocketConnected(true);
      setError('');
    };

    const onDisconnect = () => {
      console.log("Socket disconnected in CreateRoom");
      setSocketConnected(false);
      setError('Disconnected from server. Please refresh.');
    };

    const onConnectError = (error) => {
      console.error("Socket connection error in CreateRoom:", error);
      setSocketConnected(false);
      setError('Cannot connect to server. Please check if backend is running.');
    };

    const handleRoomCreated = ({ roomId }) => {
      console.log('Room created successfully:', roomId);
      setIsLoading(false);

      navigate(`/room/${roomId}`, {
        state: { userName: userNameState } // ✅ FIXED
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room-created', handleRoomCreated);

    // Check initial connection
    setSocketConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room-created', handleRoomCreated);
    };
  }, [navigate]);

  const createRoom = (e) => {
    e.preventDefault();

    if (!socketConnected) {
      setError('Not connected to server. Please wait or refresh.');
      return;
    }

    setIsLoading(true);

    const userName = e.target.userName.value.trim();
    const roomName = e.target.roomName.value.trim();

    if (!userName || !roomName) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    setUserNameState(userName); // ✅ ADD THIS

    socket.emit('create-room', {
      userName,
      roomName,
      roomId: generatedRoomId
    });

    setName(userName);
  };

  const regenerateRoomId = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setGeneratedRoomId(newRoomId);
    setRoomIdCopied(false);
  };

  const copyRoomIdToClipboard = () => {
    navigator.clipboard.writeText(generatedRoomId);
    setRoomIdCopied(true);
    setTimeout(() => setRoomIdCopied(false), 2000);
  };

  return (
    <div className="create-room-page">
      <div className="create-room-container">
        <button className="back-button" onClick={() => navigate('/')}>
          <span className="back-icon">←</span> Back
        </button>

        <div className="create-room-header">
          <div className="header-icon">🎲</div>
          <h1 className="create-room-title">Create New Room</h1>
          <p className="create-room-subtitle">Set up your planning poker session</p>
        </div>

        {!socketConnected && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            Connecting to server... Please wait.
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={createRoom} className="create-room-form">
          <div className="form-group">
            <label htmlFor="userName" className="form-label">
              <span className="label-icon">👤</span>
              Your Name
            </label>
            <input
              id="userName"
              name="userName"
              type="text"
              placeholder="Enter your name"
              className="form-input"
              autoComplete="off"
              required
              maxLength={30}
            />
            <div className="input-hint">This is how others will see you</div>
          </div>

          <div className="form-group">
            <label htmlFor="roomName" className="form-label">
              <span className="label-icon">📋</span>
              Room Name
            </label>
            <input
              id="roomName"
              name="roomName"
              type="text"
              placeholder="e.g., Sprint Planning, Feature Estimation"
              className="form-input"
              autoComplete="off"
              required
              maxLength={50}
            />
            <div className="input-hint">Give your session a descriptive name</div>
          </div>

          <div className="room-id-section">
            <div className="room-id-label">
              <span className="label-icon">🔑</span>
              Room ID (auto-generated)
            </div>
            <div className="room-id-container">
              <div className="room-id-display">
                <span className="room-id-prefix">#</span>
                <span className="room-id-value">{generatedRoomId}</span>
              </div>
              <button
                type="button"
                className="copy-id-btn"
                onClick={copyRoomIdToClipboard}
                title="Copy room ID to clipboard"
              >
                {roomIdCopied ? <FaCopy className="copy-icon copied" /> : <FaRegCopy className="copy-icon" />}
              </button>
              <button
                type="button"
                className="regenerate-btn"
                onClick={regenerateRoomId}
                title="Generate new room ID"
              >
                <span className="regenerate-icon">↻</span>
              </button>
            </div>
            <div className="room-id-hint">
              <span className="hint-icon">ℹ️</span>
              Share this ID with others to join your session
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="create-room-btn"
              disabled={isLoading || !socketConnected}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Creating Room...
                </>
              ) : !socketConnected ? (
                <>
                  <span className="loading-spinner"></span>
                  Connecting...
                </>
              ) : (
                <>
                  <span className="btn-icon">✨</span>
                  Create Room
                </>
              )}
            </button>
          </div>
        </form>

        <div className="create-room-features">
          <div className="feature-item">
            <span className="feature-icon">🔄</span>
            <div className="feature-text">
              <strong>Real-time voting</strong>
              <span>See votes as they come in</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <div className="feature-text">
              <strong>Instant results</strong>
              <span>Reveal votes with one click</span>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">👥</span>
            <div className="feature-text">
              <strong>Team collaboration</strong>
              <span>Up to 20 participants</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
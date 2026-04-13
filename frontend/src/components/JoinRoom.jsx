// components/JoinRoom.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from "../socket";

const AVATAR_ICONS = [
  '🦊', '🐺', '🦁', '🐯', '🐻', '🐼', '🐨', '🐸',
  '🦄', '🐲', '🦅', '🦉', '🦋', '🐙', '🦀', '🐬',
  '🧙', '🦸', '🧛', '🤖', '👻', '👽', '🥷', '🧝',
  '🧜', '🧚', '🐱', '🐶', '🐧', '🔥', '🚀', '⚡',
];

export default function JoinRoom({ setName }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(null);

  useEffect(() => {
    const handleError = ({ message }) => {
      setError(message);
      setIsLoading(false);
    };
    socket.on('error', handleError);
    return () => socket.off('error', handleError);
  }, []);

  const joinRoom = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const userName = e.target.userName.value.trim();
    const roomId = e.target.roomId.value.trim().toUpperCase();

    if (!userName || !roomId) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    // Emit join room event — include adminSecret if this device created the room
    socket.emit('join-room', {
      userName,
      roomId,
      adminSecret: localStorage.getItem(`adminSecret_${roomId}`) || undefined,
      ...(selectedIcon && { userIcon: selectedIcon })
    });

    // Listen for room-joined confirmation before navigating
    const handleJoined = () => {
      socket.off('room-joined', handleJoined);
      socket.off('error', handleJoinError);
      setName(userName);
      navigate(`/room/${roomId}`);
    };
    const handleJoinError = ({ message }) => {
      socket.off('room-joined', handleJoined);
      socket.off('error', handleJoinError);
      setError(message);
      setIsLoading(false);
    };
    socket.once('room-joined', handleJoined);
    socket.once('error', handleJoinError);
  };

  return (
    <div className="join-room-page">
      <div className="join-room-container">
        <button className="back-button" onClick={() => navigate('/')}>
          <span className="back-icon">←</span> Back
        </button>

        <div className="join-room-header">
          <div className="header-icon">🔗</div>
          <h1 className="join-room-title">Join a Room</h1>
          <p className="join-room-subtitle">Enter your details to join an existing session</p>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={joinRoom} className="join-room-form">
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
            <div className="input-hint">This is how others will see you in the room</div>
          </div>

          <div className="form-group">
            <label className="form-label">
              <span className="label-icon">🎨</span>
              Your Icon <span className="optional-badge">Optional</span>
            </label>
            <div className="icon-picker-grid">
              <button
                type="button"
                className={`icon-option icon-none ${selectedIcon === null ? 'selected' : ''}`}
                onClick={() => setSelectedIcon(null)}
                title="No icon (use initials)"
              >
                <span>A</span>
              </button>
              {AVATAR_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`icon-option ${selectedIcon === icon ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(icon === selectedIcon ? null : icon)}
                  title={icon}
                >
                  {icon}
                </button>
              ))}
            </div>
            <div className="input-hint">Pick an icon to represent you in the room</div>
          </div>

          <div className="form-group">
            <label htmlFor="roomId" className="form-label">
              <span className="label-icon">🔑</span>
              Room ID
            </label>
            <div className="room-input-wrapper">
              <input
                id="roomId"
                name="roomId"
                type="text"
                placeholder="e.g., ABC123"
                className="form-input room-input"
                autoComplete="off"
                required
                maxLength={6}
                style={{ textTransform: 'uppercase' }}
              />
              <div className="room-input-hint">6-character code</div>
            </div>
            <div className="input-hint">
              <span className="hint-icon">ℹ️</span>
              Enter the room ID provided by the room creator
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="join-room-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Joining Room...
                </>
              ) : (
                <>
                  <span className="btn-icon">🚪</span>
                  Join Room
                </>
              )}
            </button>
          </div>
        </form>

        <div className="join-room-features">
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
              <span>Join and vote with your team</span>
            </div>
          </div>
        </div>

        <div className="join-room-tip">
          <span className="tip-icon">💡</span>
          <span className="tip-text">Don't have a room ID? Ask the room creator to share it with you.</span>
        </div>
      </div>
    </div>
  );
}
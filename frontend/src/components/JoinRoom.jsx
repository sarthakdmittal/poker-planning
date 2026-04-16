// components/JoinRoom.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from "../socket";

const DICEBEAR_BASE = 'https://api.dicebear.com/9.x';
const AVATAR_BG = 'backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf&radius=50';
const AVATAR_SEEDS = {
  male:   { style: 'adventurer',         seeds: ['Felix', 'Max', 'Oliver', 'Noah', 'Ethan', 'Jack', 'Henry', 'Leo', 'Oscar', 'James', 'Charlie', 'Hugo'] },
  female: { style: 'adventurer',         seeds: ['Sophie', 'Emma', 'Lily', 'Mia', 'Ava', 'Grace', 'Ruby', 'Clara', 'Zoe', 'Luna', 'Stella', 'Aria'] },
  other:  { style: 'adventurer-neutral', seeds: ['Alex', 'Riley', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Avery', 'Quinn', 'Sage', 'Rowan', 'Sky', 'River'] },
};
const getAvatarUrl = (style, seed) =>
  `${DICEBEAR_BASE}/${style}/svg?seed=${encodeURIComponent(seed)}&${AVATAR_BG}`;
const resizeImage = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = Math.min(img.width, img.height);
      canvas.width = 100; canvas.height = 100;
      canvas.getContext('2d').drawImage(img,
        (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 100, 100);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

export default function JoinRoom({ setName }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [selectedGender, setSelectedGender] = useState(null);
  const fileInputRef = useRef(null);

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

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const resized = await resizeImage(file);
    setSelectedIcon(resized);
    e.target.value = '';
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
              Your Avatar <span className="optional-badge">Optional</span>
            </label>

            {/* Upload photo strip */}
            <div className="avatar-upload-strip">
              {selectedIcon?.startsWith('data:') ? (
                <div className="uploaded-avatar-preview">
                  <img src={selectedIcon} alt="Your photo" className="uploaded-avatar-img" />
                  <div className="uploaded-avatar-info">
                    <span>Your photo selected</span>
                    <button type="button" className="remove-upload-btn" onClick={() => setSelectedIcon(null)}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="upload-photo-btn" onClick={() => fileInputRef.current?.click()}>
                  <span className="upload-photo-icon">📷</span>
                  <span>Upload a photo</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
            </div>

            {/* Preset avatars (hidden when photo uploaded) */}
            {!selectedIcon?.startsWith('data:') && (
              <>
                <div className="avatar-section-divider"><span>or choose a preset</span></div>
                <div className="gender-selector">
                  {[
                    { key: 'male', label: '♂ Male' },
                    { key: 'female', label: '♀ Female' },
                    { key: 'other', label: '⚧ Other' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      className={`gender-btn ${selectedGender === key ? 'selected' : ''}`}
                      onClick={() => { setSelectedGender(key); setSelectedIcon(null); }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {selectedGender && (
                  <div className="avatar-picker-grid">
                    <button
                      type="button"
                      className={`avatar-option avatar-none ${selectedIcon === null ? 'selected' : ''}`}
                      onClick={() => setSelectedIcon(null)}
                      title="No avatar (use initials)"
                    >
                      <span>A</span>
                    </button>
                    {AVATAR_SEEDS[selectedGender].seeds.map((seed) => {
                      const url = getAvatarUrl(AVATAR_SEEDS[selectedGender].style, seed);
                      return (
                        <button
                          key={seed}
                          type="button"
                          className={`avatar-option ${selectedIcon === url ? 'selected' : ''}`}
                          onClick={() => setSelectedIcon(selectedIcon === url ? null : url)}
                          title={seed}
                        >
                          <img src={url} alt={seed} loading="lazy" className="avatar-preset-img" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <div className="input-hint">
              {selectedIcon?.startsWith('data:')
                ? 'Using your uploaded photo'
                : selectedGender
                  ? 'Pick an avatar to represent you'
                  : 'Upload a photo or choose a preset avatar'}
            </div>
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
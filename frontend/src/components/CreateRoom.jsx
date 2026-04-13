import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from "../socket";
import { FaCopy, FaRegCopy, FaSave, FaTrash, FaEye, FaEyeSlash, FaLock } from "react-icons/fa";
import { encryptCredentials, decryptCredentials } from '../utils/cryptoUtils';

const AVATAR_ICONS = [
  '🦊', '🐺', '🦁', '🐯', '🐻', '🐼', '🐨', '🐸',
  '🦄', '🐲', '🦅', '🦉', '🦋', '🐙', '🦀', '🐬',
  '🧙', '🦸', '🧛', '🤖', '👻', '👽', '🥷', '🧝',
  '🧜', '🧚', '🐱', '🐶', '🐧', '🔥', '🚀', '⚡',
];

// Define ESTIMATION_SCALES
const ESTIMATION_SCALES = {
  FIBONACCI: {
    name: 'Fibonacci',
    cards: [0, 1, 2, 3, 5, 8, 13, 21],
    description: 'Classic Fibonacci sequence'
  },
  FIBONACCI_MODIFIED: {
    name: 'Modified Fibonacci',
    cards: [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100],
    description: 'Extended Fibonacci with half points and larger values'
  },
  T_SHIRTS: {
    name: 'T-Shirt Sizes',
    cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    description: 'Relative sizing with T-shirt sizes'
  },
  POWDER_TWO: {
    name: 'Powers of 2',
    cards: [0, 1, 2, 4, 8, 16, 32, 64],
    description: 'Exponential scale using powers of 2'
  },
  LINEAR: {
    name: 'Linear',
    cards: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    description: 'Simple linear scale 0-10'
  },
  CUSTOM: {
    name: 'Custom',
    cards: [],
    description: 'Define your own custom scale'
  }
};

export default function CreateRoom({ setName }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [roomIdCopied, setRoomIdCopied] = useState(false);
  const [socketConnected, setSocketConnected] = useState(socket.connected);
  const [userNameState, setUserNameState] = useState('');
  const [selectedScale, setSelectedScale] = useState('FIBONACCI');
  const [customScaleInput, setCustomScaleInput] = useState('');
  const [showCustomScaleInput, setShowCustomScaleInput] = useState(false);

  // Jira integration state
  const [enableJira, setEnableJira] = useState(false);
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [showJiraToken, setShowJiraToken] = useState(false);

  // Saved / PIN state
  const [hasEncryptedCreds, setHasEncryptedCreds] = useState(false);
  const [hasLegacyCreds, setHasLegacyCreds] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // PIN modal: mode is null | 'save' | 'load' | 'migrate'
  const [pinModal, setPinModal] = useState(null);
  const [pinValue, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Detect stored credentials on mount
  useEffect(() => {
    setHasEncryptedCreds(!!localStorage.getItem('jiraCredentials'));
    // Legacy plain-text keys (pre-encryption)
    setHasLegacyCreds(
      !!localStorage.getItem('jiraEmail') && !!localStorage.getItem('jiraToken')
    );
  }, []);

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

    const handleRoomCreated = ({ roomId, adminSecret }) => {
      console.log('Room created successfully:', roomId);
      // Persist the admin secret so this device can always rejoin as admin
      if (adminSecret) {
        localStorage.setItem(`adminSecret_${roomId}`, adminSecret);
      }
      setIsLoading(false);
      navigate(`/room/${roomId}`, {
        state: { userName: userNameState }
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room-created', handleRoomCreated);

    setSocketConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room-created', handleRoomCreated);
    };
  }, [navigate, userNameState]);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3000);
  };

  const openPinModal = (mode) => {
    setPinValue('');
    setPinConfirm('');
    setPinError('');
    setPinLoading(false);
    setPinModal(mode);
  };

  const closePinModal = () => {
    setPinModal(null);
    setPinValue('');
    setPinConfirm('');
    setPinError('');
  };

  const handlePinConfirm = async () => {
    if (!pinValue.trim()) {
      setPinError('Please enter a PIN.');
      return;
    }

    if ((pinModal === 'save' || pinModal === 'migrate') && pinValue !== pinConfirm) {
      setPinError('PINs do not match.');
      return;
    }

    setPinLoading(true);
    setPinError('');

    try {
      if (pinModal === 'save') {
        if (!jiraEmail.trim() || !jiraToken.trim()) {
          setPinError('Please enter email and token first.');
          setPinLoading(false);
          return;
        }
        const encrypted = await encryptCredentials(
          { email: jiraEmail.trim(), token: jiraToken.trim() },
          pinValue
        );
        localStorage.setItem('jiraCredentials', encrypted);
        // Remove any legacy plain-text keys
        localStorage.removeItem('jiraEmail');
        localStorage.removeItem('jiraToken');
        setHasEncryptedCreds(true);
        setHasLegacyCreds(false);
        closePinModal();
        showMessage('success', '✓ Credentials encrypted and saved.');

      } else if (pinModal === 'load') {
        const stored = localStorage.getItem('jiraCredentials');
        const creds = await decryptCredentials(stored, pinValue);
        setJiraEmail(creds.email);
        setJiraToken(creds.token);
        setEnableJira(true);
        closePinModal();
        showMessage('success', '✓ Credentials loaded.');

      } else if (pinModal === 'migrate') {
        // Encrypt the legacy plain-text creds with the new PIN
        const email = localStorage.getItem('jiraEmail');
        const token = localStorage.getItem('jiraToken');
        const encrypted = await encryptCredentials({ email, token }, pinValue);
        localStorage.setItem('jiraCredentials', encrypted);
        localStorage.removeItem('jiraEmail');
        localStorage.removeItem('jiraToken');
        setHasEncryptedCreds(true);
        setHasLegacyCreds(false);
        closePinModal();
        showMessage('success', '✓ Credentials secured with PIN.');
      }
    } catch {
      // AES-GCM throws on wrong PIN
      if (pinModal === 'load') {
        setPinError('Incorrect PIN. Please try again.');
      } else {
        setPinError('Encryption failed. Please try again.');
      }
      setPinLoading(false);
    }
  };

  const handleDeleteCredentials = () => {
    localStorage.removeItem('jiraCredentials');
    localStorage.removeItem('jiraEmail');
    localStorage.removeItem('jiraToken');
    setHasEncryptedCreds(false);
    setHasLegacyCreds(false);
    showMessage('success', '✓ Saved credentials deleted.');
  };

  const handleSaveCredentials = () => {
    if (!jiraEmail.trim() || !jiraToken.trim()) {
      showMessage('error', 'Please enter both email and token to save.');
      return;
    }
    openPinModal('save');
  };

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

    // Validate Jira credentials if enabled
    if (enableJira) {
      if (!jiraEmail.trim() || !jiraToken.trim()) {
        setError('Please provide Jira email and API token');
        setIsLoading(false);
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(jiraEmail.trim())) {
        setError('Please enter a valid email address');
        setIsLoading(false);
        return;
      }
    }

    // Validate custom scale if selected
    let cards;
    if (selectedScale === 'CUSTOM') {
      cards = customScaleInput.split(',').map(item => {
        const trimmed = item.trim();
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      });

      if (cards.length === 0) {
        setError('Please enter at least one value for custom scale');
        setIsLoading(false);
        return;
      }
    } else {
      cards = ESTIMATION_SCALES[selectedScale].cards;
    }

    setUserNameState(userName);

    // Prepare room data
    const roomData = {
      userName,
      roomName,
      roomId: generatedRoomId,
      estimationScale: {
        type: selectedScale,
        cards: cards
      },
      ...(selectedIcon && { userIcon: selectedIcon })
    };

    // Add Jira credentials if enabled
    if (enableJira) {
      roomData.jiraEmail = jiraEmail.trim();
      roomData.jiraToken = jiraToken.trim();
    }

    socket.emit('create-room', roomData);
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

  const handleScaleChange = (e) => {
    const scale = e.target.value;
    setSelectedScale(scale);
    setShowCustomScaleInput(scale === 'CUSTOM');

    if (scale === 'CUSTOM') {
      setCustomScaleInput('0, 1, 2, 3, 5, 8, 13, 21');
    }
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

        {message.text && (
          <div className={`message ${message.type}`}>
            <span className="message-icon">{message.type === 'success' ? '✓' : '⚠️'}</span>
            {message.text}
          </div>
        )}

        {/* Legacy plain-text credentials migration notice */}
        {hasLegacyCreds && (
          <div className="legacy-credentials-notice">
            <div className="notice-header">⚠️ Unencrypted credentials detected</div>
            <div className="notice-body">
              Your Jira credentials are stored as plain text. Secure them with a PIN or delete them.
            </div>
            <div className="legacy-actions">
              <button className="btn-secure" onClick={() => openPinModal('migrate')}>
                <FaLock /> Secure with PIN
              </button>
              <button className="btn-delete" onClick={handleDeleteCredentials}>
                <FaTrash /> Delete
              </button>
            </div>
          </div>
        )}

        {/* Encrypted credentials found */}
        {hasEncryptedCreds && !hasLegacyCreds && (
          <div className="saved-credentials-prompt">
            <div className="prompt-content">
              <div className="prompt-icon"><FaLock /></div>
              <div className="prompt-text">
                <strong>Encrypted credentials found</strong>
                <p>Enter your PIN to load them.</p>
              </div>
              <div className="prompt-actions">
                <button className="btn-load" onClick={() => openPinModal('load')}>
                  Load & Enable
                </button>
                <button className="btn-delete" onClick={handleDeleteCredentials}>
                  <FaTrash /> Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PIN Modal */}
        {pinModal && (
          <div className="pin-modal-overlay" onClick={(e) => e.target === e.currentTarget && closePinModal()}>
            <div className="pin-modal">
              <div className="pin-modal-header">
                <div className="pin-modal-icon-wrap">
                  {pinModal === 'load' ? <FaLock /> : <FaLock />}
                </div>
                <h2 className="pin-modal-title">
                  {pinModal === 'load' ? 'Enter PIN' : 'Create PIN'}
                </h2>
                <p className="pin-modal-subtitle">
                  {pinModal === 'load'
                    ? 'Enter your PIN to decrypt and load your saved Jira credentials.'
                    : 'Choose a PIN to encrypt your Jira credentials. You\'ll need it each time you load them.'
                  }
                </p>
              </div>

              {pinError && <div className="pin-modal-error">⚠️ {pinError}</div>}

              <div className="pin-modal-field">
                <label>PIN</label>
                <input
                  type="password"
                  placeholder="Enter PIN"
                  value={pinValue}
                  onChange={(e) => setPinValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !pinLoading && handlePinConfirm()}
                  autoFocus
                />
              </div>

              {(pinModal === 'save' || pinModal === 'migrate') && (
                <div className="pin-modal-field">
                  <label>Confirm PIN</label>
                  <input
                    type="password"
                    placeholder="Confirm PIN"
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !pinLoading && handlePinConfirm()}
                  />
                </div>
              )}

              <div className="pin-modal-actions">
                <button className="pin-modal-cancel" onClick={closePinModal} disabled={pinLoading}>
                  Cancel
                </button>
                <button className="pin-modal-confirm" onClick={handlePinConfirm} disabled={pinLoading}>
                  {pinLoading ? 'Processing…' : pinModal === 'load' ? 'Unlock' : 'Encrypt & Save'}
                </button>
              </div>
            </div>
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

          {/* Jira Integration Section */}
          <div className="form-group jira-integration-group">
            <label className="form-label">
              <span className="label-icon">🔌</span>
              Jira Integration (Optional)
            </label>
            <div className="jira-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={enableJira}
                  onChange={(e) => setEnableJira(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">
                {enableJira ? 'Jira integration enabled' : 'Enable Jira integration'}
              </span>
            </div>
            <div className="input-hint">
              Enable to automatically update Jira issues after voting
            </div>

            {enableJira && (
              <div className="jira-credentials">
                <div className="credential-field">
                  <label htmlFor="jiraEmail" className="credential-label">
                    Jira Email Address
                  </label>
                  <input
                    id="jiraEmail"
                    type="email"
                    value={jiraEmail}
                    onChange={(e) => setJiraEmail(e.target.value)}
                    placeholder="your-email@company.com"
                    className="form-input"
                    required={enableJira}
                  />
                  <div className="input-hint">
                    Your Atlassian account email
                  </div>
                </div>

                <div className="credential-field">
                  <label htmlFor="jiraToken" className="credential-label">
                    API Token
                  </label>
                  <div className="token-input-wrapper">
                    <input
                      id="jiraToken"
                      type={showJiraToken ? "text" : "password"}
                      value={jiraToken}
                      onChange={(e) => setJiraToken(e.target.value)}
                      placeholder="Enter your API token"
                      className="form-input"
                      required={enableJira}
                    />
                    <button
                      type="button"
                      className="toggle-token-visibility"
                      onClick={() => setShowJiraToken(!showJiraToken)}
                    >
                      {showJiraToken ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <div className="input-hint">
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      How to get your API token
                    </a>
                  </div>
                </div>

                {/* Save Credentials Button */}
                <button
                  type="button"
                  className="save-credentials-btn"
                  onClick={handleSaveCredentials}
                  disabled={!jiraEmail.trim() || !jiraToken.trim()}
                >
                  <FaLock /> Encrypt & Save Credentials
                </button>
              </div>
            )}
          </div>

          {/* Estimation Scale Selection */}
          <div className="form-group scale-selection-group">
            <label className="form-label">
              <span className="label-icon">📊</span>
              Estimation Scale
            </label>
            <div className="scale-options">
              {Object.entries(ESTIMATION_SCALES).map(([key, scale]) => (
                <label key={key} className={`scale-option ${selectedScale === key ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="estimationScale"
                    value={key}
                    checked={selectedScale === key}
                    onChange={handleScaleChange}
                  />
                  <div className="scale-option-content">
                    <strong className="scale-name">{scale.name}</strong>
                    <span className="scale-description">{scale.description}</span>
                    <div className="scale-preview">
                      {scale.cards.slice(0, 5).map((card, i) => (
                        <span key={i} className="preview-card">{String(card)}</span>
                      ))}
                      {scale.cards.length > 5 && <span className="preview-more">...</span>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Scale Input */}
          {showCustomScaleInput && (
            <div className="form-group custom-scale-group">
              <label htmlFor="customScale" className="form-label">
                <span className="label-icon">✏️</span>
                Custom Values (comma-separated)
              </label>
              <input
                id="customScale"
                type="text"
                value={customScaleInput}
                onChange={(e) => setCustomScaleInput(e.target.value)}
                placeholder="e.g., 0, 1, 2, 3, 5, 8, 13, 21"
                className="form-input"
              />
              <div className="input-hint">Enter numbers or text values separated by commas</div>
            </div>
          )}

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
            <span className="feature-icon">📏</span>
            <div className="feature-text">
              <strong>Multiple scales</strong>
              <span>Fibonacci, T-shirts, and more</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
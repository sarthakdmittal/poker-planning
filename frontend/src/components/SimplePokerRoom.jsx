import { useEffect, useState, useRef } from "react";
import { socket } from "../socket";
import { useParams } from 'react-router-dom';
import Card from "./Card.jsx";
import {
  FaCheck, FaUsers, FaEye, FaEyeSlash, FaArrowLeft, FaArrowRight,
  FaUndo, FaStar, FaPencilAlt, FaCopy, FaRegCopy, FaUserSecret,
  FaEdit, FaPlus, FaTimes, FaList, FaTrash
} from "react-icons/fa";
import '../../jira-content.css';
import './PokerRoom.css';

// Estimation scale types
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

// Generate avatar color based on user name
const getAvatarColor = (name) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
    '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71',
    '#E74C3C', '#1ABC9C', '#F1C40F', '#8E44AD', '#27AE60'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Get initials from name
const getInitials = (name) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const isImageUrl = (val) => val && (val.startsWith('http') || val.startsWith('data:'));

// Calculate statistics from votes
const calculateStats = (votes) => {
  const values = Object.values(votes).filter(v => v !== null && v !== undefined);
  if (values.length === 0) return null;

  const numericValues = values.map(v => {
    if (typeof v === 'string' && isNaN(Number(v))) {
      const sizeMap = {
        'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6
      };
      return sizeMap[v] || 3;
    }
    return Number(v);
  }).filter(v => !isNaN(v));

  if (numericValues.length === 0) return null;

  const sum = numericValues.reduce((a, b) => a + b, 0);
  const avg = sum / numericValues.length;
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);

  return {
    avg: avg.toFixed(1),
    min,
    max,
    count: numericValues.length,
    originalValues: values
  };
};

export default function SimplePokerRoom({ name, onLeaveRoom }) {
  const { roomId } = useParams();
  const [users, setUsers] = useState({});
  const [userIcons, setUserIcons] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState(null);
  const [finalPoint, setFinalPoint] = useState(null);
  const [adminName, setAdminName] = useState(null);
  const [customPoint, setCustomPoint] = useState(8);

  // Story management states
  const [stories, setStories] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [showStoryInput, setShowStoryInput] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [newStoryDescription, setNewStoryDescription] = useState("");
  const [editingStory, setEditingStory] = useState(false);
  const [editStoryIndex, setEditStoryIndex] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [selectedCard, setSelectedCard] = useState(null);
  const [votedUsers, setVotedUsers] = useState([]);
  const [userVotes, setUserVotes] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [observers, setObservers] = useState({});
  const [observingTarget, setObservingTarget] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(true);
  const [roomName, setRoomName] = useState("");
  const [roomIdCopied, setRoomIdCopied] = useState(false);
  const [cards, setCards] = useState([0, 1, 2, 3, 5, 8, 13, 21]);
  const [scaleType, setScaleType] = useState('FIBONACCI');
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  // Add flag to track if we've restored from localStorage
  const [hasRestoredState, setHasRestoredState] = useState(false);
  // Add flag to prevent overwriting revealed state from server
  const isInitialMount = useRef(true);

  const currentStory = stories[currentStoryIndex] || null;
  const isAdmin = name && adminName && name === adminName;
  const currentUserId = Object.keys(users).find(uid => users[uid] === name);
  const isCurrentUserObserver = currentUserId ? observers[currentUserId] : false;

  // Load saved data from localStorage
  useEffect(() => {
    if (roomId && !hasRestoredState) {
      const savedData = localStorage.getItem(`simpleStoryData_${roomId}`);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.savedAt) {
          const savedTime = new Date(parsed.savedAt).getTime();
          const currentTime = new Date().getTime();
          const hoursDiff = (currentTime - savedTime) / (1000 * 60 * 60);

          if (hoursDiff > 24) {
            localStorage.removeItem(`simpleStoryData_${roomId}`);
            localStorage.removeItem(`simpleUsers_${roomId}`);
            localStorage.removeItem(`simpleObservers_${roomId}`);
            localStorage.removeItem(`simpleAdmin_${roomId}`);
          } else {
            // Restore all states including revealed votes
            setStories(parsed.stories || []);
            setCurrentStoryIndex(parsed.currentStoryIndex || 0);
            setRevealed(parsed.revealed || false);
            setFinalPoint(parsed.finalPoint || null);
            setSelectedCard(parsed.selectedCard || null);
            setVotedUsers(parsed.votedUsers || []);
            setUserVotes(parsed.userVotes || {});
            setResults(parsed.results || null);
            setCards(parsed.cards || [0, 1, 2, 3, 5, 8, 13, 21]);
            setScaleType(parsed.scaleType || 'FIBONACCI');

            console.log("Restored state:", {
              revealed: parsed.revealed,
              hasResults: !!parsed.results,
              voteCount: parsed.results?.votes ? Object.keys(parsed.results.votes).length : 0
            });
          }
        }
      }

      const savedUsers = localStorage.getItem(`simpleUsers_${roomId}`);
      if (savedUsers) {
        const parsed = JSON.parse(savedUsers);
        setUsers(parsed);
      }

      const savedObservers = localStorage.getItem(`simpleObservers_${roomId}`);
      if (savedObservers) {
        const parsed = JSON.parse(savedObservers);
        setObservers(parsed);
      }

      const savedAdmin = localStorage.getItem(`simpleAdmin_${roomId}`);
      if (savedAdmin) {
        setAdminName(savedAdmin);
      }

      setHasRestoredState(true);
      setTimeout(() => setIsLoading(false), 100);
    }
  }, [roomId, hasRestoredState]);

  // Save data to localStorage
  useEffect(() => {
    if (roomId && !isLoading && hasRestoredState) {
      const timestamp = new Date().toISOString();
      const storyData = {
        stories,
        currentStoryIndex,
        revealed,
        finalPoint,
        selectedCard,
        votedUsers,
        userVotes,
        results,
        cards,
        scaleType,
        savedAt: timestamp
      };
      localStorage.setItem(`simpleStoryData_${roomId}`, JSON.stringify(storyData));
      localStorage.setItem(`simpleUsers_${roomId}`, JSON.stringify(users));
      localStorage.setItem(`simpleObservers_${roomId}`, JSON.stringify(observers));
      if (adminName) {
        localStorage.setItem(`simpleAdmin_${roomId}`, adminName);
      }
    }
  }, [roomId, stories, currentStoryIndex, revealed, finalPoint, selectedCard,
      votedUsers, userVotes, results, users, observers, adminName, cards, scaleType, isLoading, hasRestoredState]);

  // Request stories when joining
  useEffect(() => {
    if (roomId && !isLoading && hasRestoredState) {
      socket.emit("request-stories", { roomId });
    }
  }, [roomId, isLoading, hasRestoredState]);

  // Socket event handlers
  useEffect(() => {
    if (roomId && hasRestoredState) {
      socket.emit("getUsers", { roomId });
      socket.emit("requestObservers", { roomId });
      socket.emit("getRoomInfo", { roomId });
      socket.emit("join-room", {
        userName: name,
        roomId,
        adminSecret: localStorage.getItem(`adminSecret_${roomId}`) || undefined
      });
    }
  }, [roomId, name, hasRestoredState]);

  useEffect(() => {
    const onConnect = () => {
      if (roomId && hasRestoredState) {
        socket.emit("getUsers", { roomId });
        socket.emit("requestObservers", { roomId });
        socket.emit("getCurrentAdmin", { roomId });
        socket.emit("request-stories", { roomId });
      }
    };

    socket.on("connect", onConnect);
    return () => socket.off("connect", onConnect);
  }, [roomId, hasRestoredState]);

  useEffect(() => {
    if (!roomId || !hasRestoredState) return;

    const checkUserInRoom = () => {
      const isUserInRoom = Object.values(users).includes(name);
      if (isUserInRoom) {
        setIsReconnecting(false);
      } else {
        socket.emit("join-room", { userName: name, roomId });
      }
    };

    checkUserInRoom();

    const handleUsersUpdate = () => checkUserInRoom();
    socket.on("users", handleUsersUpdate);

    const timeout = setTimeout(() => {
      if (Object.keys(users).length > 0 && isReconnecting) {
        setIsReconnecting(false);
      }
    }, 2000);

    return () => {
      socket.off("users", handleUsersUpdate);
      clearTimeout(timeout);
    };
  }, [roomId, name, users, hasRestoredState]);

  useEffect(() => {
    // Handle stories update from server
    socket.on("stories-updated", ({ stories: updatedStories, currentStoryIndex: updatedIndex }) => {
      console.log("Stories updated:", updatedStories);
      setStories(updatedStories || []);
      setCurrentStoryIndex(updatedIndex || 0);
    });

    socket.on("users", (data) => {
      if (observingTarget && !Object.keys(data).includes(observingTarget)) {
        setObservingTarget(null);
      }
      setUsers(data);
    });

    socket.on("userIcons", (data) => {
      setUserIcons(data || {});
    });

    socket.on("currentAdmin", (data) => {
      setAdminName(data.adminName);
      if (roomId && data.adminName) {
        localStorage.setItem(`simpleAdmin_${roomId}`, data.adminName);
      }
    });

    socket.on("roomInfo", (data) => {
      if (data?.roomName) setRoomName(data.roomName);
      if (data?.estimationScale?.cards) {
        setCards(data.estimationScale.cards);
        const scaleTypeFromServer = data.estimationScale.type;
        if (scaleTypeFromServer && ESTIMATION_SCALES[scaleTypeFromServer]) {
          setScaleType(scaleTypeFromServer);
        }
      }
      if (data?.stories) {
        // Only update stories from server if we don't have local data or if it's initial load
        if (isInitialMount.current || stories.length === 0) {
          setStories(data.stories);
          setCurrentStoryIndex(data.currentStoryIndex || 0);
          isInitialMount.current = false;
        }
      }
    });

    socket.on("observersUpdate", (observerData) => {
      setObservers(observerData);
      const currentUserId = Object.keys(users).find(uid => users[uid] === name);
      if (currentUserId && observerData[currentUserId]) {
        setSelectedCard(null);
        socket.emit("vote", { roomId, point: null });
      }
    });

    socket.on("reveal", (data) => {
      console.log("Reveal event received:", data);
      setResults(data);
      setRevealed(true);
    });

    socket.on("final", (data) => {
      if (typeof data === "object") {
        setFinalPoint(data.point);
      } else {
        setFinalPoint(data);
      }
    });

    socket.on("reset", () => {
      console.log("Reset event received");
      setRevealed(false);
      setResults(null);
      setFinalPoint(null);
      setVotedUsers([]);
      setSelectedCard(null);
      setObservingTarget(null);
    });

    socket.on("admin", (data) => {
      const adminValue = typeof data === 'object' ? data.adminName : data;
      setAdminName(adminValue);
      if (roomId && adminValue) {
        localStorage.setItem(`simpleAdmin_${roomId}`, adminValue);
      }
    });

    socket.on("voteUpdate", (data) => {
      if (data?.votes) {
        setVotedUsers(Object.keys(data.votes));
        setUserVotes(data.votes);
        // Only update results if we're already in revealed state
        // This prevents overwriting persisted results on reconnect
        if (revealed) {
          setResults(data);
        }
      }
    });

    return () => {
      socket.off("stories-updated");
      socket.off("users");
      socket.off("userIcons");
      socket.off("currentAdmin");
      socket.off("roomInfo");
      socket.off("observersUpdate");
      socket.off("reveal");
      socket.off("final");
      socket.off("reset");
      socket.off("admin");
      socket.off("voteUpdate");
    };
  }, [name, roomId, revealed, observingTarget, users]);

  // Broadcast stories to server when they change (admin only)
  const broadcastStories = (updatedStories, updatedIndex) => {
    if (isAdmin && roomId) {
      socket.emit("update-stories", {
        roomId,
        stories: updatedStories,
        currentStoryIndex: updatedIndex
      });
    }
  };

  // Story management functions with broadcast
  const handleAddStory = () => {
    if (newStoryTitle.trim()) {
      const newStory = {
        id: Date.now().toString(),
        title: newStoryTitle.trim(),
        description: newStoryDescription.trim(),
        point: null
      };
      const updatedStories = [...stories, newStory];
      const newIndex = stories.length === 0 ? 0 : currentStoryIndex;
      setStories(updatedStories);
      setNewStoryTitle("");
      setNewStoryDescription("");
      setShowStoryInput(false);

      if (stories.length === 0) {
        setCurrentStoryIndex(0);
      }

      broadcastStories(updatedStories, newIndex);
    }
  };

  const handleSelectStory = (index) => {
    if (revealed) {
      setRevealed(false);
      setResults(null);
      setFinalPoint(null);
      setSelectedCard(null);
      setVotedUsers([]);
      socket.emit("reset", { roomId });
    }
    setCurrentStoryIndex(index);
    broadcastStories(stories, index);
  };

  const handleUpdateStoryPoint = (index, point) => {
    const updatedStories = [...stories];
    updatedStories[index].point = point;
    setStories(updatedStories);
    broadcastStories(updatedStories, currentStoryIndex);
  };

  const handleDeleteStory = (index) => {
    const updatedStories = stories.filter((_, i) => i !== index);
    let newIndex = currentStoryIndex;

    if (index === currentStoryIndex) {
      newIndex = Math.max(0, index - 1);
    } else if (index < currentStoryIndex) {
      newIndex = currentStoryIndex - 1;
    }

    setStories(updatedStories);
    setCurrentStoryIndex(newIndex);
    broadcastStories(updatedStories, newIndex);
  };

  const handleEditStory = (index) => {
    setEditStoryIndex(index);
    setEditTitle(stories[index].title);
    setEditDescription(stories[index].description || "");
    setEditingStory(true);
  };

  const handleSaveEditStory = () => {
    if (editTitle.trim() && editStoryIndex !== null) {
      const updatedStories = [...stories];
      updatedStories[editStoryIndex] = {
        ...updatedStories[editStoryIndex],
        title: editTitle.trim(),
        description: editDescription.trim()
      };
      setStories(updatedStories);
      broadcastStories(updatedStories, currentStoryIndex);
      setEditingStory(false);
      setEditStoryIndex(null);
      setEditTitle("");
      setEditDescription("");
    }
  };

  const handleCancelEdit = () => {
    setEditingStory(false);
    setEditStoryIndex(null);
    setEditTitle("");
    setEditDescription("");
  };

  // Drag and drop handlers with broadcast
  const handleDragStart = (e, index) => {
    if (!isAdmin) return;
    setDraggedItem(index);
    e.dataTransfer.setData('application/json', JSON.stringify({ index }));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null) return;
    setDragOverItem(index);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedItem === null || !isAdmin) return;
    if (draggedItem === dropIndex) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const newStories = [...stories];
    const [draggedStory] = newStories.splice(draggedItem, 1);
    newStories.splice(dropIndex, 0, draggedStory);

    let newIndex = currentStoryIndex;
    if (draggedItem === currentStoryIndex) {
      newIndex = dropIndex;
    } else if (draggedItem < currentStoryIndex && dropIndex >= currentStoryIndex) {
      newIndex = currentStoryIndex - 1;
    } else if (draggedItem > currentStoryIndex && dropIndex <= currentStoryIndex) {
      newIndex = currentStoryIndex + 1;
    }

    setStories(newStories);
    setCurrentStoryIndex(newIndex);
    broadcastStories(newStories, newIndex);

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleVote = (value) => {
    if (isCurrentUserObserver) {
      alert("You are in observer mode and cannot vote");
      return;
    }

    if (!currentUserId) return;

    if (selectedCard === value) {
      setSelectedCard(null);
      setVotedUsers(prev => prev.filter(uid => uid !== currentUserId));
      socket.emit("vote", { roomId, point: null });
    } else {
      setSelectedCard(value);
      if (!votedUsers.includes(currentUserId)) {
        setVotedUsers(prev => [...prev, currentUserId]);
      }
      socket.emit("vote", { roomId, point: value });
    }
  };

  const toggleObserver = (userId) => {
    if (!isAdmin) return;
    const newObserverState = !observers[userId];
    setObservers(prev => ({ ...prev, [userId]: newObserverState }));
    if (userId === currentUserId && newObserverState) {
      setSelectedCard(null);
      socket.emit("vote", { roomId, point: null });
    }
    socket.emit("toggleObserver", { roomId, userId });
  };

  const observeUser = (userId) => {
    if (!isCurrentUserObserver) return;
    setObservingTarget(observingTarget === userId ? null : userId);
  };

  const handleReveal = () => socket.emit("reveal", { roomId });

  const handleReset = () => {
    setRevealed(false);
    setResults(null);
    setFinalPoint(null);
    setSelectedCard(null);
    setVotedUsers([]);
    socket.emit("reset", { roomId });
  };

  const handleFinalize = () => {
    socket.emit("finalize", { roomId, data: { point: customPoint, jiraKey: null } });
    setFinalPoint(customPoint);
    if (currentStory) {
      handleUpdateStoryPoint(currentStoryIndex, customPoint);
    }
  };

  const copyRoomIdToClipboard = () => {
    navigator.clipboard.writeText(roomId);
    setRoomIdCopied(true);
    setTimeout(() => setRoomIdCopied(false), 2000);
  };

  const handleLeaveRoom = () => {
    // Notify server immediately so other participants' counts update right away
    socket.emit('leave-room', { roomId });
    localStorage.removeItem("pokerUserName");
    if (roomId) {
      localStorage.removeItem(`simpleAdmin_${roomId}`);
      localStorage.removeItem(`simpleStoryData_${roomId}`);
    }
    if (onLeaveRoom) onLeaveRoom();
    window.location.href = '/';
  };

  const allVotesSame = results && Object.values(results.votes).length > 1 &&
    Object.values(results.votes).every(v => v === Object.values(results.votes)[0]);
  const observedVote = observingTarget && userVotes ? userVotes[observingTarget] : null;
  const stats = results && revealed ? calculateStats(results.votes) : null;

  return (
    <div className={`poker-room ${stories.length > 0 ? 'with-sidebar' : ''}`}>
      {/* Story Queue Sidebar - Show to everyone */}
      {stories.length > 0 && (
        <div className="story-queue-sidebar">
          <div className="story-queue-header">
            <h3>
              <FaList /> Story Queue
              <span className="story-count-badge">{stories.length}</span>
            </h3>
            {isAdmin && (
              <button className="add-story-btn-small" onClick={() => setShowStoryInput(true)} title="Add Story">
                <FaPlus />
              </button>
            )}
          </div>

          <div className="story-queue-content">
            {stories.map((story, index) => {
              const isCurrent = index === currentStoryIndex;
              const isDragged = draggedItem === index;
              const isDragOver = dragOverItem === index;

              return (
                <div
                  key={story.id}
                  className={`story-queue-card ${isCurrent ? 'current' : ''} ${isDragged ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                  draggable={isAdmin}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  onClick={() => handleSelectStory(index)}
                >
                  <div className="story-number">
                    <span>Story {index + 1}</span>
                    {isCurrent && <span className="current-indicator" title="Current Story">▶</span>}
                  </div>
                  <div className="story-summary">{story.title}</div>
                  <div className="story-metadata">
                    {story.point && (
                      <span className="story-point-badge">
                        <FaStar /> {story.point}
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <>
                      <button
                        className="edit-story-btn-small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditStory(index);
                        }}
                        title="Edit Story"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="remove-story-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteStory(index);
                        }}
                        title="Remove Story"
                      >
                        <FaTimes />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {isAdmin && stories.length > 0 && (
            <div className="story-queue-footer">
              <small>Drag to reorder • Click to load</small>
            </div>
          )}
        </div>
      )}

      <div className="poker-container">
        {/* Header */}
        <div className="room-header">
          <div className="room-title-container">
            <h1 className="room-title">
              {roomName ? `${roomName} - ` : ''}
              <span className="room-id-wrapper">
                Room: {roomId}
                <button className="copy-room-id-btn" onClick={copyRoomIdToClipboard}>
                  {roomIdCopied ? <FaCopy className="copy-icon copied" /> : <FaRegCopy className="copy-icon" />}
                </button>
              </span>
            </h1>
            {roomName && <span className="room-name-badge">{roomName}</span>}
          </div>
          <div className="header-actions">
            <div className="simple-mode-badge" title="Simple Planning Poker Mode - No Jira Integration">
              📝 Simple Mode
            </div>
            {isCurrentUserObserver && (
              <div className="observer-badge">
                <FaUserSecret className="observer-badge-icon" />
                <span>Observer Mode</span>
              </div>
            )}
            <button className="leave-room-btn" onClick={handleLeaveRoom}>🚪 Leave</button>
          </div>
        </div>

        {isReconnecting && (
          <div className="reconnecting-message">
            <div className="spinner"></div>
            <p>Reconnecting to room...</p>
          </div>
        )}

        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Loading your session...</p>
          </div>
        )}

        {observingTarget && (
          <div className="observing-indicator">
            <FaEye className="observing-icon" />
            <span>
              Observing <strong>{users[observingTarget]}</strong>'s view
              {!revealed && observedVote && <span className="observed-vote"> (Voted: {observedVote})</span>}
            </span>
            <button className="stop-observing-btn" onClick={() => setObservingTarget(null)}>
              Stop Observing
            </button>
          </div>
        )}

        {/* Participants Section */}
        <div className="participants-section">
          <div className="section-header">
            <FaUsers className="section-icon" />
            <h3>Participants ({Object.keys(users).length})</h3>
            {isAdmin && <span className="observer-hint">(Click 👁️ to toggle observer mode)</span>}
          </div>
          <div className="participants-grid">
            {Object.entries(users).map(([userId, userName]) => {
              if (!userId || !userName) return null;
              const hasVoted = !revealed && votedUsers.includes(userId);
              const backgroundColor = getAvatarColor(userName);
              const isObserver = observers[userId];
              const isCurrentUser = userName === name;
              const isObserving = observingTarget === userId;

              return (
                <div key={userId} className={`participant-card
                  ${hasVoted ? 'voted' : ''}
                  ${isObserver ? 'observer' : ''}
                  ${isObserving ? 'observing' : ''}
                  ${isCurrentUser ? 'current-user' : ''}
                `}>
                  <div
                    className={`participant-avatar${userIcons[userId] ? ' has-icon' : ''}${isImageUrl(userIcons[userId]) ? ' has-img' : ''}`}
                    style={userIcons[userId] ? {} : { backgroundColor }}
                  >
                    {isImageUrl(userIcons[userId])
                      ? <img src={userIcons[userId]} alt={userName} className="avatar-img-display" />
                      : (userIcons[userId] || getInitials(userName))}
                    {isObserver && <FaUserSecret className="observer-icon" />}
                  </div>
                  <span className="participant-name">{userName}</span>
                  {userName === adminName && <span className="admin-crown" title="Room Admin">👑</span>}

                  {isAdmin && (
                    <button className={`observer-toggle-btn ${isObserver ? 'active' : ''}`}
                      onClick={() => toggleObserver(userId)}>
                      <FaEye />
                    </button>
                  )}

                  {isCurrentUserObserver && !isCurrentUser && (
                    <button className={`observe-btn ${isObserving ? 'active' : ''}`}
                      onClick={() => observeUser(userId)}>
                      <FaEye />
                    </button>
                  )}

                  {hasVoted && !isObserver && <FaCheck className="vote-check" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Story Card - Show to everyone when a story exists */}
        {currentStory && (
          <div className="story-card">
            <div className="story-card-header">
              <span className="story-type">Story {currentStoryIndex + 1}</span>
              {stories.length > 1 && (
                <div className="story-progress-container">
                  <button
                    className="progress-nav-btn"
                    onClick={() => {
                      if (currentStoryIndex > 0) {
                        handleSelectStory(currentStoryIndex - 1);
                      }
                    }}
                    disabled={currentStoryIndex === 0}
                    title="Previous Story"
                  >
                    <FaArrowLeft />
                  </button>
                  <span className="story-progress">
                    {currentStoryIndex + 1} / {stories.length}
                  </span>
                  <button
                    className="progress-nav-btn"
                    onClick={() => {
                      if (currentStoryIndex < stories.length - 1) {
                        handleSelectStory(currentStoryIndex + 1);
                      }
                    }}
                    disabled={currentStoryIndex >= stories.length - 1}
                    title="Next Story"
                  >
                    <FaArrowRight />
                  </button>
                </div>
              )}
            </div>
            <h2 className="story-title">{currentStory.title}</h2>
            {currentStory.description && (
              <div className="story-description">
                <p>{currentStory.description}</p>
              </div>
            )}
          </div>
        )}

        {/* Add Story Modal - Admin only */}
        {showStoryInput && (
          <div className="story-modal-overlay" onClick={() => setShowStoryInput(false)}>
            <div className="story-modal" onClick={e => e.stopPropagation()}>
              <h3>Add New Story</h3>
              <div className="form-group">
                <label>Story Title *</label>
                <input
                  type="text"
                  value={newStoryTitle}
                  onChange={(e) => setNewStoryTitle(e.target.value)}
                  placeholder="Enter story title"
                  autoFocus
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  value={newStoryDescription}
                  onChange={(e) => setNewStoryDescription(e.target.value)}
                  placeholder="Enter story description"
                  rows={4}
                  className="form-input"
                />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowStoryInput(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleAddStory} disabled={!newStoryTitle.trim()}>
                  Add Story
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Story Modal - Admin only */}
        {editingStory && (
          <div className="story-modal-overlay" onClick={handleCancelEdit}>
            <div className="story-modal" onClick={e => e.stopPropagation()}>
              <h3>Edit Story</h3>
              <div className="form-group">
                <label>Story Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter story title"
                  autoFocus
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Enter story description"
                  rows={4}
                  className="form-input"
                />
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={handleCancelEdit}>Cancel</button>
                <button className="btn-primary" onClick={handleSaveEditStory} disabled={!editTitle.trim()}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Initial Story Input - Admin only, no stories yet */}
        {!isLoading && !isCurrentUserObserver && isAdmin && stories.length === 0 && !showStoryInput && (
          <div className="simple-story-input">
            <h4>Create Your First Story</h4>
            <input
              type="text"
              placeholder="Story Title"
              value={newStoryTitle}
              onChange={(e) => setNewStoryTitle(e.target.value)}
              className="form-input"
            />
            <textarea
              rows={3}
              placeholder="Story Description (optional)"
              value={newStoryDescription}
              onChange={(e) => setNewStoryDescription(e.target.value)}
              className="form-input"
              style={{ marginTop: '10px' }}
            />
            <button
              className="btn-primary"
              onClick={handleAddStory}
              disabled={!newStoryTitle.trim()}
              style={{ marginTop: '16px' }}
            >
              Add Story & Start Planning
            </button>
          </div>
        )}

        {/* Waiting for Story Message - Show to non-admins when no story exists */}
        {/* adminName guard prevents flashing "waiting" before admin status is confirmed */}
        {!isLoading && adminName && !isAdmin && stories.length === 0 && (
          <div className="waiting-for-story">
            <div className="waiting-icon">📝</div>
            <h3>Waiting for the admin to create a story</h3>
            <p>The room admin will add stories for planning soon. Please wait...</p>
          </div>
        )}

        {/* Card Selection Area - Show to everyone when a story exists and not revealed */}
        {!revealed && currentStory && (
          <div className="voting-section">
            <h3>Select your estimate</h3>
            <div className="scale-info">
              <span className="scale-badge">
                {ESTIMATION_SCALES[scaleType]?.name || ESTIMATION_SCALES.FIBONACCI.name}
              </span>
            </div>

            {!isCurrentUserObserver && (
              <div className="cards-grid">
                {cards.map(c => (
                  <Card key={c} value={c} onClick={handleVote} selected={selectedCard === c} />
                ))}
              </div>
            )}

            {isCurrentUserObserver && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                <p>You are in observer mode and cannot vote</p>
              </div>
            )}

            {isAdmin && (
              <button className="btn-reveal" onClick={handleReveal}>
                <FaEye /> Reveal Votes
              </button>
            )}
          </div>
        )}

        {/* Observer View */}
        {isCurrentUserObserver && observingTarget && !revealed && (
          <div className="observer-view">
            <div className="observer-view-header">
              <h3>Viewing {users[observingTarget]}'s screen</h3>
              {observedVote ? (
                <div className="observed-card"><span>Selected card: </span><strong>{observedVote}</strong></div>
              ) : (
                <p className="no-vote-message">Has not voted yet</p>
              )}
            </div>
          </div>
        )}

        {/* Observer placeholder */}
        {isCurrentUserObserver && !observingTarget && !revealed && currentStory && (
          <div className="observer-placeholder">
            <FaUserSecret className="placeholder-icon" />
            <h3>You are in Observer Mode</h3>
            <p>Click the <FaEye /> icon on any participant to view their screen</p>
          </div>
        )}

        {/* Results Section */}
        {revealed && results && (
          <div className="results-section">
            <h3>Voting Results</h3>

            {stats && (
              <div className="stats-wrapper">
                <div className="stats-header">
                  <span className="stats-title">📊 Vote Analysis</span>
                  {allVotesSame && <span className="consensus-badge"><span className="consensus-icon">🎯</span>Consensus Reached!</span>}
                </div>
                <div className="stats-grid">
                  <div className="stat-card average">
                    <div className="stat-icon">📈</div>
                    <div className="stat-content"><span className="stat-label">Average</span><span className="stat-value">{stats.avg}</span></div>
                  </div>
                  <div className="stat-card minimum">
                    <div className="stat-icon">⬇️</div>
                    <div className="stat-content"><span className="stat-label">Minimum</span><span className="stat-value">{stats.min}</span></div>
                  </div>
                  <div className="stat-card maximum">
                    <div className="stat-icon">⬆️</div>
                    <div className="stat-content"><span className="stat-label">Maximum</span><span className="stat-value">{stats.max}</span></div>
                  </div>
                  <div className="stat-card count">
                    <div className="stat-icon">👥</div>
                    <div className="stat-content"><span className="stat-label">Total Votes</span><span className="stat-value">{stats.count}</span></div>
                  </div>
                </div>
              </div>
            )}

            {allVotesSame && (
              <div className="celebration">
                <div className="party-poppers"><span>🎉</span><span>🎊</span><span>🎉</span><span>✨</span><span>🎉</span></div>
                <p className="celebration-text"><span className="celebration-emoji">🏆</span>Perfect Agreement!<span className="celebration-emoji">🏆</span></p>
              </div>
            )}

            <div className="votes-grid">
              {Object.entries(results.votes).map(([id, vote]) => (
                <div key={id} className={`vote-item ${observingTarget === id ? 'observed-vote-item' : ''}`}>
                  <div className="voter-info">
                    <div
                      className={`voter-avatar${userIcons[id] ? ' has-icon' : ''}${isImageUrl(userIcons[id]) ? ' has-img' : ''}`}
                      style={userIcons[id] ? {} : { backgroundColor: getAvatarColor(results.users[id]) }}
                    >
                      {isImageUrl(userIcons[id])
                        ? <img src={userIcons[id]} alt={results.users[id]} className="avatar-img-display" />
                        : (userIcons[id] || getInitials(results.users[id]))}
                      {observers[id] && <FaUserSecret className="voter-observer-icon" />}
                    </div>
                    <span className="voter-name">{results.users[id]}</span>
                  </div>
                  <span className="vote-value">{vote}</span>
                </div>
              ))}
            </div>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="admin-controls">
                <button className="btn-reset" onClick={handleReset}><FaUndo /> Reset Voting</button>
                <div className="finalize-controls">
                  <div className="point-input-group">
                    <input
                      type={typeof cards[0] === 'number' ? 'number' : 'text'}
                      value={customPoint}
                      onChange={e => setCustomPoint(typeof cards[0] === 'number' ? Number(e.target.value) : e.target.value)}
                      className="point-input"
                      placeholder="Final value"
                    />
                    <button className="btn-finalize" onClick={handleFinalize}>
                      <FaStar /> Finalize {customPoint}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Final Point Display */}
        {finalPoint && currentStory && (
          <div className="final-point-card">
            <div className="final-point-content">
              <span className="final-point-label">Final Story Point</span>
              <span className="final-point-value">{finalPoint}</span>
            </div>
            {currentStory.title && <p className="final-story-title">{currentStory.title}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
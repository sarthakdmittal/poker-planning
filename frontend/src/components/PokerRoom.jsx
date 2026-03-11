import { useEffect, useState, useRef } from "react";
import { socket } from "../socket";
import Card from "./Card.jsx";
import {
  FaCheck, FaUsers, FaEye, FaEyeSlash, FaArrowLeft, FaArrowRight,
  FaUndo, FaStar, FaPencilAlt, FaCopy, FaRegCopy, FaUserSecret,
  FaBold, FaItalic, FaUnderline, FaListUl, FaListOl, FaHeading,
  FaMarkdown, FaCode
} from "react-icons/fa";
import '../../jira-content.css';
import './PokerRoom.css';

const cards = [0, 1, 2, 3, 5, 8, 13, 21];

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

// Helper functions for cursor position
const saveCursorPosition = (el) => {
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(el);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    return {
      start,
      end: start + range.toString().length
    };
  }
  return null;
};

const restoreCursorPosition = (el, savedPosition) => {
  if (!savedPosition) return;

  const selection = window.getSelection();
  const range = document.createRange();

  let charIndex = 0;
  const nodeStack = [el];
  let node, foundStart = false, stop = false;

  while (!stop && (node = nodeStack.pop())) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nextCharIndex = charIndex + node.length;
      if (!foundStart && savedPosition.start >= charIndex && savedPosition.start <= nextCharIndex) {
        range.setStart(node, savedPosition.start - charIndex);
        foundStart = true;
      }
      if (foundStart && savedPosition.end >= charIndex && savedPosition.end <= nextCharIndex) {
        range.setEnd(node, savedPosition.end - charIndex);
        stop = true;
      }
      charIndex = nextCharIndex;
    } else {
      const childNodes = node.childNodes;
      for (let i = childNodes.length - 1; i >= 0; i--) {
        nodeStack.push(childNodes[i]);
      }
    }
  }

  selection.removeAllRanges();
  selection.addRange(range);
};

// Jira wiki markup to HTML parser
function jiraWikiToHtml(text) {
  if (!text) return "";

  // First, normalize line endings and trim
  const lines = text.split(/\r?\n/);
  let html = "";
  let listStack = [];
  let inCodeBlock = false;

  function applyInlineFormatting(str) {
    if (!str) return "";

    // Handle {*}bold{*} syntax (this is the one causing your issue)
    str = str.replace(/\{\*\}(.*?)\{\*\}/g, "<strong>$1</strong>");

    // Handle *bold* syntax
    str = str.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");

    // Handle +bold+ syntax
    str = str.replace(/\+(.*?)\+/g, "<strong>$1</strong>");

    // Handle italic
    str = str.replace(/_([^_]+)_/g, "<em>$1</em>");

    // Handle code
    str = str.replace(/\{\{(.*?)\}\}/g, "<code>$1</code>");
    str = str.replace(/\{\}(.*?)\{\}/g, "<code>$1</code>");

    // Handle color
    str = str.replace(
      /\{color:([#\w]+)\}(.*?)\{color\}/g,
      '<span style="color:$1">$2</span>'
    );

    // Handle links
    str = str.replace(
      /\[([^\|]+)\|([^\]]+)\]/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    return str;
  }

  for (let line of lines) {
    line = line.trim();

    // Handle code blocks
    if (line.startsWith("{code}")) {
      inCodeBlock = true;
      html += '<pre class="jira-code"><code>';
      continue;
    }
    if (line.startsWith("{code}") && inCodeBlock) {
      inCodeBlock = false;
      html += '</code></pre>';
      continue;
    }
    if (inCodeBlock) {
      html += line + '\n';
      continue;
    }

    // Handle headings
    const headingMatch = line.match(/^h([1-6])\.\s+(.*)/);
    if (headingMatch) {
      while (listStack.length) {
        html += `</${listStack.pop()}>`;
      }
      const level = headingMatch[1];
      const content = applyInlineFormatting(headingMatch[2]);
      html += `<h${level} class="jira-heading">${content}</h${level}>`;
      continue;
    }

    // Handle bullet lists
    const bulletMatch = line.match(/^(\*+)\s+(.*)/);
    if (bulletMatch) {
      const level = bulletMatch[1].length;
      const content = applyInlineFormatting(bulletMatch[2]);

      while (listStack.length < level) {
        html += '<ul class="jira-list">';
        listStack.push('ul');
      }
      while (listStack.length > level) {
        html += `</${listStack.pop()}>`;
      }

      html += `<li>${content}</li>`;
      continue;
    }

    // Handle numbered lists
    const numMatch = line.match(/^(#+)\s+(.*)/);
    if (numMatch) {
      const level = numMatch[1].length;
      const content = applyInlineFormatting(numMatch[2]);

      while (listStack.length < level) {
        html += '<ol class="jira-list">';
        listStack.push('ol');
      }
      while (listStack.length > level) {
        html += `</${listStack.pop()}>`;
      }

      html += `<li>${content}</li>`;
      continue;
    }

    // Close any open lists for non-list items
    while (listStack.length) {
      html += `</${listStack.pop()}>`;
    }

    // Handle empty lines as paragraph breaks
    if (line === '') {
      html += '<br/>';
      continue;
    }

    // Regular paragraph
    html += `<p>${applyInlineFormatting(line)}</p>`;
  }

  // Close any remaining lists
  while (listStack.length) {
    html += `</${listStack.pop()}>`;
  }

  return html;
}

// HTML to Jira wiki markup converter
function htmlToJiraWiki(html) {
  if (!html) return "";

  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Function to process nodes recursively
  function processNode(node, indent = 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      const children = Array.from(node.childNodes).map(child => processNode(child, indent + 1)).join('');

      switch (tagName) {
        case 'strong':
        case 'b':
          return `*${children}*`;
        case 'em':
        case 'i':
          return `_${children}_`;
        case 'u':
          return `+${children}+`;
        case 'code':
          return `{{${children}}}`;
        case 'a':
          const href = node.getAttribute('href') || '';
          return `[${children}|${href}]`;
        case 'h1':
          return `h1. ${children}\n`;
        case 'h2':
          return `h2. ${children}\n`;
        case 'h3':
          return `h3. ${children}\n`;
        case 'h4':
          return `h4. ${children}\n`;
        case 'h5':
          return `h5. ${children}\n`;
        case 'h6':
          return `h6. ${children}\n`;
        case 'p':
          return `${children}\n`;
        case 'div':
          return `${children}\n`;
        case 'ul':
          return children;
        case 'ol':
          return children;
        case 'li': {
          const parent = node.parentNode;
          if (parent && parent.tagName.toLowerCase() === 'ul') {
            return `${'*'.repeat(indent)} ${children}\n`;
          } else if (parent && parent.tagName.toLowerCase() === 'ol') {
            return `${'#'.repeat(indent)} ${children}\n`;
          }
          return `* ${children}\n`;
        }
        case 'br':
          return '\n';
        case 'span': {
          const style = node.getAttribute('style') || '';
          const colorMatch = style.match(/color:\s*(#[0-9a-fA-F]{6})/);
          if (colorMatch) {
            return `{color:${colorMatch[1]}}${children}{color}`;
          }
          return children;
        }
        case 'pre':
          return `{code}${children}{code}\n`;
        default:
          return children;
      }
    }
    return '';
  }

  return processNode(tempDiv)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\*{3,}/g, '**')
    .replace(/_\s+_/g, '')
    .trim();
}

// Calculate statistics from votes
const calculateStats = (votes) => {
  const values = Object.values(votes).filter(v => v !== null && v !== undefined);
  if (values.length === 0) return null;

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  return {
    avg: avg.toFixed(1),
    min,
    max,
    count: values.length
  };
};

export default function PokerRoom({ name }) {
  const [users, setUsers] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState(null);
  const [finalPoint, setFinalPoint] = useState(null);
  const [adminName, setAdminName] = useState(null);
  const [customPoint, setCustomPoint] = useState(8);
  const [jiraKey, setJiraKey] = useState("");
  const [issueTitle, setIssueTitle] = useState(null);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(null);
  const [description, setDescription] = useState(null);
  const [showAcceptance, setShowAcceptance] = useState(false);
  const [editingAcceptance, setEditingAcceptance] = useState(false);
  const [editAcceptanceValue, setEditAcceptanceValue] = useState("");
  const [editingAcceptanceVisual, setEditingAcceptanceVisual] = useState(false);
  const [editAcceptanceVisualValue, setEditAcceptanceVisualValue] = useState("");
  const [showVisual, setShowVisual] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [storyList, setStoryList] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [storyListInput, setStoryListInput] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescriptionValue, setEditDescriptionValue] = useState("");
  const [editingDescriptionVisual, setEditingDescriptionVisual] = useState(false);
  const [editDescriptionVisualValue, setEditDescriptionVisualValue] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [votedUsers, setVotedUsers] = useState([]);
  const [issueType, setIssueType] = useState(null);
  const [copied, setCopied] = useState(false);

  // Refs for visual editors
  const acceptanceEditorRef = useRef(null);
  const descriptionEditorRef = useRef(null);

  // Observer mode states
  const [observers, setObservers] = useState({});
  const [observingTarget, setObservingTarget] = useState(null);
  const [userVotes, setUserVotes] = useState({});

  // Request initial observers when component mounts
  useEffect(() => {
    socket.emit("requestObservers");

    const interval = setInterval(() => {
      socket.emit("requestObservers");
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    console.log("Setting up socket listeners for:", name);

    socket.on("users", (data) => {
      console.log("Users updated:", data);
      setUsers(data);
    });

    socket.on("reveal", (data) => {
      console.log("Reveal received:", data);
      setResults(data);
      setRevealed(true);
    });

    socket.on("final", (data) => {
      console.log("Final received:", data);
      if (typeof data === "object" && data !== null) {
        setFinalPoint(data.point);
        setIssueTitle(data.issueTitle);
        setAcceptanceCriteria(data.acceptanceCriteria);
      } else {
        setFinalPoint(data);
        setIssueTitle(null);
        setAcceptanceCriteria(null);
      }
    });

    socket.on("jiraDetails", (details) => {
      console.log("Received jiraDetails:", details);
      setIssueTitle(details.summary);
      setAcceptanceCriteria(details.acceptanceCriteria);
      setDescription(details.description);
      setIssueType(details.issueType);
      setEditingAcceptance(false);
      setEditingAcceptanceVisual(false);
      setEditingDescription(false);
      setEditingDescriptionVisual(false);
    });

    socket.on("reset", () => {
      console.log("Reset received");
      setRevealed(false);
      setResults(null);
      setFinalPoint(null);
      setVotedUsers([]);
      setSelectedCard(null);
      setObservers({});
      setObservingTarget(null);
    });

    socket.on("admin", (data) => {
      console.log("Admin set:", data);
      setAdminName(data);
    });

    socket.on("voteUpdate", (data) => {
      console.log("Vote update received:", data);
      if (data && data.votes) {
        setVotedUsers(Object.keys(data.votes));
        setUserVotes(data.votes);
      }
      setResults(data);
    });

    socket.on("observersUpdate", (observerData) => {
      console.log("Received observers update:", observerData);
      setObservers(observerData);

      const currentUserId = Object.keys(users).find(uid => users[uid] === name);
      if (currentUserId && observerData[currentUserId]) {
        console.log("Current user is now an observer, clearing vote");
        setSelectedCard(null);
        socket.emit("vote", null);
      }
    });

    return () => {
      console.log("Cleaning up socket listeners");
      socket.off("users");
      socket.off("reveal");
      socket.off("final");
      socket.off("jiraDetails");
      socket.off("reset");
      socket.off("admin");
      socket.off("voteUpdate");
      socket.off("observersUpdate");
    };
  }, [name, users]);

  const isAdmin = name && adminName && name === adminName;
  const isSarthak = name === "Sarthak";

  // Get current user's ID
  const currentUserId = Object.keys(users).find(uid => users[uid] === name);
  const isCurrentUserObserver = currentUserId ? observers[currentUserId] : false;

  useEffect(() => {
    if (storyList.length > 0 && currentStoryIndex < storyList.length) {
      setJiraKey(storyList[currentStoryIndex]);
    }
  }, [storyList, currentStoryIndex]);

  useEffect(() => {
    if (jiraKey) {
      socket.emit("fetchJiraDetails", jiraKey);
    }
  }, [jiraKey]);

  useEffect(() => {
    setSelectedCard(null);
    setObservingTarget(null);
  }, [revealed, jiraKey]);

  // Initialize visual editor content when entering edit mode
  useEffect(() => {
    if (editingAcceptanceVisual && acceptanceCriteria) {
      setEditAcceptanceVisualValue(jiraWikiToHtml(acceptanceCriteria));
    }
  }, [editingAcceptanceVisual, acceptanceCriteria]);

  useEffect(() => {
    if (editingDescriptionVisual && description) {
      setEditDescriptionVisualValue(jiraWikiToHtml(description));
    }
  }, [editingDescriptionVisual, description]);

  const handleVote = (value) => {
    if (isCurrentUserObserver) {
      alert("You are in observer mode and cannot vote");
      return;
    }

    if (!currentUserId) {
      console.log("No current user ID found");
      return;
    }

    if (selectedCard === value) {
      setSelectedCard(null);
      setVotedUsers(prev => prev.filter(uid => uid !== currentUserId));
      socket.emit("vote", null);
    } else {
      setSelectedCard(value);
      if (!votedUsers.includes(currentUserId)) {
        setVotedUsers(prev => [...prev, currentUserId]);
      }
      socket.emit("vote", value);
    }
  };

  const toggleObserver = (userId) => {
    if (!isSarthak) return;

    const newObserverState = !observers[userId];

    setObservers(prev => ({
      ...prev,
      [userId]: newObserverState
    }));

    if (userId === currentUserId && newObserverState) {
      setSelectedCard(null);
      socket.emit("vote", null);
    }

    socket.emit("toggleObserver", userId);
  };

  const observeUser = (userId) => {
    if (!isCurrentUserObserver) return;

    if (observingTarget === userId) {
      setObservingTarget(null);
    } else {
      setObservingTarget(userId);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Apply formatting in visual editor
  const applyFormatting = (command, value = null, type = 'acceptance') => {
    document.execCommand(command, false, value);

    // Update the state with the new content
    if (type === 'acceptance' && acceptanceEditorRef.current) {
      setEditAcceptanceVisualValue(acceptanceEditorRef.current.innerHTML);
    } else if (type === 'description' && descriptionEditorRef.current) {
      setEditDescriptionVisualValue(descriptionEditorRef.current.innerHTML);
    }
  };

  // Insert Jira-specific formatting
  const insertJiraFormatting = (format, type = 'acceptance') => {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    let formattedText = '';
    switch(format) {
      case 'bold':
        formattedText = `*${selectedText}*`;
        break;
      case 'italic':
        formattedText = `_${selectedText}_`;
        break;
      case 'underline':
        formattedText = `+${selectedText}+`;
        break;
      case 'code':
        formattedText = `{{${selectedText}}}`;
        break;
      case 'heading':
        formattedText = `h3. ${selectedText}`;
        break;
      default:
        return;
    }

    document.execCommand('insertText', false, formattedText);

    if (type === 'acceptance' && acceptanceEditorRef.current) {
      setEditAcceptanceVisualValue(acceptanceEditorRef.current.innerHTML);
    } else if (type === 'description' && descriptionEditorRef.current) {
      setEditDescriptionVisualValue(descriptionEditorRef.current.innerHTML);
    }
  };

  const allVotesSame = results &&
    Object.values(results.votes).length > 1 &&
    Object.values(results.votes).every(v => v === Object.values(results.votes)[0]);

  const observedVote = observingTarget && userVotes ? userVotes[observingTarget] : null;

  // Calculate stats when results are revealed
  const stats = results && revealed ? calculateStats(results.votes) : null;

  return (
    <div className="poker-room">
      <div className="poker-container">
        {/* Header */}
        <div className="room-header">
          <h1 className="room-title">Planning Poker</h1>
          {isCurrentUserObserver && (
            <div className="observer-badge">
              <FaUserSecret className="observer-badge-icon" />
              <span>Observer Mode</span>
            </div>
          )}
          {jiraKey && (
            <div className="story-badge" onClick={() => copyToClipboard(jiraKey)} title="Click to copy">
              <span className="story-key">{jiraKey}</span>
              {copied ? <FaCopy className="copy-icon copied" /> : <FaRegCopy className="copy-icon" />}
            </div>
          )}
        </div>

        {/* Observing Target Indicator */}
        {observingTarget && (
          <div className="observing-indicator">
            <FaEye className="observing-icon" />
            <span>
              Observing <strong>{users[observingTarget]}</strong>'s view
              {!revealed && observedVote && (
                <span className="observed-vote"> (Voted: {observedVote})</span>
              )}
            </span>
            <button
              className="stop-observing-btn"
              onClick={() => setObservingTarget(null)}
            >
              Stop Observing
            </button>
          </div>
        )}

        {/* Participants Section */}
        <div className="participants-section">
          <div className="section-header">
            <FaUsers className="section-icon" />
            <h3>Participants ({Object.keys(users).length})</h3>
            {isSarthak && (
              <span className="observer-hint">(Click 👁️ to toggle observer mode)</span>
            )}
          </div>
          <div className="participants-grid">
            {Object.entries(users).map(([userId, userName]) => {
              const hasVoted = !revealed && votedUsers.includes(userId);
              const backgroundColor = getAvatarColor(userName);
              const isObserver = observers[userId];
              const isCurrentUser = userName === name;
              const isObserving = observingTarget === userId;

              return (
                <div
                  key={userId}
                  className={`participant-card
                    ${hasVoted ? 'voted' : ''}
                    ${isObserver ? 'observer' : ''}
                    ${isObserving ? 'observing' : ''}
                    ${isCurrentUser ? 'current-user' : ''}
                  `}
                >
                  <div className="participant-avatar" style={{ backgroundColor }}>
                    {getInitials(userName)}
                    {isObserver && <FaUserSecret className="observer-icon" />}
                  </div>
                  <span className="participant-name">{userName}</span>

                  {isSarthak && (
                    <button
                      className={`observer-toggle-btn ${isObserver ? 'active' : ''}`}
                      onClick={() => toggleObserver(userId)}
                      title={isObserver ? "Remove observer rights" : "Make observer"}
                    >
                      <FaEye />
                    </button>
                  )}

                  {isCurrentUserObserver && !isCurrentUser && (
                    <button
                      className={`observe-btn ${isObserving ? 'active' : ''}`}
                      onClick={() => observeUser(userId)}
                      title={`Observe ${userName}'s view`}
                    >
                      <FaEye />
                    </button>
                  )}

                  {hasVoted && !isObserver && <FaCheck className="vote-check" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Story Card */}
        {(issueTitle || acceptanceCriteria || description) && (
          <div className="story-card">
            <div className="story-card-header">
              <span className="story-type">{issueType || 'Story'}</span>
              {storyList.length > 0 && (
                <div className="story-progress-container">
                  <button
                    className="progress-nav-btn"
                    onClick={() => {
                      if (currentStoryIndex > 0) {
                        setCurrentStoryIndex(currentStoryIndex - 1);
                        setRevealed(false);
                        setResults(null);
                        setFinalPoint(null);
                        setIssueTitle(null);
                        setAcceptanceCriteria(null);
                        setDescription(null);
                        setObservingTarget(null);
                        setEditingAcceptance(false);
                        setEditingAcceptanceVisual(false);
                        setEditingDescription(false);
                        setEditingDescriptionVisual(false);
                        socket.emit("reset");
                      }
                    }}
                    disabled={currentStoryIndex === 0}
                    title="Previous Story"
                  >
                    <FaArrowLeft />
                  </button>
                  <span className="story-progress">
                    {currentStoryIndex + 1} / {storyList.length}
                  </span>
                  <button
                    className="progress-nav-btn"
                    onClick={() => {
                      if (currentStoryIndex < storyList.length - 1) {
                        setCurrentStoryIndex(currentStoryIndex + 1);
                        setRevealed(false);
                        setResults(null);
                        setFinalPoint(null);
                        setIssueTitle(null);
                        setAcceptanceCriteria(null);
                        setDescription(null);
                        setObservingTarget(null);
                        setEditingAcceptance(false);
                        setEditingAcceptanceVisual(false);
                        setEditingDescription(false);
                        setEditingDescriptionVisual(false);
                        socket.emit("reset");
                      }
                    }}
                    disabled={currentStoryIndex >= storyList.length - 1}
                    title="Next Story"
                  >
                    <FaArrowRight />
                  </button>
                </div>
              )}
            </div>
            <h2 className="story-title">{issueTitle || 'Loading story...'}</h2>

            <div className="story-actions">
              {acceptanceCriteria && (
                <button
                  className={`story-action-btn ${showAcceptance ? 'active' : ''}`}
                  onClick={() => setShowAcceptance(!showAcceptance)}
                >
                  {showAcceptance ? <FaEyeSlash /> : <FaEye />}
                  Acceptance Criteria
                </button>
              )}
              {description && (
                <button
                  className={`story-action-btn ${showDescription ? 'active' : ''}`}
                  onClick={() => setShowDescription(!showDescription)}
                >
                  {showDescription ? <FaEyeSlash /> : <FaEye />}
                  Description
                </button>
              )}
              {(acceptanceCriteria || description) && (
                <button
                  className="story-action-btn"
                  onClick={() => setShowVisual(!showVisual)}
                >
                  {showVisual ? <FaMarkdown /> : <FaEye />}
                  {showVisual ? 'Raw Text' : 'Formatted View'}
                </button>
              )}
            </div>

            {showAcceptance && acceptanceCriteria && (
              <div className="story-content">
                <div className="content-header">
                  <strong>Acceptance Criteria</strong>
                  {isSarthak && !editingAcceptance && !editingAcceptanceVisual && !isCurrentUserObserver && (
                    <div className="edit-buttons">
                      <button
                        className="edit-btn"
                        onClick={() => {
                          setEditingAcceptance(true);
                          setEditAcceptanceValue(acceptanceCriteria);
                        }}
                        title="Edit in raw text mode"
                      >
                        <FaPencilAlt /> Raw
                      </button>
                      <button
                        className="edit-btn visual-edit-btn"
                        onClick={() => {
                          setEditingAcceptanceVisual(true);
                        }}
                        title="Edit in formatted mode"
                      >
                        <FaEye /> Formatted
                      </button>
                    </div>
                  )}
                </div>

                {!editingAcceptance && !editingAcceptanceVisual ? (
                  showVisual ? (
                    <div
                      className="jira-content formatted-view"
                      dangerouslySetInnerHTML={{ __html: jiraWikiToHtml(acceptanceCriteria) }}
                    />
                  ) : (
                    <pre className="text-content raw-view">{acceptanceCriteria}</pre>
                  )
                ) : editingAcceptance ? (
                  <div className="edit-mode raw-edit-mode">
                    <textarea
                      value={editAcceptanceValue}
                      onChange={e => setEditAcceptanceValue(e.target.value)}
                      rows={12}
                      className="raw-editor"
                      placeholder="Enter Jira wiki markup..."
                    />
                    <div className="edit-actions">
                      <button className="btn-save" onClick={() => {
                        socket.emit("updateAcceptanceCriteria", {
                          jiraKey,
                          acceptanceCriteria: editAcceptanceValue
                        });
                        setEditingAcceptance(false);
                      }}>Save</button>
                      <button className="btn-cancel" onClick={() => setEditingAcceptance(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="edit-mode visual-edit-mode">
                    <div className="visual-edit-toolbar">
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('bold', null, 'acceptance')}
                        title="Bold"
                        type="button"
                      >
                        <FaBold />
                      </button>
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('italic', null, 'acceptance')}
                        title="Italic"
                        type="button"
                      >
                        <FaItalic />
                      </button>
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('underline', null, 'acceptance')}
                        title="Underline"
                        type="button"
                      >
                        <FaUnderline />
                      </button>
                      <div className="toolbar-divider"></div>
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('insertUnorderedList', null, 'acceptance')}
                        title="Bullet List"
                        type="button"
                      >
                        <FaListUl />
                      </button>
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('insertOrderedList', null, 'acceptance')}
                        title="Numbered List"
                        type="button"
                      >
                        <FaListOl />
                      </button>
                      <div className="toolbar-divider"></div>
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('formatBlock', 'h3', 'acceptance')}
                        title="Heading"
                        type="button"
                      >
                        <FaHeading />
                      </button>
                      <button
                        className="toolbar-btn"
                        onClick={() => insertJiraFormatting('code', 'acceptance')}
                        title="Code"
                        type="button"
                      >
                        <FaCode />
                      </button>
                      <span className="toolbar-hint">Editor</span>
                    </div>
                    <div
                      ref={acceptanceEditorRef}
                      className="visual-editor active"
                      contentEditable={true}
                      dangerouslySetInnerHTML={{ __html: editAcceptanceVisualValue }}
                      onInput={(e) => {
                        // Save cursor position
                        const savedPos = saveCursorPosition(e.currentTarget);
                        // Update state
                        setEditAcceptanceVisualValue(e.currentTarget.innerHTML);
                        // Restore cursor position after state update
                        setTimeout(() => {
                          if (acceptanceEditorRef.current && savedPos) {
                            restoreCursorPosition(acceptanceEditorRef.current, savedPos);
                          }
                        }, 0);
                      }}
                      onBlur={(e) => setEditAcceptanceVisualValue(e.currentTarget.innerHTML)}
                      style={{
                        border: '1px solid #ddd',
                        padding: '16px',
                        minHeight: '250px',
                        maxHeight: '500px',
                        overflowY: 'auto',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        outline: 'none',
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.5'
                      }}
                      suppressContentEditableWarning={true}
                    />
                    <div className="edit-actions">
                      <button className="btn-save" onClick={() => {
                        const wikiContent = htmlToJiraWiki(editAcceptanceVisualValue);
                        socket.emit("updateAcceptanceCriteria", {
                          jiraKey,
                          acceptanceCriteria: wikiContent
                        });
                        setEditingAcceptanceVisual(false);
                      }}>Save</button>
                      <button className="btn-cancel" onClick={() => setEditingAcceptanceVisual(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {showDescription && description && (
              <div className="story-content">
                <div className="content-header">
                  <strong>Description</strong>
                  {isSarthak && !editingDescription && !editingDescriptionVisual && !isCurrentUserObserver && (
                    <div className="edit-buttons">
                      <button
                        className="edit-btn"
                        onClick={() => {
                          setEditingDescription(true);
                          setEditDescriptionValue(description);
                        }}
                        title="Edit in raw text mode"
                      >
                        <FaPencilAlt /> Raw
                      </button>
                      <button
                        className="edit-btn visual-edit-btn"
                        onClick={() => {
                          setEditingDescriptionVisual(true);
                        }}
                        title="Edit in formatted mode"
                      >
                        <FaEye /> Formatted
                      </button>
                    </div>
                  )}
                </div>

                {!editingDescription && !editingDescriptionVisual ? (
                  showVisual ? (
                    <div
                      className="jira-content formatted-view"
                      dangerouslySetInnerHTML={{ __html: jiraWikiToHtml(description) }}
                    />
                  ) : (
                    <pre className="text-content raw-view">{description}</pre>
                  )
                ) : editingDescription ? (
                  <div className="edit-mode raw-edit-mode">
                    <textarea
                      value={editDescriptionValue}
                      onChange={e => setEditDescriptionValue(e.target.value)}
                      rows={12}
                      className="raw-editor"
                      placeholder="Enter Jira wiki markup..."
                    />
                    <div className="edit-actions">
                      <button className="btn-save" onClick={() => {
                        socket.emit("updateDescription", {
                          jiraKey,
                          description: editDescriptionValue
                        });
                        setEditingDescription(false);
                      }}>Save</button>
                      <button className="btn-cancel" onClick={() => setEditingDescription(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="edit-mode visual-edit-mode">
                    <div className="visual-edit-toolbar">
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('bold', null, 'description')}
                        title="Bold"
                        type="button"
                      >
                        <FaBold />
                      </button>
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('italic', null, 'description')}
                        title="Italic"
                        type="button"
                      >
                        <FaItalic />
                      </button>
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('underline', null, 'description')}
                        title="Underline"
                        type="button"
                      >
                        <FaUnderline />
                      </button>
                      <div className="toolbar-divider"></div>
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('insertUnorderedList', null, 'description')}
                        title="Bullet List"
                        type="button"
                      >
                        <FaListUl />
                      </button>
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('insertOrderedList', null, 'description')}
                        title="Numbered List"
                        type="button"
                      >
                        <FaListOl />
                      </button>
                      <div className="toolbar-divider"></div>
                      <button
                        className="toolbar-btn"
                        onClick={() => applyFormatting('formatBlock', 'h3', 'description')}
                        title="Heading"
                        type="button"
                      >
                        <FaHeading />
                      </button>
                      <button
                        className="toolbar-btn"
                        onClick={() => insertJiraFormatting('code', 'description')}
                        title="Code"
                        type="button"
                      >
                        <FaCode />
                      </button>
                      <span className="toolbar-hint">Editor</span>
                    </div>
                    <div
                      ref={descriptionEditorRef}
                      className="visual-editor active"
                      contentEditable={true}
                      dangerouslySetInnerHTML={{ __html: editDescriptionVisualValue }}
                      onInput={(e) => {
                        // Save cursor position
                        const savedPos = saveCursorPosition(e.currentTarget);
                        // Update state
                        setEditDescriptionVisualValue(e.currentTarget.innerHTML);
                        // Restore cursor position after state update
                        setTimeout(() => {
                          if (descriptionEditorRef.current && savedPos) {
                            restoreCursorPosition(descriptionEditorRef.current, savedPos);
                          }
                        }, 0);
                      }}
                      onBlur={(e) => setEditDescriptionVisualValue(e.currentTarget.innerHTML)}
                      style={{
                        border: '1px solid #ddd',
                        padding: '16px',
                        minHeight: '250px',
                        maxHeight: '500px',
                        overflowY: 'auto',
                        borderRadius: '4px',
                        backgroundColor: 'white',
                        outline: 'none',
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.5'
                      }}
                      suppressContentEditableWarning={true}
                    />
                    <div className="edit-actions">
                      <button className="btn-save" onClick={() => {
                        const wikiContent = htmlToJiraWiki(editDescriptionVisualValue);
                        socket.emit("updateDescription", {
                          jiraKey,
                          description: wikiContent
                        });
                        setEditingDescriptionVisual(false);
                      }}>Save</button>
                      <button className="btn-cancel" onClick={() => setEditingDescriptionVisual(false)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Story List Input (Sarthak only) */}
        {!isCurrentUserObserver && isSarthak && storyList.length === 0 && (
          <div className="story-list-input">
            <h4>Enter Jira Issues</h4>
            <p className="input-hint">One issue key per line (e.g., PROJ-123)</p>
            <textarea
              rows={4}
              value={storyListInput}
              onChange={e => setStoryListInput(e.target.value)}
              placeholder="PROJ-123&#10;PROJ-124&#10;PROJ-125"
            />
            <button
              className="btn-primary"
              onClick={() => {
                const list = storyListInput.split(/\r?\n|,|\s+/).map(s => s.trim()).filter(Boolean);
                setStoryList(list);
                setCurrentStoryIndex(0);
              }}
              disabled={!storyListInput.trim()}
            >
              Start Planning
            </button>
          </div>
        )}

        {/* Card Selection Area */}
        {!revealed && (
          <div className="voting-section">
            <h3>Select your estimate</h3>

            {/* Always show cards for non-observers */}
            {!isCurrentUserObserver && (
              <div className="cards-grid">
                {cards.map((c) => (
                  <Card
                    key={c}
                    value={c}
                    onClick={(value) => {
                      console.log("Card onClick triggered with value:", value);
                      handleVote(value);
                    }}
                    selected={selectedCard === c}
                  />
                ))}
              </div>
            )}

            {/* Observer message */}
            {isCurrentUserObserver && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                <p>You are in observer mode and cannot vote</p>
              </div>
            )}

            {/* Reveal button - ALWAYS show for Sarthak, regardless of observer mode */}
            {isSarthak && (
              <button
                className="btn-reveal"
                onClick={() => {
                  console.log("Reveal button clicked");
                  socket.emit("reveal");
                }}
              >
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
                <div className="observed-card">
                  <span>Selected card: </span>
                  <strong>{observedVote}</strong>
                </div>
              ) : (
                <p className="no-vote-message">Has not voted yet</p>
              )}
            </div>
          </div>
        )}

        {/* Observer placeholder */}
        {isCurrentUserObserver && !observingTarget && !revealed && (
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
                  {allVotesSame && (
                    <span className="consensus-badge">
                      <span className="consensus-icon">🎯</span>
                      Consensus Reached!
                    </span>
                  )}
                </div>
                <div className="stats-grid">
                  <div className="stat-card average">
                    <div className="stat-icon">📈</div>
                    <div className="stat-content">
                      <span className="stat-label">Average</span>
                      <span className="stat-value">{stats.avg}</span>
                    </div>
                    <div className="stat-trend">
                      {stats.avg > 0 && <span className="trend-indicator">↗️</span>}
                    </div>
                  </div>

                  <div className="stat-card minimum">
                    <div className="stat-icon">⬇️</div>
                    <div className="stat-content">
                      <span className="stat-label">Minimum</span>
                      <span className="stat-value">{stats.min}</span>
                    </div>
                  </div>

                  <div className="stat-card maximum">
                    <div className="stat-icon">⬆️</div>
                    <div className="stat-content">
                      <span className="stat-label">Maximum</span>
                      <span className="stat-value">{stats.max}</span>
                    </div>
                  </div>

                  <div className="stat-card count">
                    <div className="stat-icon">👥</div>
                    <div className="stat-content">
                      <span className="stat-label">Total Votes</span>
                      <span className="stat-value">{stats.count}</span>
                    </div>
                    <div className="stat-subtitle">
                      {stats.count === 1 ? 'participant' : 'participants'}
                    </div>
                  </div>
                </div>

                {/* Range Visualization */}
                {stats.min !== stats.max && (
                  <div className="vote-range">
                    <div className="range-label">Vote Range</div>
                    <div className="range-bar-container">
                      <div
                        className="range-bar"
                        style={{
                          left: `${(stats.min / stats.max) * 100}%`,
                          width: `${((stats.max - stats.min) / stats.max) * 100}%`
                        }}
                      ></div>
                      <div className="range-markers">
                        <span className="range-min">{stats.min}</span>
                        <span className="range-max">{stats.max}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {allVotesSame && (
              <div className="celebration">
                <div className="party-poppers">
                  <span>🎉</span>
                  <span>🎊</span>
                  <span>🎉</span>
                  <span>✨</span>
                  <span>🎉</span>
                </div>
                <p className="celebration-text">
                  <span className="celebration-emoji">🏆</span>
                  Perfect Agreement!
                  <span className="celebration-emoji">🏆</span>
                </p>
                <div className="confetti-dots">
                  <span>⚡</span>
                  <span>⭐</span>
                  <span>⚡</span>
                </div>
              </div>
            )}

            <div className="votes-grid">
              {Object.entries(results.votes).map(([id, vote]) => {
                const isObservedUser = observingTarget === id;
                return (
                  <div
                    key={id}
                    className={`vote-item ${isObservedUser ? 'observed-vote-item' : ''}`}
                  >
                    <div className="voter-info">
                      <div className="voter-avatar" style={{ backgroundColor: getAvatarColor(results.users[id]) }}>
                        {getInitials(results.users[id])}
                        {observers[id] && <FaUserSecret className="voter-observer-icon" />}
                      </div>
                      <span className="voter-name">{results.users[id]}</span>
                    </div>
                    <span className="vote-value">{vote}</span>
                    {isObservedUser && <FaEye className="observed-eye" />}
                  </div>
                );
              })}
            </div>

            {/* Quick Stats Summary */}
            {stats && (
              <div className="stats-footer">
                <div className="stats-summary">
                  <span className="summary-item">
                    <span className="summary-dot" style={{ background: '#4CAF50' }}></span>
                    Spread: {stats.max - stats.min} points
                  </span>
                  <span className="summary-item">
                    <span className="summary-dot" style={{ background: '#FF9800' }}></span>
                    Median: {stats.min === stats.max ? stats.min : Math.round((stats.min + stats.max) / 2)}
                  </span>
                </div>
              </div>
            )}

            {/* Admin Controls */}
            {isSarthak && (
              <div className="admin-controls">
                <button
                  className="btn-reset"
                  onClick={() => {
                    setRevealed(false);
                    setResults(null);
                    setSelectedCard(null);
                    socket.emit("reset");
                  }}
                >
                  <FaUndo /> Reset Voting
                </button>

                <div className="finalize-controls">
                  {storyList.length === 0 && (
                    <input
                      type="text"
                      placeholder="Jira Key"
                      value={jiraKey}
                      onChange={e => setJiraKey(e.target.value)}
                      className="jira-input"
                    />
                  )}
                  <div className="point-input-group">
                    <input
                      type="number"
                      value={customPoint}
                      onChange={e => setCustomPoint(Number(e.target.value))}
                      min={0}
                      className="point-input"
                    />
                    <button
                      className="btn-finalize"
                      onClick={() => socket.emit("finalize", { point: customPoint, jiraKey })}
                    >
                      <FaStar /> Finalize {customPoint}
                    </button>
                  </div>
                </div>

                {storyList.length > 0 && (
                  <button
                    className="btn-reset-list"
                    onClick={() => {
                      setStoryList([]);
                      setStoryListInput("");
                      setCurrentStoryIndex(0);
                      setJiraKey("");
                      setRevealed(false);
                      setResults(null);
                      setFinalPoint(null);
                      setIssueTitle(null);
                      setAcceptanceCriteria(null);
                      setDescription(null);
                      setObservingTarget(null);
                      setEditingAcceptance(false);
                      setEditingAcceptanceVisual(false);
                      setEditingDescription(false);
                      setEditingDescriptionVisual(false);
                      socket.emit("reset");
                    }}
                  >
                    Reset List
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Final Point Display */}
        {finalPoint && (
          <div className="final-point-card">
            <div className="final-point-content">
              <span className="final-point-label">Final Story Point</span>
              <span className="final-point-value">{finalPoint}</span>
            </div>
            {issueTitle && <p className="final-story-title">{issueTitle}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
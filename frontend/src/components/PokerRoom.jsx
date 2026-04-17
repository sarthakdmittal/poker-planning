import { useEffect, useState, useRef, useCallback } from "react";
import { socket } from "../socket";
import { useParams } from 'react-router-dom';
import Card from "./Card.jsx";
import {
  FaCheck, FaUsers, FaEye, FaEyeSlash, FaArrowLeft, FaArrowRight,
  FaUndo, FaStar, FaPencilAlt, FaCopy, FaRegCopy, FaUserSecret,
  FaBold, FaItalic, FaUnderline, FaListUl, FaListOl, FaHeading,
  FaMarkdown, FaCode
} from "react-icons/fa";
import '../../jira-content.css';
import './PokerRoom.css';
import StoryQueue from './StoryQueue';
import JiraEditor from './JiraEditor';

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
  let inTable = false;

  function closeTable() {
    if (inTable) { html += '</tbody></table>'; inTable = false; }
  }

  function applyInlineFormatting(str) {
    if (!str) return "";

    // Normalize malformed Jira triple-brace patterns like {{{text{}}}}
    str = str.replace(/\.\{\{\{\}(.*?)\{\}\}\}/g, '.$1');

    str = str.replace(/\{\*\}(.*?)\{\*\}/g, "<strong>$1</strong>");
    // Handle *bold* syntax
    str = str.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");

    // Handle +bold+ syntax
    str = str.replace(/\+(.*?)\+/g, "<strong>$1</strong>");

    // Handle italic
    str = str.replace(/_([^_]+)_/g, "<em>$1</em>");

    // Handle strikethrough -text-
    str = str.replace(/(^|\s)-(.+?)-(?=\s|$)/g, '$1<del>$2</del>');

    // Fix malformed Jira patterns like {{{text{}}}}
    str = str.replace(/\{\{\{(.*?)\}\}\}/g, "{{$1}}");

    // Remove inner {} that sometimes appear inside {{ }}
    str = str.replace(/\{\{(.*?)\{\}(.*?)\}\}/g, "{{$1$2}}");

    // Remove standalone {} wrappers
    str = str.replace(/\{\}(.*?)\{\}/g, "$1");

    // Handle inline code
    str = str.replace(/\{\{(.*?)\}\}/g, "<code>$1</code>");

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

    // Handle code blocks (supports {code}, {code:java}, inline closing)
    const codeStart = line.match(/\{code(?::[^\}]*)?\}/);

    if (codeStart && !inCodeBlock) {
      inCodeBlock = true;
      html += '<pre class="jira-code"><code>';

      // remove the opening tag if other text exists
      const after = line.replace(/\{code(?::[^\}]*)?\}/, '').trim();
      if (after) html += after + '\n';

      continue;
    }

    if (inCodeBlock && line.includes("{code}")) {
      const before = line.split("{code}")[0];
      if (before) html += before + '\n';

      html += '</code></pre>';
      inCodeBlock = false;
      continue;
    }

    if (inCodeBlock) {
      html += line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;") + '\n';
      continue;
    }

    // Handle headings
    const headingMatch = line.match(/^h([1-6])\.\s+(.*)/);
    if (headingMatch) {
      closeTable();
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

    // Handle Jira table header row: ||col1||col2||...
    if (line.startsWith('||')) {
      if (!inTable) { inTable = true; }
      const cells = line.replace(/^\|\|/, '').replace(/\|\|$/, '').split('||');
      const ths = cells.map(c => `<th>${applyInlineFormatting(c.trim())}</th>`).join('');
      html += `<table class="jira-table"><thead><tr>${ths}</tr></thead><tbody>`;
      continue;
    }

    // Handle Jira table data row: |col1|col2|...
    if (line.startsWith('|') && !line.startsWith('||')) {
      if (!inTable) { html += '<table class="jira-table"><tbody>'; inTable = true; }
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|');
      const tds = cells.map(c => `<td>${applyInlineFormatting(c.trim())}</td>`).join('');
      html += `<tr>${tds}</tr>`;
      continue;
    }

    // Close any open table when a non-table line appears
    closeTable();

    // Handle empty lines as paragraph breaks
    if (line === '') {
      html += '<br/>';
      continue;
    }

    // Regular paragraph
    html += `<p>${applyInlineFormatting(line)}</p>`;
  }

  // Close any remaining lists or tables
  while (listStack.length) {
    html += `</${listStack.pop()}>`;
  }
  closeTable();

  return html;
}

// HTML to Jira wiki markup converter
function htmlToJiraWiki(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  function processNode(node) {

    // TEXT NODE
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent
          .replace(/\bMap\b(?!<)/g, 'Map<String, Object>');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tagName = node.tagName.toLowerCase();

    const children = Array.from(node.childNodes)
        .map(child => processNode(child))
        .join('');

    switch (tagName) {

      case 'strong':
      case 'b': {
        const text = children.trim();

        if (/^\{\*.*\*\}$/.test(text) || /^\*.*\*$/.test(text)) {
          return text;
        }

        return `*${text}*`;
      }

      case 'em':
      case 'i':
        return `_${children}_`;

      case 'u':
        return `+${children}+`;

      case 'code': {
        const text = children.trim();

        if (/^\{\{.*\}\}$/.test(text)) {
          return text;
        }

        return `{{${text}}}`;
      }

      case 'a': {
        const href = node.getAttribute('href') || '';
        return `[${children}|${href}]`;
      }

      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = tagName;

        const text = children
            .replace(/^\{\*(.*?)\*\}$/, '$1')
            .replace(/^\*(.*?)\*$/, '$1')
            .trim();

        return `${level}. +${text}+\n\n`;
      }

      case 'p': {
        const text = children.trim();
        return text ? `${text}\n\n` : '\n';
      }

      case 'div':
        return `${children}\n`;

      case 'ul':
      case 'ol':
        return children;

      case 'li': {

        let depth = 1;
        let parent = node.parentNode;
        let listType = 'ul';

        while (parent) {
          const tag = parent.tagName?.toLowerCase();

          if (tag === 'ul' || tag === 'ol') {
            depth++;
            listType = tag;
          }

          parent = parent.parentNode;
        }

        const marker =
            node.parentNode?.tagName?.toLowerCase() === 'ol'
                ? '#'
                : '*';

        return `${marker.repeat(depth - 1)} ${children.trim()}\n`;
      }

      case 'br':
        return '\n';

      case 'span': {

        if (node.getAttribute('data-jira-bold') === 'true') {
          return `{*${children}*}`;
        }

        const style = node.getAttribute('style') || '';

        const colorMatch = style.match(/color:\s*(#[0-9a-fA-F]{6})/);

        if (colorMatch) {
          return `{color:${colorMatch[1]}}${children}{color}`;
        }

        return children;
      }

      case 'pre':
        return `{code}${children}{code}\n\n`;

      default:
        return children;
    }
  }

  let result = processNode(tempDiv)
      .replace(/\n{3,}/g, '\n\n')
      .replace(/_\s+_/g, '')
      .replace(/[ \t]+\n/g, '\n')

      // restore Jira strong emphasis {*text*}
      .replace(/\{\*(.*?)\*\}/g, '{*}$1{*}')

      .trim();

  return result;
}

// Calculate statistics from votes
const calculateStats = (votes) => {
  const values = Object.values(votes).filter(v => v !== null && v !== undefined);
  if (values.length === 0) return null;

  // Handle both numeric and string values
  const numericValues = values.map(v => {
    if (typeof v === 'string' && isNaN(Number(v))) {
      // For T-shirt sizes, assign numeric values for stats
      const sizeMap = {
        'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6
      };
      return sizeMap[v] || 3; // Default to medium if unknown
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

export default function PokerRoom({ name, onLeaveRoom }) {
  const { roomId } = useParams(); // Get roomId from URL
  const [users, setUsers] = useState({});
  const [userIcons, setUserIcons] = useState({});
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
  const [tiptapAcceptanceHtml, setTiptapAcceptanceHtml] = useState("");
  const [showVisual, setShowVisual] = useState(true);
  const [showDescription, setShowDescription] = useState(false);
  const [storyList, setStoryList] = useState([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [storyListInput, setStoryListInput] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescriptionValue, setEditDescriptionValue] = useState("");
  const [editingDescriptionVisual, setEditingDescriptionVisual] = useState(false);
  const [editDescriptionVisualValue, setEditDescriptionVisualValue] = useState("");
  const [tiptapDescriptionHtml, setTiptapDescriptionHtml] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [votedUsers, setVotedUsers] = useState([]);
  const [issueType, setIssueType] = useState(null);
  const [copied, setCopied] = useState(false);
  const [storyStatus, setStoryStatus] = useState(""); // Tracks the current story status
  const [fixVersions, setFixVersions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [reporter, setReporter] = useState(null);
  const [assignee, setAssignee] = useState(null);
  // Fix versions editing
  const [editingFixVersions, setEditingFixVersions] = useState(false);
  const [allProjectVersions, setAllProjectVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersionIds, setSelectedVersionIds] = useState([]);
  // Assignee editing
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState("");
  const [assigneeSearchResults, setAssigneeSearchResults] = useState([]);
  const [assigneeSearchLoading, setAssigneeSearchLoading] = useState(false);
  // Attachments editing
  const [editingAttachments, setEditingAttachments] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef(null);
  // Priority
  const [priority, setPriority] = useState(null);
  const [priorityIconUrl, setPriorityIconUrl] = useState(null);
  const [editingPriority, setEditingPriority] = useState(false);
  const [allPriorities, setAllPriorities] = useState([]);
  // Squad
  const [squad, setSquad] = useState(null);
  const [squadId, setSquadId] = useState(null);
  const [editingSquad, setEditingSquad] = useState(false);
  const [squadOptions, setSquadOptions] = useState([]);
  // Resolution
  const [resolution, setResolution] = useState(null);
  const [editingResolution, setEditingResolution] = useState(false);
  const [allResolutions, setAllResolutions] = useState([]);
  // Sprint
  const [sprints, setSprints] = useState([]);
  const [editingSprint, setEditingSprint] = useState(false);
  const [allSprints, setAllSprints] = useState([]);
  // Epic link
  const [epicLink, setEpicLink] = useState(null);
  const [epicLinkKey, setEpicLinkKey] = useState(null);
  const [editingEpicLink, setEditingEpicLink] = useState(false);
  const [allEpics, setAllEpics] = useState([]);
  const [availableTransitions, setAvailableTransitions] = useState([]);
  const [isLoadingTransitions, setIsLoadingTransitions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [observers, setObservers] = useState({});
  const [observingTarget, setObservingTarget] = useState(null);
  const [userVotes, setUserVotes] = useState({});
  const [isReconnecting, setIsReconnecting] = useState(true);
  const [roomName, setRoomName] = useState("");
  const [roomIdCopied, setRoomIdCopied] = useState(false);
  const [showDropZone, setShowDropZone] = useState(false);
  const [draggedStory, setDraggedStory] = useState(null);
  const [allStoryDetails, setAllStoryDetails] = useState({});
  const [cards, setCards] = useState([0, 1, 2, 3, 5, 8, 13, 21]); // Default Fibonacci
  const [scaleType, setScaleType] = useState('FIBONACCI');
  const [jiraConnected, setJiraConnected] = useState(false);
  const [jiraBaseUrl, setJiraBaseUrl] = useState(null);
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const skipNextVoteUpdateRef = useRef(false);
  const [storyVoteHistory, setStoryVoteHistory] = useState({});

  // Refs for editors
  const acceptanceEditorRef = useRef(null);
  const descriptionEditorRef = useRef(null);

  // Track whether user is viewing a historical story (not the live voting story).
  // Using a ref so socket handlers always read the latest value without re-registering.
  const viewingHistoryRef = useRef(false);

  const storyStatuses = [
    "To Do",
    "In Progress",
    "In Review",
    "Done",
    "Closed",
    "Ready",
    "Blocked",
    "DEV IN PROGRESS",
    "Code review",
    "On-Hold",
    "TEST IN PROGRESS",
    "READY TO TEST",
    "New"
  ];

  // Load saved story data from localStorage on initial render
  // Load saved story data from localStorage on initial render
  useEffect(() => {
    if (roomId && !hasRestoredState) {
      const savedStoryData = localStorage.getItem(`storyData_${roomId}`);
      if (savedStoryData) {
        const parsed = JSON.parse(savedStoryData);

        // Check if data is older than 24 hours (86400000 milliseconds)
        if (parsed.savedAt) {
          const savedTime = new Date(parsed.savedAt).getTime();
          const currentTime = new Date().getTime();
          const timeDiff = currentTime - savedTime;
          const hoursDiff = timeDiff / (1000 * 60 * 60);

          console.log(`Data age: ${hoursDiff.toFixed(2)} hours`);

          if (hoursDiff > 24) {
            console.log('Data is older than 24 hours, clearing...');
            // Clear stale data
            localStorage.removeItem(`storyData_${roomId}`);
            localStorage.removeItem(`users_${roomId}`);
            localStorage.removeItem(`observers_${roomId}`);
            localStorage.removeItem(`admin_${roomId}`);

            // Reset all states
            setJiraKey("");
            setIssueTitle(null);
            setAcceptanceCriteria(null);
            setDescription(null);
            setIssueType(null);
            setStoryStatus("");
            setStoryList([]);
            setCurrentStoryIndex(0);
            setStoryListInput("");
            setRevealed(false);
            setFinalPoint(null);
            setSelectedCard(null);
            setVotedUsers([]);
            setUserVotes({});
            setUsers({});
            setObservers({});
            setResults(null);

            setIsLoading(false);
            setHasRestoredState(true);
            return; // Exit early, don't load stale data
          }
        }

        // Only load data if it's not stale
        setJiraKey(parsed.jiraKey || "");
        setIssueTitle(parsed.issueTitle || null);
        setAcceptanceCriteria(parsed.acceptanceCriteria || null);
        setDescription(parsed.description || null);
        setIssueType(parsed.issueType || null);
        setStoryStatus(parsed.storyStatus || "");
        setStoryList(parsed.storyList || []);
        setCurrentStoryIndex(parsed.currentStoryIndex || 0);
        setStoryListInput(parsed.storyListInput || "");
        setAllStoryDetails(parsed.allStoryDetails || {});
        setCards(parsed.cards || [0, 1, 2, 3, 5, 8, 13, 21]);
        setScaleType(parsed.scaleType || 'FIBONACCI');
        setStoryVoteHistory(parsed.storyVoteHistory || {});

        // Restore voting state
        setRevealed(parsed.revealed || false);
        setFinalPoint(parsed.finalPoint || null);
        setSelectedCard(parsed.selectedCard || null);
        setVotedUsers(parsed.votedUsers || []);
        setUserVotes(parsed.userVotes || {});

        // If there was a final point, we might want to show results
        if (parsed.results) {
          console.log("Restoring results from localStorage");
          setResults(parsed.results);
          if (parsed.revealed) {
            skipNextVoteUpdateRef.current = true; // Skip the first vote update
          }
        } else if (parsed.revealed && parsed.userVotes && parsed.users) {
          // For backward compatibility
          setResults({
            votes: parsed.userVotes || {},
            users: parsed.users || {}
          });
          skipNextVoteUpdateRef.current = true;
        }
      }

      // Do not restore users from localStorage — server sends the authoritative list on join

      // Load saved observers from localStorage
      const savedObservers = localStorage.getItem(`observers_${roomId}`);
      if (savedObservers) {
        const parsedObservers = JSON.parse(savedObservers);
        // Check if observers data has timestamp
        if (parsedObservers.savedAt) {
          const savedTime = new Date(parsedObservers.savedAt).getTime();
          const currentTime = new Date().getTime();
          const hoursDiff = (currentTime - savedTime) / (1000 * 60 * 60);

          if (hoursDiff <= 24) {
            setObservers(parsedObservers);
          } else {
            localStorage.removeItem(`observers_${roomId}`);
          }
        } else {
          setObservers(parsedObservers);
        }
      }

      const savedAdmin = localStorage.getItem(`admin_${roomId}`);
      if (savedAdmin) {
        setAdminName(savedAdmin);
      }

      setHasRestoredState(true);
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
    }
  }, [roomId, hasRestoredState]);

  // Fetch details for all stories when storyList changes
  useEffect(() => {
    if (storyList.length > 0 && roomId && jiraConnected) {
      console.log("Fetching details for all stories:", storyList);

      // Request details for all stories at once
      socket.emit("fetchMultipleJiraDetails", {
        roomId,
        issueKeys: storyList
      });
    }
  }, [storyList, roomId, jiraConnected]);

  // Try to recover admin from localStorage
  useEffect(() => {
    if (roomId) {
      // Try to get admin from localStorage as fallback
      const savedAdmin = localStorage.getItem(`admin_${roomId}`);
      if (savedAdmin && !adminName) {
        setAdminName(savedAdmin);
      }
    }
  }, [roomId]);

  // Request current admin when component mounts
  useEffect(() => {
    if (roomId) {
      // Request current admin when component mounts
      socket.emit("getCurrentAdmin", { roomId });
    }
  }, [roomId]);

  useEffect(() => {
    if (roomId && name) {
      // Request current story data
      socket.emit("requestCurrentStory", { roomId });
    }
  }, [roomId, name]);

  // Save story data to localStorage whenever it changes
  // Save story data to localStorage whenever it changes
  useEffect(() => {
    if (roomId && !isLoading && hasRestoredState) {
      const timestamp = new Date().toISOString();

      const storyData = {
        jiraKey,
        issueTitle,
        acceptanceCriteria,
        description,
        issueType,
        storyStatus,
        storyList,
        currentStoryIndex,
        storyListInput,
        revealed,
        finalPoint,
        selectedCard,
        votedUsers,
        userVotes,
        users,
        results,
        allStoryDetails,
        cards,
        scaleType,
        storyVoteHistory,
        savedAt: timestamp  // Add timestamp here
      };
      localStorage.setItem(`storyData_${roomId}`, JSON.stringify(storyData));

      // Also save users separately with timestamp
      const usersWithTimestamp = {
        ...users,
        savedAt: timestamp
      };
      localStorage.setItem(`users_${roomId}`, JSON.stringify(usersWithTimestamp));

      // Save observers with timestamp
      const observersWithTimestamp = {
        ...observers,
        savedAt: timestamp
      };
      localStorage.setItem(`observers_${roomId}`, JSON.stringify(observersWithTimestamp));

      console.log(`Data saved at ${timestamp}, revealed: ${revealed}`);
    }
  }, [roomId, jiraKey, issueTitle, acceptanceCriteria, description, issueType,
    storyStatus, storyList, currentStoryIndex, storyListInput, revealed,
    finalPoint, selectedCard, votedUsers, userVotes, users, observers, results, allStoryDetails, cards, scaleType, storyVoteHistory, isLoading, hasRestoredState]);

  // Update this useEffect to handle reconnection better
  useEffect(() => {
    if (roomId) {
      console.log("Requesting initial data for room:", roomId);

      // Request users and observers
      socket.emit("getUsers", { roomId });
      socket.emit("requestObservers", { roomId });

      // Also request room info
      socket.emit("getRoomInfo", { roomId });

      // Also try to join if not already in room
      if (name && name.trim()) socket.emit("join-room", {
        userName: name,
        roomId: roomId,
        adminSecret: localStorage.getItem(`adminSecret_${roomId}`) || undefined
      });

      // If we have a jiraKey from localStorage, fetch fresh details
      if (jiraKey && jiraConnected) {
        socket.emit("fetchJiraDetails", { roomId, jiraKey });
      }
    }
  }, [roomId, name, jiraConnected]);

  useEffect(() => {
    console.log("Socket connected?", socket.connected);

    const onConnect = () => {
      console.log("Socket connected!");
      if (roomId) {
        socket.emit("getUsers", { roomId });
        socket.emit("requestObservers", { roomId });
        socket.emit("getCurrentAdmin", { roomId });

        // Re-fetch Jira details on reconnect if we have a jiraKey
        if (jiraKey && jiraConnected) {
          socket.emit("fetchJiraDetails", { roomId, jiraKey });
        }
      }
    };

    socket.on("connect", onConnect);

    return () => {
      socket.off("connect", onConnect);
    };
  }, [roomId, jiraKey, jiraConnected]);

  // Add Jira error listener
  useEffect(() => {
    const handleJiraError = ({ message }) => {
      console.error("Jira error:", message);
      // Show error to user
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.style.position = 'fixed';
      errorDiv.style.top = '20px';
      errorDiv.style.right = '20px';
      errorDiv.style.zIndex = '1000';
      errorDiv.style.backgroundColor = '#f44336';
      errorDiv.style.color = 'white';
      errorDiv.style.padding = '12px 20px';
      errorDiv.style.borderRadius = '4px';
      errorDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      errorDiv.innerHTML = `⚠️ ${message}`;
      document.body.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 5000);
    };

    socket.on("jiraError", handleJiraError);

    return () => {
      socket.off("jiraError", handleJiraError);
    };
  }, []);

  // Add loading state management
  useEffect(() => {
    if (!roomId) return;

    console.log("Checking if user is in room...", { users, name });

    // Function to check if current user is in the users list
    const checkUserInRoom = () => {
      const isUserInRoom = Object.values(users).includes(name);
      console.log("Is user in room?", isUserInRoom, "Users:", Object.values(users));

      if (isUserInRoom) {
        console.log("User found in room, stopping reconnection message");
        setIsReconnecting(false);
      } else {
        console.log("User not in room yet, trying to re-join");
        if (name && name.trim()) socket.emit("join-room", {
          userName: name,
          roomId: roomId,
          adminSecret: localStorage.getItem(`adminSecret_${roomId}`) || undefined
        });
      }
    };

    // Check immediately
    checkUserInRoom();

    // Also check whenever users change
    const handleUsersUpdate = () => {
      checkUserInRoom();
    };

    socket.on("users", handleUsersUpdate);

    // Set a timeout to force stop reconnecting if we have users but somehow still reconnecting
    const timeout = setTimeout(() => {
      if (Object.keys(users).length > 0 && isReconnecting) {
        console.log("Force stopping reconnection - we have users");
        setIsReconnecting(false);
      }
    }, 2000);

    return () => {
      socket.off("users", handleUsersUpdate);
      clearTimeout(timeout);
    };
  }, [roomId, name, users]);

  // Add this near your other useEffects in PokerRoom.jsx
  useEffect(() => {
    if (roomId) {
      // Request current users in the room
      socket.emit("getUsers", { roomId });

      // Also request observers
      socket.emit("requestObservers", { roomId });
    }
  }, [roomId]);

  useEffect(() => {
    console.log("Setting up socket listeners for:", name);

    socket.on("users", (data) => {
      console.log("Received users update:", data);
      // If we're observing someone who left, clear observation
      if (observingTarget && !Object.keys(data).includes(observingTarget)) {
        console.log("Observed user left, clearing observation");
        setObservingTarget(null);
      }
      // Check if the current user is still in the room
      const currentUserStillInRoom = Object.values(data).includes(name);

      setUsers(data);
      // If current user is no longer in the room, they were kicked or disconnected
      if (!currentUserStillInRoom && !isReconnecting) {
        console.log("Current user no longer in room, redirecting to home");
        setTimeout(() => {
          if (roomId) {
            localStorage.removeItem(`admin_${roomId}`);
            localStorage.removeItem(`storyData_${roomId}`);
          }
          window.location.href = '/';
        }, 1000);
      }
    });

    socket.on("userIcons", (data) => {
      setUserIcons(data || {});
    });

    // ADD THIS NEW LISTENER FOR CURRENT ADMIN
    socket.on("currentAdmin", (data) => {
      console.log("Received current admin:", data);
      setAdminName(data.adminName);
      // Store admin in localStorage as backup
      if (roomId && data.adminName) {
        localStorage.setItem(`admin_${roomId}`, data.adminName);
      }
    });

    // In PokerRoom.jsx, find the roomInfo listener and update it with more detailed logging:
    socket.on("roomInfo", (data) => {
      console.log("===== ROOM INFO RECEIVED =====");
      console.log("Full room info data:", data);
      console.log("Room name:", data?.roomName);
      console.log("Estimation scale:", data?.estimationScale);
      console.log("Jira connected:", data?.jiraConnected);

      if (data && data.roomName) {
        setRoomName(data.roomName);
      }

      // Update Jira connection status
      if (data && data.jiraConnected !== undefined) {
        setJiraConnected(data.jiraConnected);
        if (!data.jiraConnected) {
          console.log("⚠️ Jira not connected for this room");
        }
      }
      if (data && data.jiraBaseUrl) {
        setJiraBaseUrl(data.jiraBaseUrl);
      }

      // Update cards based on room's estimation scale
      if (data && data.estimationScale) {
        console.log("Scale type from server:", data.estimationScale.type);
        console.log("Cards from server:", data.estimationScale.cards);

        if (data.estimationScale.cards) {
          console.log("Setting cards to:", data.estimationScale.cards);
          setCards(data.estimationScale.cards);

          // Make sure the scale type matches the keys in ESTIMATION_SCALES
          const scaleTypeFromServer = data.estimationScale.type;

          // Log available scale types
          console.log("Available scale types:", Object.keys(ESTIMATION_SCALES));

          // Check if this key exists in ESTIMATION_SCALES
          if (scaleTypeFromServer && ESTIMATION_SCALES[scaleTypeFromServer]) {
            console.log("Found matching scale type:", scaleTypeFromServer);
            setScaleType(scaleTypeFromServer);
          } else {
            console.warn("Unknown scale type:", scaleTypeFromServer);

            // Try to find by matching the cards array
            const foundScale = Object.entries(ESTIMATION_SCALES).find(([key, scale]) => {
              const match = JSON.stringify(scale.cards) === JSON.stringify(data.estimationScale.cards);
              if (match) console.log("Found scale by cards match:", key);
              return match;
            });

            if (foundScale) {
              console.log("Setting scale type from cards match:", foundScale[0]);
              setScaleType(foundScale[0]);
            } else {
              console.log("No match found, defaulting to FIBONACCI");
              setScaleType('FIBONACCI');
            }
          }
        }
      } else {
        console.log("No estimation scale in room info");
      }
      console.log("===== END ROOM INFO =====");
    });

    socket.on("observersUpdate", (observerData) => {
      console.log("Received observers update:", observerData);
      setObservers(observerData);
      // Add this to save observers to localStorage
      if (roomId) {
        const observersWithTimestamp = {
          ...observerData,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(`observers_${roomId}`, JSON.stringify(observersWithTimestamp));
      }
      // Find current user ID after users state is updated
      const currentUserId = Object.keys(users).find(uid => users[uid] === name);
      if (currentUserId && observerData[currentUserId]) {
        console.log("Current user is now an observer, clearing vote");
        setSelectedCard(null);
        socket.emit("vote", { roomId, point: null });
      }
    });

    socket.on("room-joined", (data) => {
      console.log("Room joined confirmation:", data);
      // Optionally do something with this data
    });

    // Listen for multiple Jira details
    socket.on("multipleJiraDetails", ({ roomId: responseRoomId, results }) => {
      if (responseRoomId === roomId) {
        console.log("Received multipleJiraDetails:", results);
        setAllStoryDetails(results);

        // Save to localStorage
        const storyData = JSON.parse(localStorage.getItem(`storyData_${roomId}`) || '{}');
        storyData.allStoryDetails = results;
        storyData.savedAt = new Date().toISOString();
        localStorage.setItem(`storyData_${roomId}`, JSON.stringify(storyData));
      }
    });

    socket.on("reveal", (data) => {
      console.log("Reveal event received:", data);
      // Don't overwrite historical story results with live voting results
      if (viewingHistoryRef.current) {
        console.log("Skipping reveal update: viewing historical story");
        return;
      }
      setResults(data);
      setRevealed(true);
      skipNextVoteUpdateRef.current = false;

      // Save to localStorage
      if (roomId) {
        const storyData = JSON.parse(localStorage.getItem(`storyData_${roomId}`) || '{}');
        storyData.revealed = true;
        storyData.results = data;
        storyData.votedUsers = Object.keys(data.votes || {});
        storyData.userVotes = data.votes || {};

        storyData.savedAt = new Date().toISOString();
        localStorage.setItem(`storyData_${roomId}`, JSON.stringify(storyData));
      }
    });

    socket.on("storyStatusUpdate", ({ jiraKey: key, status }) => {
      if (jiraKey === key) {
        setStoryStatus(status);
      }
    });

    socket.on("final", (data) => {
      // Don't overwrite historical story's final point with the live story's
      if (viewingHistoryRef.current) {
        console.log("Skipping final update: viewing historical story");
        return;
      }
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

    socket.on("statusUpdateError", ({ error }) => {
      alert(`Failed to update status: ${error}`);
    });

    socket.on("jiraDetails", (details) => {
      console.log("Received jiraDetails:", details);
      console.log("Status from backend:", details.status);
      setIssueTitle(details.summary);
      setAcceptanceCriteria(details.acceptanceCriteria);
      setDescription(details.description);
      setIssueType(details.issueType);
      setEditingAcceptance(false);
      setStoryStatus(details.status || "To Do");
      setFixVersions(details.fixVersions || []);
      setAttachments(details.attachments || []);
      setReporter(details.reporter || null);
      setAssignee(details.assignee || null);
      setPriority(details.priority || null);
      setPriorityIconUrl(details.priorityIconUrl || null);
      setResolution(details.resolution || null);
      setSquad(details.squad || null);
      setSquadId(details.squadId || null);
      setEpicLink(details.epicLink || null);
      setEpicLinkKey(details.epicLinkKey || null);
      setSprints(details.sprints || []);
      setEditingAcceptanceVisual(false);
      setEditingDescription(false);
      setEditingDescriptionVisual(false);
    });

    socket.on("reset", () => {
      console.log("Reset received");
      // If this client is in history mode it means THIS client triggered the reset as part of
      // navigating to a historical story — skip clearing so the local restore stays intact.
      if (viewingHistoryRef.current) {
        console.log("Skipping reset: this client is in history-view mode");
        return;
      }
      // Room moved to a new story — exit history mode so live events are processed again
      viewingHistoryRef.current = false;
      setRevealed(false);
      setResults(null);
      setFinalPoint(null);
      setVotedUsers([]);
      setUserVotes({});
      setSelectedCard(null);
      setObservers({});
      setObservingTarget(null);
      skipNextVoteUpdateRef.current = false; // Reset skip flag on reset
      // Save reset state to localStorage
      if (roomId) {
        const storyData = JSON.parse(localStorage.getItem(`storyData_${roomId}`) || '{}');
        storyData.revealed = false;
        storyData.results = null;
        storyData.finalPoint = null;
        storyData.votedUsers = [];
        storyData.userVotes = {};
        storyData.savedAt = new Date().toISOString();
        localStorage.setItem(`storyData_${roomId}`, JSON.stringify(storyData));
      }
    });

    socket.on("admin", (data) => {
      console.log("Admin set/updated:", data);
      // Handle both string and object responses
      const adminValue = typeof data === 'object' ? data.adminName : data;
      setAdminName(adminValue);
      // Store admin in localStorage as backup
      if (roomId && adminValue) {
        localStorage.setItem(`admin_${roomId}`, adminValue);
      }
    });

    socket.on("voteUpdate", (data) => {
      console.log("Vote update received:", data);

      // Don't overwrite historical story votes with live voting progress
      if (viewingHistoryRef.current) {
        console.log("Skipping voteUpdate: viewing historical story");
        return;
      }

      if (skipNextVoteUpdateRef.current) {
        console.log("Skipping vote update to preserve restored results");
        skipNextVoteUpdateRef.current = false;
        return;
      }

      if (data && data.votes) {
        setVotedUsers(Object.keys(data.votes));
        setUserVotes(data.votes);

        if (revealed) {
          console.log("Updating results in revealed state");
          setResults(data);

        } else {
          console.log("Not in revealed state, preserving existing results");
        }
        // Save to localStorage
        if (roomId) {
          const storyData = JSON.parse(localStorage.getItem(`storyData_${roomId}`) || '{}');
          storyData.votedUsers = Object.keys(data.votes);
          storyData.userVotes = data.votes;
          if (revealed) {
            storyData.results = data;
          }
          storyData.savedAt = new Date().toISOString();
          localStorage.setItem(`storyData_${roomId}`, JSON.stringify(storyData));
        }
      }
    });

    socket.on("jiraTransitions", (data) => {
      console.log("Received transitions:", data);
      if (data && data.transitions) {
        const transitions = data.transitions.map(t => t.to.name);
        setAvailableTransitions(transitions);
      }
      setIsLoadingTransitions(false);
    });

    return () => {
      console.log("Cleaning up socket listeners");
      socket.off("users");
      socket.off("userIcons");
      socket.off("reveal");
      socket.off("final");
      socket.off("jiraDetails");
      socket.off("storyStatusUpdate");
      socket.off("statusUpdateError");
      socket.off("reset");
      socket.off("admin");
      socket.off("observersUpdate");
      socket.off("room-joined");
      socket.off("voteUpdate");
      socket.off("roomInfo");
      socket.off("jiraTransitions");
      socket.off("currentAdmin");
      socket.off("jiraError");
    };
  }, [name, users, roomId, jiraKey, revealed, isReconnecting, jiraConnected]);

  // Stable listeners that must not be torn down mid-request
  useEffect(() => {
    const handleProjectVersions = ({ versions }) => {
      console.log("Received projectVersions:", versions);
      setAllProjectVersions(versions || []);
      setVersionsLoading(false);
    };
    const handleUserSearch = ({ users: results }) => {
      setAssigneeSearchResults(results || []);
      setAssigneeSearchLoading(false);
    };
    const handlePriorities = ({ priorities }) => setAllPriorities(priorities || []);
    const handleSquadOptions = ({ options }) => setSquadOptions(options || []);
    const handleResolutions = ({ resolutions }) => setAllResolutions(resolutions || []);
    const handleSprints = ({ sprints }) => setAllSprints(sprints || []);
    const handleEpics = ({ epics }) => setAllEpics(epics || []);

    socket.on("projectVersions", handleProjectVersions);
    socket.on("jiraUserSearchResults", handleUserSearch);
    socket.on("priorities", handlePriorities);
    socket.on("squadOptions", handleSquadOptions);
    socket.on("resolutions", handleResolutions);
    socket.on("sprints", handleSprints);
    socket.on("epics", handleEpics);
    return () => {
      socket.off("projectVersions", handleProjectVersions);
      socket.off("jiraUserSearchResults", handleUserSearch);
      socket.off("priorities", handlePriorities);
      socket.off("squadOptions", handleSquadOptions);
      socket.off("resolutions", handleResolutions);
      socket.off("sprints", handleSprints);
      socket.off("epics", handleEpics);
    };
  }, []);

  const isAdmin = name && adminName && name === adminName;

  // Get current user's ID
  const currentUserId = Object.keys(users).find(uid => users[uid] === name);
  const isCurrentUserObserver = currentUserId ? observers[currentUserId] : false;

  // Sync admin's story list to backend whenever it changes
  useEffect(() => {
    if (isAdmin && roomId && hasRestoredState) {
      socket.emit("update-stories", {
        roomId,
        stories: storyList,
        currentStoryIndex
      });
    }
  }, [storyList, currentStoryIndex, isAdmin, roomId, hasRestoredState]);

  // Receive story list updates for non-admin participants
  useEffect(() => {
    const handleStoriesUpdated = ({ stories, currentStoryIndex: newIndex }) => {
      if (!isAdmin && Array.isArray(stories)) {
        setStoryList(stories);
        if (typeof newIndex === 'number') {
          setCurrentStoryIndex(newIndex);
        }
      }
    };
    socket.on("stories-updated", handleStoriesUpdated);
    return () => socket.off("stories-updated", handleStoriesUpdated);
  }, [isAdmin]);

  useEffect(() => {
    if (storyList.length > 0 && currentStoryIndex < storyList.length) {
      setJiraKey(storyList[currentStoryIndex]);
    }
  }, [storyList, currentStoryIndex]);

  useEffect(() => {
    if (jiraKey && roomId && jiraConnected) {
      socket.emit("fetchJiraDetails", { roomId, jiraKey });
      fetchAvailableTransitions(jiraKey);
    }
  }, [jiraKey, roomId, jiraConnected]);

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

  // Add this useEffect to update the dropdown container class based on status
  useEffect(() => {
    const dropdown = document.querySelector('.story-status-dropdown');
    if (dropdown) {
      // Remove all status classes
      dropdown.classList.remove(
          'status-todo', 'status-in-progress', 'status-in-review',
          'status-done', 'status-closed', 'status-ready', 'status-blocked'
      );

      // Add the current status class (convert to kebab-case)
      const statusClass = `status-${storyStatus.toLowerCase().replace(/\s+/g, '-')}`;
      dropdown.classList.add(statusClass);

      // Disable dropdown for non-admin users
      if (!isAdmin) {
        dropdown.setAttribute('disabled', 'true');
        dropdown.style.pointerEvents = 'none';
        dropdown.style.opacity = '0.6';
      } else {
        dropdown.removeAttribute('disabled');
        dropdown.style.pointerEvents = 'auto';
        dropdown.style.opacity = '1';
      }
    }
  }, [storyStatus, isAdmin]);

  // Pre-select current fix versions when allProjectVersions loads
  useEffect(() => {
    if (allProjectVersions.length > 0 && fixVersions.length > 0) {
      const matched = allProjectVersions
        .filter(v => fixVersions.includes(v.name))
        .map(v => v.id);
      setSelectedVersionIds(matched);
    }
  }, [allProjectVersions]);

  // Add this near your other useEffects - REPLACE the existing reconnection useEffect
  useEffect(() => {
    if (!roomId || !name) return;

    console.log("Setting up reconnection for room:", roomId, "name:", name);

    const handleReconnect = () => {
      console.log("Socket reconnected, re-joining room:", roomId);
      if (name && name.trim()) socket.emit("join-room", {
        userName: name,
        roomId: roomId,
        adminSecret: localStorage.getItem(`adminSecret_${roomId}`) || undefined
      });

      // Request users after joining
      setTimeout(() => {
        socket.emit("getUsers", { roomId });
        socket.emit("requestObservers", { roomId });
        socket.emit("getCurrentAdmin", { roomId });

        // Re-fetch Jira details if we have a jiraKey and Jira is connected
        if (jiraKey && jiraConnected) {
          socket.emit("fetchJiraDetails", { roomId, jiraKey });
        }
      }, 500);
    };

    // If socket is already connected, join immediately
    if (socket.connected) {
      console.log("Socket already connected, joining immediately");
      handleReconnect();
    } else {
      console.log("Socket not connected, waiting for connection");
    }

    // Listen for connection and reconnection events
    socket.on("connect", handleReconnect);
    socket.on("reconnect", handleReconnect);

    return () => {
      socket.off("connect", handleReconnect);
      socket.off("reconnect", handleReconnect);
    };
  }, [roomId, name, jiraKey, jiraConnected]);

  // Drag and drop handlers for loading stories
  useEffect(() => {
    const handleDragOver = (e) => {
      e.preventDefault();
      setShowDropZone(true);
    };

    const handleDragLeave = (e) => {
      if (!e.relatedTarget || !e.relatedTarget.closest) {
        setShowDropZone(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setShowDropZone(false);

      try {
        const storyData = JSON.parse(e.dataTransfer.getData('application/json'));
        if (storyData && storyData.key) {
          // Find the story in the list
          const storyIndex = storyList.findIndex(key => key === storyData.key);
          if (storyIndex !== -1) {
            setCurrentStoryIndex(storyIndex);
            setRevealed(false);
            setResults(null);
            setFinalPoint(null);
            setObservingTarget(null);
            socket.emit("reset", { roomId });
          }
        }
      } catch (error) {
        console.log('Drop error:', error);
      }
    };

    const pokerContainer = document.querySelector('.poker-container');
    if (pokerContainer) {
      pokerContainer.addEventListener('dragover', handleDragOver);
      pokerContainer.addEventListener('dragleave', handleDragLeave);
      pokerContainer.addEventListener('drop', handleDrop);
    }

    return () => {
      if (pokerContainer) {
        pokerContainer.removeEventListener('dragover', handleDragOver);
        pokerContainer.removeEventListener('dragleave', handleDragLeave);
        pokerContainer.removeEventListener('drop', handleDrop);
      }
    };
  }, [storyList, roomId, socket]);

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
      socket.emit("vote", { roomId, point: null });
    } else {
      setSelectedCard(value);
      if (!votedUsers.includes(currentUserId)) {
        setVotedUsers(prev => [...prev, currentUserId]);
      }
      socket.emit("vote", { roomId, point: value });
    }
    // Save to localStorage immediately
    if (roomId) {
      const storyData = JSON.parse(localStorage.getItem(`storyData_${roomId}`) || '{}');
      storyData.selectedCard = value === selectedCard ? null : value;
      storyData.votedUsers = value === selectedCard
          ? votedUsers.filter(uid => uid !== currentUserId)
          : [...votedUsers, currentUserId];
      storyData.savedAt = new Date().toISOString();
      localStorage.setItem(`storyData_${roomId}`, JSON.stringify(storyData));
    }
  };

  const fetchAvailableTransitions = (key) => {
    if (!key || !isAdmin || !roomId || !jiraConnected) return;

    console.log(`Fetching transitions for ${key}`);
    setIsLoadingTransitions(true);
    socket.emit("getJiraTransitions", { roomId, issueKey: key });
  };

  const toggleObserver = (userId) => {
    if (!isAdmin) return;

    const newObserverState = !observers[userId];

    setObservers(prev => ({
      ...prev,
      [userId]: newObserverState
    }));

    if (userId === currentUserId && newObserverState) {
      setSelectedCard(null);
      socket.emit("vote", { roomId, point: null });
    }

    socket.emit("toggleObserver", { roomId, userId });
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
      Object.values(results.votes).length > 0 &&
      Object.values(results.votes).every(v => v === Object.values(results.votes)[0]);

  const observedVote = observingTarget && userVotes ? userVotes[observingTarget] : null;

  // Calculate stats when results are revealed
  const stats = results && revealed ? calculateStats(results.votes) : null;

  const handleReveal = () => {
    console.log("Reveal button clicked");
    socket.emit("reveal", { roomId });
    // Save to localStorage
  };

  const handleReset = () => {
    setRevealed(false);
    setResults(null);
    setSelectedCard(null);
    socket.emit("reset", { roomId });
  };

  const handleFinalize = () => {
    socket.emit("finalize", {
      roomId,
      data: { point: customPoint, jiraKey }
    });
    setFinalPoint(customPoint);

    // Save to localStorage
    if (roomId) {
      const storyData = JSON.parse(localStorage.getItem(`storyData_${roomId}`) || '{}');
      storyData.finalPoint = customPoint;
      storyData.savedAt = new Date().toISOString();
      localStorage.setItem(`storyData_${roomId}`, JSON.stringify(storyData));
    }
  };

  const handleSaveAcceptance = () => {
    socket.emit("updateAcceptanceCriteria", {
      roomId,
      jiraKey,
      acceptanceCriteria: editAcceptanceValue
    });
    setEditingAcceptance(false);
  };

  const handleSaveDescription = () => {
    socket.emit("updateDescription", {
      roomId,
      jiraKey,
      description: editDescriptionValue
    });
    setEditingDescription(false);
  };

  const handleSaveVisualAcceptance = () => {
    const wikiContent = htmlToJiraWiki(tiptapAcceptanceHtml);
    socket.emit("updateAcceptanceCriteria", {
      roomId,
      jiraKey,
      acceptanceCriteria: wikiContent
    });
    setEditingAcceptanceVisual(false);
  };

  const handleSaveVisualDescription = () => {
    const wikiContent = htmlToJiraWiki(tiptapDescriptionHtml);
    socket.emit("updateDescription", {
      roomId,
      jiraKey,
      description: wikiContent
    });
    setEditingDescriptionVisual(false);
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    setStoryStatus(newStatus);
    if (jiraKey && jiraConnected) {
      socket.emit("updateStoryStatus", {
        roomId,
        jiraKey,
        status: newStatus
      });
    }
  };

  // Extract project key from jiraKey (e.g. "EIPAAS-123" -> "EIPAAS")
  const getProjectKey = () => jiraKey ? jiraKey.split("-")[0] : null;

  const handleEditFixVersions = () => {
    const projectKey = getProjectKey();
    console.log("Opening fix versions editor, projectKey:", projectKey, "roomId:", roomId);
    setAllProjectVersions([]);
    setVersionsLoading(true);
    setSelectedVersionIds([]);
    setEditingFixVersions(true);
    if (projectKey) {
      socket.emit("getProjectVersions", { roomId, projectKey });
    }
  };

  // Once we get allProjectVersions, pre-select the currently set ones
  const handleVersionCheckboxChange = (versionId) => {
    setSelectedVersionIds(prev =>
      prev.includes(versionId) ? prev.filter(id => id !== versionId) : [...prev, versionId]
    );
  };

  const handleSaveFixVersions = () => {
    socket.emit("updateFixVersions", { roomId, jiraKey, versionIds: selectedVersionIds });
    setEditingFixVersions(false);
  };

  const handleEditAssignee = () => {
    setAssigneeSearchQuery("");
    setAssigneeSearchResults([]);
    setEditingAssignee(true);
  };

  const handleAssigneeSearch = (query) => {
    setAssigneeSearchQuery(query);
    if (query.length >= 2) {
      setAssigneeSearchLoading(true);
      socket.emit("searchJiraUsers", { roomId, query });
    } else {
      setAssigneeSearchResults([]);
    }
  };

  const handleSelectAssignee = (user) => {
    socket.emit("updateAssignee", { roomId, jiraKey, accountId: user.accountId });
    setEditingAssignee(false);
    setAssigneeSearchQuery("");
    setAssigneeSearchResults([]);
  };

  const handleEditPriority = () => {
    socket.emit("getPriorities", { roomId });
    setEditingPriority(true);
  };

  const handleEditSquad = () => {
    socket.emit("getSquadOptions", { roomId, jiraKey });
    setEditingSquad(true);
  };

  const handleEditResolution = () => {
    socket.emit("getResolutions", { roomId });
    setEditingResolution(true);
  };

  const handleEditSprint = () => {
    socket.emit("getSprints", { roomId, projectKey: getProjectKey() });
    setEditingSprint(true);
  };

  const handleEditEpicLink = () => {
    socket.emit("getEpics", { roomId, projectKey: getProjectKey() });
    setEditingEpicLink(true);
  };

  const handleDeleteAttachment = (attachmentId) => {
    if (!window.confirm("Delete this attachment?")) return;
    socket.emit("deleteAttachment", { roomId, jiraKey, attachmentId });
  };

  const handleAttachmentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAttachment(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";
      const res = await fetch(`${backendUrl}/api/attachment/${roomId}/${jiraKey}`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        alert("Upload failed: " + (err.error || res.statusText));
      } else {
        // Refresh issue details
        socket.emit("fetchJiraDetails", { roomId, jiraKey });
      }
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    }
  };

  // Add this function before handleLeaveRoom
  const copyRoomIdToClipboard = () => {
    navigator.clipboard.writeText(roomId);
    setRoomIdCopied(true);
    setTimeout(() => setRoomIdCopied(false), 2000);
  };

  const handleLeaveRoom = () => {
    // Notify server immediately so other participants' counts update right away
    socket.emit('leave-room', { roomId });
    // Clear admin data for this room
    if (roomId) {
      localStorage.removeItem(`admin_${roomId}`);
    }
    // Call the onLeaveRoom callback to update App state
    if (onLeaveRoom) {
      onLeaveRoom();
    }
    // Navigate to home page
    window.location.href = '/';
  };

  return (
      <div className={`poker-room ${storyList.length > 0 ? 'with-sidebar' : ''}`}>
        {/* Story Queue Sidebar */}
        {storyList.length > 0 && (
            <StoryQueue
                stories={storyList.map((key) => {
                  const details = allStoryDetails[key] || {};
                  const isCurrent = key === storyList[currentStoryIndex];

                  return {
                    key,
                    summary: details.summary || (isCurrent ? (issueTitle || `Loading ${key}...`) : `Loading ${key}...`),
                    type: details.type || (isCurrent ? issueType : null),
                    status: details.status || (isCurrent ? storyStatus : "To Do"),
                    point: isCurrent && finalPoint ? finalPoint : (storyVoteHistory[key]?.finalPoint || null)
                  };
                })}
                currentStoryIndex={currentStoryIndex}
                onSelectStory={(index) => {
                  // Save current story's vote state before switching
                  const currentKey = storyList[currentStoryIndex];
                  if (currentKey) {
                    setStoryVoteHistory(prev => ({
                      ...prev,
                      [currentKey]: { results, revealed, finalPoint, userVotes }
                    }));
                  }

                  const newKey = storyList[index];
                  const savedState = storyVoteHistory[newKey];

                  setCurrentStoryIndex(index);
                  setIssueTitle(null);
                  setAcceptanceCriteria(null);
                  setDescription(null);
                  setObservingTarget(null);
                  setEditingAcceptance(false);
                  setEditingAcceptanceVisual(false);
                  setEditingDescription(false);
                  setEditingDescriptionVisual(false);

                  if (newKey) {
                    setJiraKey(newKey);
                    if (jiraConnected) {
                      socket.emit("fetchJiraDetails", { roomId, jiraKey: newKey });
                    }
                  }

                  if (savedState && (savedState.results || savedState.finalPoint)) {
                    // Restore previously voted state for admin locally
                    viewingHistoryRef.current = true;
                    setRevealed(savedState.revealed || false);
                    setResults(savedState.results || null);
                    setFinalPoint(savedState.finalPoint || null);
                    setUserVotes(savedState.userVotes || {});
                    // Sync participants: reset then push historical results to them
                    socket.emit("reset", { roomId });
                    socket.emit("restore-story-state", {
                      roomId,
                      results: savedState.results,
                      revealed: savedState.revealed,
                      finalPoint: savedState.finalPoint
                    });
                  } else {
                    viewingHistoryRef.current = false;
                    setRevealed(false);
                    setResults(null);
                    setFinalPoint(null);
                    socket.emit("reset", { roomId });
                  }
                }}

                onAddStories={(newStories) => {
                  const keys = newStories.map(s => s.key);
                  setStoryList([...storyList, ...keys]);

                  // Immediately fetch details for the new stories
                  if (jiraConnected) {
                    setTimeout(() => {
                      socket.emit("fetchMultipleJiraDetails", {
                        roomId,
                        issueKeys: keys
                      });
                    }, 100);
                  }
                }}
                onRemoveStory={(index) => {
                  const removedKey = storyList[index];
                  const newList = [...storyList];
                  newList.splice(index, 1);
                  setStoryList(newList);

                  // Remove from allStoryDetails
                  setAllStoryDetails(prev => {
                    const updated = { ...prev };
                    delete updated[removedKey];
                    return updated;
                  });

                  // Adjust current index if needed
                  if (index === currentStoryIndex) {
                    setCurrentStoryIndex(Math.max(0, index - 1));
                  } else if (index < currentStoryIndex) {
                    setCurrentStoryIndex(currentStoryIndex - 1);
                  }
                }}
                onReorderStories={(newList) => {
                  console.log('Reordering stories:', newList);
                  console.log('Current storyList:', storyList);
                  console.log('Current index:', currentStoryIndex);

                  // Get the current key as a string
                  const currentKey = storyList[currentStoryIndex];
                  console.log('Looking for key:', currentKey);

                  // Find the new index by comparing the key property of each object
                  const newIndex = newList.findIndex(item => item.key === currentKey);
                  console.log('Found at index:', newIndex);

                  // Extract just the keys for the storyList state
                  const newKeyList = newList.map(item => item.key);
                  console.log('New key list:', newKeyList);

                  // Update the story list with just the keys
                  setStoryList(newKeyList);

                  // Update the current index if found
                  if (newIndex !== -1) {
                    console.log('Updating current index to:', newIndex);
                    setCurrentStoryIndex(newIndex);
                  }

                  // Save to localStorage
                  try {
                    const storyData = JSON.parse(localStorage.getItem(`storyData_${roomId}`) || '{}');
                    storyData.storyList = newKeyList;
                    storyData.currentStoryIndex = newIndex !== -1 ? newIndex : currentStoryIndex;
                    storyData.savedAt = new Date().toISOString();
                    localStorage.setItem(`storyData_${roomId}`, JSON.stringify(storyData));
                  } catch (error) {
                    console.error('Error saving to localStorage:', error);
                  }
                }}
                isAdmin={isAdmin}
                votes={userVotes}
                revealed={revealed}
                finalPoint={finalPoint}
            />
        )}
        <div className="poker-container">
          {/* Header */}
          <div className="room-header">
            <div className="room-title-container">
              <h1 className="room-title">
                {roomName ? `${roomName} - ` : ''}
                <span className="room-id-wrapper">
                Room: {roomId}
                  <button
                      className="copy-room-id-btn"
                      onClick={copyRoomIdToClipboard}
                      title="Copy room ID to clipboard"
                  >
                  {roomIdCopied ? <FaCopy className="copy-icon copied" /> : <FaRegCopy className="copy-icon" />}
                </button>
              </span>
              </h1>
              {roomName && <span className="room-name-badge">{roomName}</span>}
            </div>
            <div className="header-actions">
              {!jiraConnected && storyList.length > 0 && (
                  <div className="jira-warning-badge" title="Jira integration is not enabled for this room">
                    ⚠️ Jira Disabled
                  </div>
              )}
              {isCurrentUserObserver && (
                  <div className="observer-badge">
                    <FaUserSecret className="observer-badge-icon" />
                    <span>Observer Mode</span>
                  </div>
              )}
              {jiraKey && jiraConnected && (
                  <div className="story-badge" onClick={() => copyToClipboard(jiraKey)} title="Click to copy Jira key">
                    <span className="story-key">{jiraKey}</span>
                    {copied ? <FaCopy className="copy-icon copied" /> : <FaRegCopy className="copy-icon" />}
                  </div>
              )}
              <button className="leave-room-btn" onClick={handleLeaveRoom} title="Leave Room">
                🚪 Leave
              </button>
            </div>
          </div>
          {/* Reconnecting Message */}
          {isReconnecting && (
              <div className="reconnecting-message">
                <div className="spinner"></div>
                <p>Reconnecting to room...</p>
              </div>
          )}
          {/* Loading Indicator */}
          {isLoading && (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p>Loading your session...</p>
              </div>
          )}
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
              {isAdmin && (
                  <span className="observer-hint">(Click 👁️ to toggle observer mode)</span>
              )}
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
                    <div
                        key={userId}
                        className={`participant-card
                    ${hasVoted ? 'voted' : ''}
                    ${isObserver ? 'observer' : ''}
                    ${isObserving ? 'observing' : ''}
                    ${isCurrentUser ? 'current-user' : ''}
                  `}
                    >
                      {/* Top-right badges */}
                      <div className="participant-card__badges">
                        {userName === adminName && <span className="admin-crown" title="Room Admin">👑</span>}
                        {hasVoted && !isObserver && <FaCheck className="vote-check" />}
                      </div>

                      {/* Avatar */}
                      <div
                          className={`participant-avatar${userIcons[userId] ? ' has-icon' : ''}${isImageUrl(userIcons[userId]) ? ' has-img' : ''}`}
                          style={userIcons[userId] ? {} : { backgroundColor }}
                      >
                        {isImageUrl(userIcons[userId])
                          ? <img src={userIcons[userId]} alt={userName} className="avatar-img-display" />
                          : (userIcons[userId] || getInitials(userName))}
                        {isObserver && <FaUserSecret className="observer-icon" />}
                      </div>

                      {/* Name */}
                      <span className="participant-name" title={userName}>{userName}</span>

                      {/* Action buttons */}
                      <div className="participant-card__actions">
                        {isAdmin && (
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
                      </div>
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
                  {!jiraConnected && storyList.length > 0 && (
                      <span className="jira-disabled-badge">Jira integration disabled</span>
                  )}
                  {storyList.length > 0 && (
                      <div className="story-progress-container">
                        <button
                            className="progress-nav-btn"
                            onClick={() => {
                              if (currentStoryIndex > 0) {
                                // Save current story's vote state before navigating away
                                const currentKey = storyList[currentStoryIndex];
                                if (currentKey) {
                                  setStoryVoteHistory(prev => ({
                                    ...prev,
                                    [currentKey]: { results, revealed, finalPoint, userVotes }
                                  }));
                                }

                                const newIndex = currentStoryIndex - 1;
                                const newKey = storyList[newIndex];
                                const savedState = storyVoteHistory[newKey];

                                setCurrentStoryIndex(newIndex);
                                setIssueTitle(null);
                                setAcceptanceCriteria(null);
                                setDescription(null);
                                setObservingTarget(null);
                                setEditingAcceptance(false);
                                setEditingAcceptanceVisual(false);
                                setEditingDescription(false);
                                setEditingDescriptionVisual(false);

                                if (savedState && (savedState.results || savedState.finalPoint)) {
                                  // Restore previously voted state for admin locally
                                  viewingHistoryRef.current = true;
                                  setRevealed(savedState.revealed || false);
                                  setResults(savedState.results || null);
                                  setFinalPoint(savedState.finalPoint || null);
                                  setUserVotes(savedState.userVotes || {});
                                  // Sync participants: reset then push historical results to them
                                  socket.emit("reset", { roomId });
                                  socket.emit("restore-story-state", {
                                    roomId,
                                    results: savedState.results,
                                    revealed: savedState.revealed,
                                    finalPoint: savedState.finalPoint
                                  });
                                } else {
                                  viewingHistoryRef.current = false;
                                  setRevealed(false);
                                  setResults(null);
                                  setFinalPoint(null);
                                  socket.emit("reset", { roomId });
                                }
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
                                // Save current story's vote state before navigating away
                                const currentKey = storyList[currentStoryIndex];
                                if (currentKey) {
                                  setStoryVoteHistory(prev => ({
                                    ...prev,
                                    [currentKey]: { results, revealed, finalPoint, userVotes }
                                  }));
                                }

                                const newIndex = currentStoryIndex + 1;
                                const newKey = storyList[newIndex];
                                const savedState = storyVoteHistory[newKey];

                                setCurrentStoryIndex(newIndex);
                                setIssueTitle(null);
                                setAcceptanceCriteria(null);
                                setDescription(null);
                                setObservingTarget(null);
                                setEditingAcceptance(false);
                                setEditingAcceptanceVisual(false);
                                setEditingDescription(false);
                                setEditingDescriptionVisual(false);

                                if (savedState && (savedState.results || savedState.finalPoint)) {
                                  // Restore previously voted state for admin locally
                                  viewingHistoryRef.current = true;
                                  setRevealed(savedState.revealed || false);
                                  setResults(savedState.results || null);
                                  setFinalPoint(savedState.finalPoint || null);
                                  setUserVotes(savedState.userVotes || {});
                                  // Sync participants: reset then push historical results to them
                                  socket.emit("reset", { roomId });
                                  socket.emit("restore-story-state", {
                                    roomId,
                                    results: savedState.results,
                                    revealed: savedState.revealed,
                                    finalPoint: savedState.finalPoint
                                  });
                                } else {
                                  viewingHistoryRef.current = false;
                                  setRevealed(false);
                                  setResults(null);
                                  setFinalPoint(null);
                                  socket.emit("reset", { roomId });
                                }
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

                {jiraConnected && (
                    <div className="story-status-dropdown">
                      <label htmlFor="story-status-select">Status: </label>
                      {isLoadingTransitions ? (
                          <select disabled>
                            <option>Loading transitions...</option>
                          </select>
                      ) : (
                          <select
                              id="story-status-select"
                              value={storyStatus}
                              onChange={handleStatusChange}
                              onClick={() => {
                                // Fetch transitions when dropdown is clicked
                                if (jiraKey && isAdmin && jiraConnected) {
                                  fetchAvailableTransitions(jiraKey);
                                }
                              }}
                              disabled={!isAdmin && isCurrentUserObserver}
                          >
                            {availableTransitions.length > 0 ? (
                                availableTransitions.map(status => (
                                    <option key={status} value={status}>{status}</option>
                                ))
                            ) : (
                                <option value={storyStatus}>{storyStatus}</option>
                            )}
                          </select>
                      )}
                    </div>
                )}

                {jiraConnected && (reporter || assignee != null || fixVersions.length > 0 || attachments.length > 0 || isAdmin) && (
                    <div className="story-meta-fields">
                      <div className="story-meta-col">

                      {/* Reporter — read-only */}
                      {reporter && (
                          <div className="story-meta-item">
                            <span className="story-meta-label">Reporter:</span>
                            <span className="story-meta-value">{reporter}</span>
                          </div>
                      )}

                      {/* Assignee — editable */}
                      <div className="story-meta-item story-meta-item--editable">
                        <span className="story-meta-label">Assignee:</span>
                        {editingAssignee ? (
                            <div className="meta-edit-inline">
                              <input
                                  className="meta-edit-input"
                                  type="text"
                                  placeholder="Search by name..."
                                  value={assigneeSearchQuery}
                                  onChange={e => handleAssigneeSearch(e.target.value)}
                                  autoFocus
                              />
                              {assigneeSearchLoading && <span className="meta-spinner">…</span>}
                              {assigneeSearchResults.length > 0 && (
                                  <ul className="meta-user-dropdown">
                                    {assigneeSearchResults.map(u => (
                                        <li
                                            key={u.accountId}
                                            className="meta-user-option"
                                            onClick={() => handleSelectAssignee(u)}
                                        >
                                          {u.avatarUrl && <img src={u.avatarUrl} alt="" className="meta-user-avatar" />}
                                          <span className="meta-user-info">
                                            <span className="meta-user-name">{u.displayName}</span>
                                            {u.emailAddress && <span className="meta-user-email">{u.emailAddress}</span>}
                                          </span>
                                        </li>
                                    ))}
                                  </ul>
                              )}
                              <button className="meta-btn-cancel" onClick={() => setEditingAssignee(false)}>✕</button>
                            </div>
                        ) : (
                            <span className="story-meta-value">
                              {assignee || <em className="meta-none">Unassigned</em>}
                              {isAdmin && (
                                  <button className="meta-edit-btn" onClick={handleEditAssignee} title="Edit assignee">✎</button>
                              )}
                            </span>
                        )}
                      </div>

                      {/* Fix Version/s — editable */}
                      <div className="story-meta-item story-meta-item--editable">
                        <span className="story-meta-label">Fix Version/s:</span>
                        {editingFixVersions ? (
                            <div className="meta-edit-inline meta-edit-versions">
                              {versionsLoading ? (
                                  <span className="meta-spinner">Loading versions…</span>
                              ) : allProjectVersions.length === 0 ? (
                                  <span className="meta-spinner">No versions found for this project.</span>
                              ) : (
                                  <div className="meta-versions-list">
                                    {allProjectVersions.filter(v => !v.archived).map(v => (
                                        <label key={v.id} className="meta-version-checkbox">
                                          <input
                                              type="checkbox"
                                              checked={selectedVersionIds.includes(v.id)}
                                              onChange={() => handleVersionCheckboxChange(v.id)}
                                          />
                                          <span className={v.released ? "meta-version-released" : "meta-version-unreleased"}>
                                            {v.name}
                                          </span>
                                        </label>
                                    ))}
                                  </div>
                              )}
                              <div className="meta-edit-actions">
                                <button className="meta-btn-save" onClick={handleSaveFixVersions}>Save</button>
                                <button className="meta-btn-cancel" onClick={() => setEditingFixVersions(false)}>Cancel</button>
                              </div>
                            </div>
                        ) : (
                            <span className="story-meta-value">
                              {fixVersions.length > 0
                                  ? fixVersions.map((v, i) => <span key={i} className="story-version-tag">{v}</span>)
                                  : <em className="meta-none">None</em>
                              }
                              {isAdmin && (
                                  <button className="meta-edit-btn" onClick={handleEditFixVersions} title="Edit fix versions">✎</button>
                              )}
                            </span>
                        )}
                      </div>

                      {/* Attachments — upload + delete */}
                      <div className="story-meta-item story-meta-attachments story-meta-item--editable">
                        <span className="story-meta-label">Attachments:</span>
                        <div className="story-meta-value" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                          <div className="story-attachments-list">
                            {attachments.map((att) => (
                                <div key={att.id} className="story-attachment-entry">
                                  <a
                                      href={att.content}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="story-attachment-link"
                                      title={`${att.filename} (${(att.size / 1024).toFixed(1)} KB)`}
                                  >
                                    {att.thumbnail && att.mimeType?.startsWith('image/') ? (
                                        <img src={att.thumbnail} alt={att.filename} className="story-attachment-thumb" />
                                    ) : (
                                        <span className="story-attachment-icon">📎</span>
                                    )}
                                    <span className="story-attachment-name">{att.filename}</span>
                                  </a>
                                  {isAdmin && (
                                      <button
                                          className="meta-attachment-delete"
                                          onClick={() => handleDeleteAttachment(att.id)}
                                          title="Delete attachment"
                                      >✕</button>
                                  )}
                                </div>
                            ))}
                            {attachments.length === 0 && <em className="meta-none">No attachments</em>}
                          </div>
                          {isAdmin && (
                              <div className="meta-attachment-upload">
                                <input
                                    ref={attachmentInputRef}
                                    type="file"
                                    id="attachment-upload-input"
                                    style={{ display: 'none' }}
                                    onChange={handleAttachmentUpload}
                                />
                                <button
                                    className="meta-btn-upload"
                                    onClick={() => attachmentInputRef.current?.click()}
                                    disabled={uploadingAttachment}
                                >
                                  {uploadingAttachment ? "Uploading…" : "+ Attach file"}
                                </button>
                              </div>
                          )}
                        </div>
                      </div>

                      </div>{/* end story-meta-col left */}
                      <div className="story-meta-col">

                      {/* Priority */}
                      <div className="story-meta-item story-meta-item--editable">
                        <span className="story-meta-label">Priority:</span>
                        {editingPriority ? (
                            <div className="meta-edit-inline">
                              <select className="meta-edit-select" autoFocus
                                  onChange={e => {
                                    socket.emit("updatePriority", { roomId, jiraKey, priorityName: e.target.value });
                                    setEditingPriority(false);
                                  }}
                                  defaultValue=""
                              >
                                <option value="" disabled>Select priority…</option>
                                {allPriorities.map(p => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                              </select>
                              <button className="meta-btn-cancel" onClick={() => setEditingPriority(false)}>Cancel</button>
                            </div>
                        ) : (
                            <span className="story-meta-value">
                              {priority ? (
                                  <span className="meta-priority">
                                    {priorityIconUrl && <img src={priorityIconUrl} alt={priority} className="meta-priority-icon" />}
                                    {priority}
                                  </span>
                              ) : <em className="meta-none">None</em>}
                              {isAdmin && <button className="meta-edit-btn" onClick={handleEditPriority} title="Edit priority">✎</button>}
                            </span>
                        )}
                      </div>

                      {/* Resolution */}
                      <div className="story-meta-item story-meta-item--editable">
                        <span className="story-meta-label">Resolution:</span>
                        {editingResolution ? (
                            <div className="meta-edit-inline">
                              <select className="meta-edit-select" autoFocus
                                  onChange={e => {
                                    socket.emit("updateResolution", { roomId, jiraKey, resolutionName: e.target.value });
                                    setEditingResolution(false);
                                  }}
                                  defaultValue=""
                              >
                                <option value="" disabled>Select resolution…</option>
                                {allResolutions.map(r => (
                                    <option key={r.id} value={r.name}>{r.name}</option>
                                ))}
                              </select>
                              <button className="meta-btn-cancel" onClick={() => setEditingResolution(false)}>Cancel</button>
                            </div>
                        ) : (
                            <span className="story-meta-value">
                              {resolution || <em className="meta-none">Unresolved</em>}
                              {isAdmin && <button className="meta-edit-btn" onClick={handleEditResolution} title="Edit resolution">✎</button>}
                            </span>
                        )}
                      </div>

                      {/* Squad */}
                      <div className="story-meta-item story-meta-item--editable">
                        <span className="story-meta-label">Squad:</span>
                        {editingSquad ? (
                            <div className="meta-edit-inline">
                              <select className="meta-edit-select" autoFocus
                                  onChange={e => {
                                    socket.emit("updateSquad", { roomId, jiraKey, squadId: e.target.value });
                                    setEditingSquad(false);
                                  }}
                                  defaultValue=""
                              >
                                <option value="" disabled>Select squad…</option>
                                {squadOptions.map(s => (
                                    <option key={s.id} value={s.id}>{s.value}</option>
                                ))}
                              </select>
                              <button className="meta-btn-cancel" onClick={() => setEditingSquad(false)}>Cancel</button>
                            </div>
                        ) : (
                            <span className="story-meta-value">
                              {squad || <em className="meta-none">None</em>}
                              {isAdmin && <button className="meta-edit-btn" onClick={handleEditSquad} title="Edit squad">✎</button>}
                            </span>
                        )}
                      </div>

                      {/* Sprint */}
                      <div className="story-meta-item story-meta-item--editable">
                        <span className="story-meta-label">Sprint:</span>
                        {editingSprint ? (
                            <div className="meta-edit-inline">
                              <select className="meta-edit-select" autoFocus
                                  onChange={e => {
                                    socket.emit("updateSprint", { roomId, jiraKey, sprintId: parseInt(e.target.value) });
                                    setEditingSprint(false);
                                  }}
                                  defaultValue=""
                              >
                                <option value="" disabled>Select sprint…</option>
                                {allSprints.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} {s.state === 'active' ? '(active)' : ''}</option>
                                ))}
                              </select>
                              <button className="meta-btn-cancel" onClick={() => setEditingSprint(false)}>Cancel</button>
                            </div>
                        ) : (
                            <span className="story-meta-value">
                              {sprints.length > 0
                                  ? sprints.map(s => (
                                      <span key={s.id} className={`story-version-tag ${s.state === 'active' ? 'meta-sprint-active' : ''}`}>{s.name}</span>
                                  ))
                                  : <em className="meta-none">None</em>}
                              {isAdmin && <button className="meta-edit-btn" onClick={handleEditSprint} title="Edit sprint">✎</button>}
                            </span>
                        )}
                      </div>

                      {/* Epic Link */}
                      <div className="story-meta-item story-meta-item--editable">
                        <span className="story-meta-label">Epic Link:</span>
                        {editingEpicLink ? (
                            <div className="meta-edit-inline">
                              <select className="meta-edit-select" autoFocus
                                  onChange={e => {
                                    socket.emit("updateEpicLink", { roomId, jiraKey, epicKey: e.target.value || null });
                                    setEditingEpicLink(false);
                                  }}
                                  defaultValue={epicLinkKey || ""}
                              >
                                <option value="">None</option>
                                {allEpics.map(e => (
                                    <option key={e.key} value={e.key}>{e.key} – {e.name}</option>
                                ))}
                              </select>
                              <button className="meta-btn-cancel" onClick={() => setEditingEpicLink(false)}>Cancel</button>
                            </div>
                        ) : (
                            <span className="story-meta-value">
                              {epicLink
                                  ? (jiraBaseUrl && epicLinkKey
                                      ? <a
                                          href={`${jiraBaseUrl}/browse/${epicLinkKey}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="meta-epic-tag meta-epic-link"
                                          title={`${epicLinkKey} — open in Jira`}
                                        >{epicLink}</a>
                                      : <span className="meta-epic-tag">{epicLink}</span>)
                                  : <em className="meta-none">None</em>}
                              {isAdmin && <button className="meta-edit-btn" onClick={handleEditEpicLink} title="Edit epic link">✎</button>}
                            </span>
                        )}
                      </div>

                      </div>{/* end story-meta-col right */}
                    </div>
                )}

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
                        {isAdmin && !editingAcceptance && !editingAcceptanceVisual && jiraConnected && (
                            <div className="edit-buttons">
                              <button
                                  className="edit-btn"
                                  onClick={() => {
                                    if (showVisual) {
                                      setEditingAcceptanceVisual(true);
                                    } else {
                                      setEditingAcceptance(true);
                                      setEditAcceptanceValue(acceptanceCriteria);
                                    }
                                  }}
                                  title={showVisual ? "Edit in formatted mode" : "Edit in raw text mode"}
                              >
                                <FaPencilAlt /> Edit
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
                              <button className="btn-save" onClick={handleSaveAcceptance}>Save</button>
                              <button className="btn-cancel" onClick={() => setEditingAcceptance(false)}>Cancel</button>
                            </div>
                          </div>
                      ) : (
                          <div className="edit-mode visual-edit-mode">
                            <JiraEditor
                                content={jiraWikiToHtml(acceptanceCriteria)}
                                onChange={setTiptapAcceptanceHtml}
                                placeholder="Add acceptance criteria…"
                            />
                            <div className="edit-actions">
                              <button className="btn-save" onClick={handleSaveVisualAcceptance}>Save</button>
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
                        {isAdmin && !editingDescription && !editingDescriptionVisual && jiraConnected && (
                            <div className="edit-buttons">
                              <button
                                  className="edit-btn"
                                  onClick={() => {
                                    if (showVisual) {
                                      setEditingDescriptionVisual(true);
                                    } else {
                                      setEditingDescription(true);
                                      setEditDescriptionValue(description);
                                    }
                                  }}
                                  title={showVisual ? "Edit in formatted mode" : "Edit in raw text mode"}
                              >
                                <FaPencilAlt /> Edit
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
                              <button className="btn-save" onClick={handleSaveDescription}>Save</button>
                              <button className="btn-cancel" onClick={() => setEditingDescription(false)}>Cancel</button>
                            </div>
                          </div>
                      ) : (
                          <div className="edit-mode visual-edit-mode">
                            <JiraEditor
                                content={jiraWikiToHtml(description)}
                                onChange={setTiptapDescriptionHtml}
                                placeholder="Add description…"
                            />
                            <div className="edit-actions">
                              <button className="btn-save" onClick={handleSaveVisualDescription}>Save</button>
                              <button className="btn-cancel" onClick={() => setEditingDescriptionVisual(false)}>Cancel</button>
                            </div>
                          </div>
                      )}
                    </div>
                )}
              </div>
          )}

          {/* Story List Input (Admin only) */}
          {!isLoading && !isCurrentUserObserver && isAdmin && storyList.length === 0 && !jiraKey && !issueTitle &&
              !acceptanceCriteria && !description && (
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

          {/* Card Selection Area — hidden entirely for observers */}
          {!revealed && !isCurrentUserObserver && (
              <div className="voting-section">
                <h3>Select your estimate</h3>

                {/* Scale Info */}
                <div className="scale-info">
              <span className="scale-badge">
                  {ESTIMATION_SCALES[scaleType]?.name ||
                      (cards.length > 0 && cards[0] === 'XS' ? 'T-Shirt Sizes' :
                          cards.length > 0 && typeof cards[0] === 'string' ? 'Custom Text' :
                              ESTIMATION_SCALES.FIBONACCI.name)}
                </span>
                </div>

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

                {/* Reveal button - ALWAYS show for admin, regardless of observer mode */}
                {isAdmin && (
                    <button
                        className="btn-reveal"
                        onClick={handleReveal}
                    >
                      <FaEye /> Reveal Votes
                    </button>
                )}
              </div>
          )}

          {/* Reveal button for admin observers */}
          {!revealed && isCurrentUserObserver && isAdmin && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button className="btn-reveal" onClick={handleReveal}>
                  <FaEye /> Reveal Votes
                </button>
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
              </div>
          )}

          {/* Results Section */}
          {revealed && results && (
              <div className="results-section">
                <h3>Voting Results</h3>

                {allVotesSame ? (
                  <div className="perfect-agreement-outer">
                  <div className="perfect-agreement-hero">
                    {/* confetti rain */}
                    <div className="pa-confetti-field" aria-hidden="true">
                      {Array.from({length: 14}, (_, i) => (
                        <span key={i} className="pa-confetti-piece" style={{'--i': i}} />
                      ))}
                    </div>

                    <div className="pa-value-wrap">
                      <div className="pa-value">{Object.values(results.votes)[0]}</div>
                      <div className="pa-value-label">story points</div>
                    </div>

                    <div className="pa-title-row">
                      <div className="pa-title-wrap">
                        <span className="pa-trophy">🏆</span>
                        <h4 className="pa-title">Perfect Agreement</h4>
                        <span className="pa-trophy">🏆</span>
                      </div>
                    </div>

                    <div className="pa-footer">
                      <div className="pa-participants-label">
                        All {stats?.count} participant{stats?.count !== 1 ? 's' : ''} voted the same
                      </div>
                      <div className="pa-avatars">
                        {Object.entries(results.votes).map(([id], idx) => (
                          <div
                            key={id}
                            className="pa-avatar"
                            title={results.users[id]}
                            style={{ backgroundColor: getAvatarColor(results.users[id]), '--idx': idx }}
                          >
                            {(results.users[id] || '?')[0].toUpperCase()}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  </div>
                ) : (
                  stats && (
                    <div className="stats-wrapper">
                      <div className="stats-header">
                        <span className="stats-title">📊 Vote Analysis</span>
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
                  )
                )}

                <div className="votes-grid">
                  {Object.entries(results.votes)
                    .sort(([, a], [, b]) => {
                      const na = parseFloat(a), nb = parseFloat(b);
                      if (!isNaN(na) && !isNaN(nb)) return na - nb;
                      return String(a).localeCompare(String(b));
                    })
                    .map(([id, vote]) => {
                    const isObservedUser = observingTarget === id;
                    return (
                        <div
                            key={id}
                            className={`vote-item ${isObservedUser ? 'observed-vote-item' : ''}`}
                        >
                          <div
                              className={`voter-avatar${userIcons[id] ? ' has-icon' : ''}${isImageUrl(userIcons[id]) ? ' has-img' : ''}`}
                              style={userIcons[id] ? {} : { backgroundColor: getAvatarColor(results.users[id]) }}
                          >
                            {isImageUrl(userIcons[id])
                              ? <img src={userIcons[id]} alt={results.users[id]} className="avatar-img-display" />
                              : (userIcons[id] || getInitials(results.users[id]))}
                            {observers[id] && <FaUserSecret className="voter-observer-icon" />}
                          </div>
                          <span className="voter-name" title={results.users[id]}>{results.users[id]}</span>
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
                {isAdmin && (
                    <div className="admin-controls">
                      <div className="action-bar">

                        {/* Left: Reset Voting */}
                        <button className="action-btn action-btn--reset" onClick={handleReset}>
                          <FaUndo />
                          <span>Reset Voting</span>
                        </button>

                        {/* Centre: point input + Finalize */}
                        <div className="action-bar__finalize">
                          {storyList.length === 0 && (
                              <input
                                  type="text"
                                  placeholder="Jira Key"
                                  value={jiraKey}
                                  onChange={e => setJiraKey(e.target.value)}
                                  className="jira-input"
                                  disabled={!jiraConnected}
                              />
                          )}
                          <div className="action-bar__point-wrap">
                            <input
                                type={typeof cards[0] === 'number' ? 'number' : 'text'}
                                value={customPoint}
                                onChange={e => {
                                  const val = e.target.value;
                                  setCustomPoint(typeof cards[0] === 'number' ? Number(val) : val);
                                }}
                                min={0}
                                className="point-input"
                                placeholder="Points"
                            />
                            <button
                                className="action-btn action-btn--finalize"
                                onClick={handleFinalize}
                                disabled={!jiraConnected && storyList.length === 0}
                            >
                              <FaStar />
                              <span>Finalize {customPoint !== '' && customPoint !== 0 ? customPoint : ''}</span>
                            </button>
                          </div>
                        </div>

                        {/* Right: Reset List */}
                        {storyList.length > 0 && (
                            <button
                                className="action-btn action-btn--reset-list"
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
                                  socket.emit("reset", { roomId });
                                  localStorage.removeItem(`storyData_${roomId}`);
                                }}
                            >
                              <FaUndo />
                              <span>Reset List</span>
                            </button>
                        )}

                      </div>
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

        {/* Drop Zone Indicator */}
        {showDropZone && (
            <div className="drop-zone-indicator">
              <FaStar size={32} />
              <span>Drop to load story for voting</span>
            </div>
        )}
      </div>
  );
}
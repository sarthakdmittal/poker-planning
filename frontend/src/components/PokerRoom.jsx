import { useEffect, useState } from "react";
import { socket } from "../socket";
import Card from "./Card.jsx";
import { FaCheck } from "react-icons/fa";
import '../../jira-content.css';

const cards = [0, 1, 2, 3, 5, 8, 13, 21];

// Jira wiki markup to HTML parser with robust nested list support and correct bold handling
function jiraWikiToHtml(text) {
  if (!text) return "";

  const lines = text.split("\n");

  let html = "";
  let listStack = [];

  function applyInlineFormatting(str) {

    if (!str) return "";

    // {*}text{*} -> bold
    str = str.replace(/\{\*\}(.*?)\{\*\}/g, "<b>$1</b>");

    // +text+
    str = str.replace(/\+(.*?)\+/g, "<b>$1</b>");

    // *text*
    str = str.replace(/\*(.*?)\*/g, "<b>$1</b>");

    // italic
    str = str.replace(/_(.*?)_/g, "<i>$1</i>");

    // inline code
    str = str.replace(/\{\{(.*?)\}\}/g, "<code>$1</code>");

    // {}text{}
    str = str.replace(/\{\}(.*?)\{\}/g, "<code>$1</code>");

    // color
    str = str.replace(
      /\{color:(#[0-9a-fA-F]{6})\}(.*?)\{color\}/g,
      '<span style="color:$1">$2</span>'
    );

    // links
    str = str.replace(
      /\[(.+?)\|([^\]]+)]/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    return str;
  }

  for (let line of lines) {

    line = line.trim();

    // -----------------------
    // Headings
    // -----------------------

    const headingMatch = line.match(/^h([1-6])\.\s+(.*)/);

    if (headingMatch) {

      while (listStack.length) {
        html += `</${listStack.pop()}>`;
      }

      const level = headingMatch[1];
      const content = applyInlineFormatting(headingMatch[2]);

      html += `<h${level}>${content}</h${level}>`;
      continue;
    }

    // -----------------------
    // Bullet lists
    // -----------------------

    const bulletMatch = line.match(/^(\*+)\s+(.*)/);

    const numMatch = line.match(/^(#+)\s+(.*)/);

    if (bulletMatch || numMatch) {

      const chars = bulletMatch ? bulletMatch[1] : numMatch[1];
      const rawContent = bulletMatch ? bulletMatch[2] : numMatch[2];

    // Ignore empty bullets like "*"
      if (!rawContent.trim()) {
        continue;
      }

      const indent = chars.length;
      const listType = bulletMatch ? "ul" : "ol";

      while (listStack.length < indent) {
        html += `<${listType}>`;
        listStack.push(listType);
      }

      while (listStack.length > indent) {
        html += `</${listStack.pop()}>`;
      }

      const content = applyInlineFormatting(rawContent);

      html += `<li>${content}</li>`;
      continue;
    }

    // -----------------------
    // Code block
    // -----------------------

    const codeBlockMatch = line.match(/^\{code(:[^\}]*)?\}/);

    if (codeBlockMatch) {
      html += `<pre class="jira-code"><code>`;
      continue;
    }

    // -----------------------
    // Normal paragraph
    // -----------------------

    while (listStack.length) {
      html += `</${listStack.pop()}>`;
    }

    if (!line) continue;

    html += `<p>${applyInlineFormatting(line)}</p>`;
  }

  while (listStack.length) {
    html += `</${listStack.pop()}>`;
  }

  return html;
}

// Jira wiki markup to indented plain text (for Text mode)
function jiraWikiToIndentedText(text) {
  if (!text) return "";
  const lines = text.split(/\r?\n/);
  let result = [];
  let lastIndent = 0;
  lines.forEach(line => {
    const match = line.match(/^(\*+)(\s+)(.*)$/);
    if (match) {
      const stars = match[1].length;
      const content = match[3];
      // Remove leading * from content if present (e.g. '*Mandatory' -> 'Mandatory')
      let cleanContent = content.replace(/^(\*+)(\s*)/, '');
      result.push(`${'\t'.repeat(stars - 1)}${cleanContent}`);
      lastIndent = stars - 1;
    } else {
      // If the line is not a list, keep as is
      result.push(line);
      lastIndent = 0;
    }
  });
  return result.join("\n");
}

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
  const [showVisual, setShowVisual] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [storyList, setStoryList] = useState([]); // List of Jira keys
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [storyListInput, setStoryListInput] = useState(""); // For Sarthak to input
  // Add state for editing description
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescriptionValue, setEditDescriptionValue] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);
  const [votedUsers, setVotedUsers] = useState([]); // Track userIds who have voted
  const [issueType, setIssueType] = useState(null); // New state for issue type

  useEffect(() => {
    socket.on("users", setUsers);
    socket.on("reveal", (data) => {
      setResults(data);
      setRevealed(true);
    });
    socket.on("final", (data) => {
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
      console.log("Received jiraDetails:", details); // DEBUG LOG
      setIssueTitle(details.summary);
      setAcceptanceCriteria(details.acceptanceCriteria);
      setDescription(details.description);
      setIssueType(details.issueType); // Set issue type from details
      setEditingAcceptance(false);
    });
    socket.on("reset", () => {
      setRevealed(false);
      setResults(null);
      setFinalPoint(null);
      setVotedUsers([]); // Reset voted users on reset
      // Do NOT clear issueTitle, acceptanceCriteria, or description here
    });
    socket.on("admin", setAdminName);
    // Clean up listeners on unmount
    return () => {
      socket.off("users", setUsers);
      socket.off("reveal");
      socket.off("final");
      socket.off("jiraDetails");
      socket.off("reset");
      socket.off("admin", setAdminName);
    };
  }, []);

  const isAdmin = name && adminName && name === adminName;

  // Only Sarthak can finalize and go to next story
  const isSarthak = name === "Sarthak";

  // When Sarthak sets a new story list, set jiraKey to the first one
  useEffect(() => {
    if (storyList.length > 0 && currentStoryIndex < storyList.length) {
      setJiraKey(storyList[currentStoryIndex]);
    }
  }, [storyList, currentStoryIndex]);

  // Fetch Jira details whenever jiraKey changes (for Next/Previous Story)
  useEffect(() => {
    if (jiraKey) {
      socket.emit("fetchJiraDetails", jiraKey);
    }
  }, [jiraKey]);

  // Reset selected card on reset or story change
  useEffect(() => {
    setSelectedCard(null);
  }, [revealed, jiraKey]);

  // Listen for votes and update votedUsers state for tick display
  useEffect(() => {
    socket.on("voteUpdate", (data) => {
      if (data && data.votes) {
        setVotedUsers(Object.keys(data.votes));
      }
      setResults(data);
    });
    return () => {
      socket.off("voteUpdate");
    };
  }, []);

  return (
    <div>
      <h2>Planning Poker</h2>

      <h3>Participants</h3>
      <ul>
        {Object.entries(users).map(([userId, userName]) => (
          <li key={userId} style={{display: 'flex', alignItems: 'center'}}>
            {userName}
            {/* Show tick for any user who has voted (selected a card), visible to all participants */}
            {!revealed && votedUsers.includes(userId) && (
              <FaCheck style={{color: 'green', marginLeft: 6}} />
            )}
          </li>
        ))}
      </ul>

      {isSarthak && storyList.length === 0 && (
        <div style={{marginBottom: 16}}>
          <h4>Enter list of Jira Issue Keys (one per line):</h4>
          <textarea
            rows={5}
            style={{width: 300, fontFamily: 'inherit'}}
            value={storyListInput}
            onChange={e => setStoryListInput(e.target.value)}
            placeholder={"E.g.\nPROJ-123\nPROJ-124\nPROJ-125"}
          />
          <br />
          <button onClick={() => {
            const list = storyListInput.split(/\r?\n|,|\s+/).map(s => s.trim()).filter(Boolean);
            setStoryList(list);
            setCurrentStoryIndex(0);
          }} disabled={!storyListInput.trim()}>Set Story List</button>
        </div>
      )}
      {/* Always show story number and summary to all users if storyList is set and jiraKey is present */}
      {storyList.length > 0 && jiraKey && (
        <div style={{marginTop: 8, marginBottom: 4, fontWeight: 'bold'}}>
          Story {currentStoryIndex + 1} of {storyList.length}: <b>{jiraKey}</b>
        </div>
      )}
      {/* Show issue type above summary */}
      {issueType && (
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
          Issue Type: {issueType}
        </div>
      )}
      {/* Show summary */}
      {issueTitle && (
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
          Summary: {issueTitle}
        </div>
      )}

      {isSarthak && storyList.length > 0 && (
        <div style={{marginBottom: 8}}>
          <button style={{marginLeft:8}} onClick={() => {
            setStoryList([]);
            setStoryListInput("");
            setCurrentStoryIndex(0);
            setJiraKey("");
            // Reset voting state when list is reset
            setRevealed(false);
            setResults(null);
            setFinalPoint(null);
            setIssueTitle(null);
            setAcceptanceCriteria(null);
            setDescription(null);
            socket.emit("reset");
          }}>Reset List</button>
        </div>
      )}

      {/* Show Acceptance Criteria controls, only if available */}
      {(acceptanceCriteria || description) && (
        <div style={{marginTop: 16, marginBottom: 16, background: '#f8f8f8', padding: 12, borderRadius: 6}}>
          {acceptanceCriteria && (
            <button onClick={() => setShowAcceptance(v => !v)}>
              {showAcceptance ? "Hide Acceptance Criteria" : "View Acceptance Criteria"}
            </button>
          )}

          <br />
          <br />
          {description && (
            <button onClick={() => setShowDescription(v => !v)}>
              {showDescription ? "Hide Description" : "View Description"}
            </button>
          )}

      <br />
      <br />
      <button style={{marginTop:8}} onClick={() => setShowVisual(v => !v)}>
                  {showVisual ? "Text" : "Visual"}
                </button>
          {showAcceptance && (
            <div style={{marginTop: 8}}>
              <strong>Acceptance Criteria:</strong>
              {!editingAcceptance ? (
                <>
                  {showVisual ? (
                    <div
                      className="jira-content"
                      style={{ maxWidth: "900px" }}
                      dangerouslySetInnerHTML={{ __html: jiraWikiToHtml(acceptanceCriteria) }}
                    />
                  ) : (
                    <div style={{marginTop: 6, whiteSpace: 'pre-line'}}>{jiraWikiToIndentedText(acceptanceCriteria)}</div>
                  )}
                  {isSarthak && (
                    <button style={{marginTop:8}} onClick={() => {
                      setEditingAcceptance(true);
                      setEditAcceptanceValue(acceptanceCriteria);
                    }}>Edit</button>
                  )}
                </>
              ) : (
                <div style={{marginTop: 6}}>
                  <textarea
                    value={editAcceptanceValue}
                    onChange={e => setEditAcceptanceValue(e.target.value)}
                    rows={8}
                    style={{width: '100%', fontFamily: 'inherit'}}
                  />
                  <div style={{marginTop:8}}>
                    <button onClick={() => {
                      socket.emit("updateAcceptanceCriteria", { jiraKey, acceptanceCriteria: editAcceptanceValue });
                      setEditingAcceptance(false);
                    }}>Save</button>
                    <button style={{marginLeft:8}} onClick={() => setEditingAcceptance(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {showDescription && description && (
            <div style={{marginTop: 16}}>
              <strong>Description:</strong>
              {!editingDescription ? (
                <>
                  {showVisual ? (
                    <div
                      className="jira-content"
                      dangerouslySetInnerHTML={{ __html: jiraWikiToHtml(description) }}
                    />
                  ) : (
                    <div style={{marginTop: 6, whiteSpace: 'pre-line'}}>{jiraWikiToIndentedText(description)}</div>
                  )}
                  {isSarthak && (
                    <button style={{marginTop:8}} onClick={() => {
                      setEditingDescription(true);
                      setEditDescriptionValue(description);
                    }}>Edit</button>
                  )}
                </>
              ) : (
                <div style={{marginTop: 6}}>
                  <textarea
                    value={editDescriptionValue}
                    onChange={e => setEditDescriptionValue(e.target.value)}
                    rows={8}
                    style={{width: '100%', fontFamily: 'inherit'}}
                  />
                  <div style={{marginTop:8}}>
                    <button onClick={() => {
                      socket.emit("updateDescription", { jiraKey, description: editDescriptionValue });
                      setEditingDescription(false);
                    }}>Save</button>
                    <button style={{marginLeft:8}} onClick={() => setEditingDescription(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Only show card selection and Reveal button if not revealed */}
      {!revealed && (
        <>
          <h3>Select a card</h3>
          {cards.map((c) => (
            <Card
              key={c}
              value={c}
              onClick={(v) => {
                if (selectedCard === v) {
                  setSelectedCard(null);
                  // Remove current user's userId from votedUsers for immediate tick update
                  const myId = Object.keys(users).find(uid => users[uid] === name);
                  if (myId) {
                    setVotedUsers(prev => prev.filter(uid => uid !== myId));
                  }
                  socket.emit("vote", null);
                } else {
                  setSelectedCard(v);
                  // Optimistically add current user to votedUsers
                  const myId = Object.keys(users).find(uid => users[uid] === name);
                  if (myId && !votedUsers.includes(myId)) {
                    setVotedUsers(prev => [...prev, myId]);
                  }
                  socket.emit("vote", v);
                }
              }}
              selected={selectedCard === c}
            />
          ))}
          <br />
          {isSarthak && (
            <button onClick={() => socket.emit("reveal")}>Reveal</button>
          )}
        </>
      )}

      {revealed && results && (
        <>
          <h3>Votes</h3>
          <ul>
            {Object.entries(results.votes).map(([id, v]) => (
              <li key={id}>{results.users[id]}: {v}</li>
            ))}
          </ul>

          {/* Reset Voting button for Sarthak (admin) only */}
          {isSarthak && (
            <button
              style={{marginBottom: 12, marginTop: 8, background: '#ffe0e0', color: '#b71c1c', border: '1px solid #b71c1c'}}
              onClick={() => {
                setRevealed(false);
                setResults(null);
                setSelectedCard(null);
                // Do NOT clear issueTitle, acceptanceCriteria, or description here
                socket.emit("reset");
              }}
            >
              Reset Voting
            </button>
          )}

          {isSarthak && (
            <>
              {/* Only show Jira key input if not using storyList, or allow override */}
              {storyList.length === 0 && (
                <input
                  type="text"
                  placeholder="Jira Issue Key (e.g. PROJ-123)"
                  value={jiraKey}
                  onChange={e => setJiraKey(e.target.value)}
                  style={{ width: 180, marginRight: 8 }}
                />
              )}
              <input
                type="number"
                value={customPoint}
                onChange={e => setCustomPoint(Number(e.target.value))}
                style={{ width: 60, marginRight: 8 }}
                min={0}
              />
              <button onClick={() => socket.emit("finalize", { point: customPoint, jiraKey })}>
                Finalize {customPoint}
              </button>
              <button
                onClick={() => {
                  // Previous Story: decrement index and auto-fetch previous Jira key
                  if (storyList.length > 0 && currentStoryIndex > 0) {
                    setCurrentStoryIndex(currentStoryIndex - 1);
                    setRevealed(false); // Reset voting state for previous story
                    setResults(null);
                    setFinalPoint(null);
                    setIssueTitle(null);
                    setAcceptanceCriteria(null);
                    setDescription(null);
                    socket.emit("reset"); // Emit reset so all clients reset UI
                  }
                }}
                disabled={storyList.length === 0 || currentStoryIndex === 0}
                style={{marginRight: 8}}
              >
                Previous Story
              </button>
              <button
                onClick={() => {
                  // Next Story: increment index and auto-fetch next Jira key
                  if (storyList.length > 0 && currentStoryIndex < storyList.length - 1) {
                    setCurrentStoryIndex(currentStoryIndex + 1);
                    setRevealed(false); // Reset voting state for new story
                    setResults(null);
                    setFinalPoint(null);
                    setIssueTitle(null);
                    setAcceptanceCriteria(null);
                    setDescription(null);
                    socket.emit("reset"); // Emit reset so all clients reset UI
                  } else {
                    socket.emit("reset");
                  }
                }}
                disabled={storyList.length > 0 && currentStoryIndex >= storyList.length - 1}
              >
                Next Story
              </button>
            </>
          )}
        </>
      )}

      {finalPoint && (
        <div>
          <h2>Final Story Point: {finalPoint}</h2>
          {issueTitle && <h3>Issue Title: {issueTitle}</h3>}
          {acceptanceCriteria && (
            <div style={{marginTop: 16, marginBottom: 16, background: '#f8f8f8', padding: 12, borderRadius: 6}}>
              <button onClick={() => setShowAcceptance(v => !v)}>
                {showAcceptance ? "Hide Acceptance Criteria" : "View Acceptance Criteria"}
              </button>
              <button style={{marginLeft:8}} onClick={() => setShowVisual(v => !v)}>
                {showVisual ? "Text" : "Visual"}
              </button>
              {showAcceptance && (
                <div style={{marginTop: 8}}>
                  <strong>Acceptance Criteria:</strong>
                  {!editingAcceptance ? (
                    <>
                      {showVisual ? (
                        <div
                          className="jira-content"
                          style={{ maxWidth: "900px" }}
                          dangerouslySetInnerHTML={{ __html: jiraWikiToHtml(acceptanceCriteria) }}
                        />
                      ) : (
                        <div style={{marginTop: 6, whiteSpace: 'pre-line'}}>{jiraWikiToIndentedText(acceptanceCriteria)}</div>
                      )}
                      {isSarthak && (
                        <button style={{marginTop:8}} onClick={() => {
                          setEditingAcceptance(true);
                          setEditAcceptanceValue(acceptanceCriteria);
                        }}>Edit</button>
                      )}
                    </>
                  ) : (
                    <div style={{marginTop: 6}}>
                      <textarea
                        value={editAcceptanceValue}
                        onChange={e => setEditAcceptanceValue(e.target.value)}
                        rows={8}
                        style={{width: '100%', fontFamily: 'inherit'}}
                      />
                      <div style={{marginTop:8}}>
                        <button onClick={() => {
                          socket.emit("updateAcceptanceCriteria", { jiraKey, acceptanceCriteria: editAcceptanceValue });
                          setEditingAcceptance(false);
                        }}>Save</button>
                        <button style={{marginLeft:8}} onClick={() => setEditingAcceptance(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

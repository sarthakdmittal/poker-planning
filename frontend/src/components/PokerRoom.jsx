import { useEffect, useState } from "react";
import { socket } from "../socket";
import Card from "./Card.jsx";

const cards = [0, 1, 2, 3, 5, 8, 13, 21];

// Jira wiki markup to HTML parser with robust nested list support and correct bold handling
function jiraWikiToHtml(text) {
  if (!text) return "";

  // Convert h1. ... h6. to headings
  text = text.replace(/^h([1-6])\.\s*(.*)$/gm, (m, l, t) => `<h${l}>${t.trim()}</h${l}>`);
  // Convert +Heading+ to <h3>Heading</h3> (if on its own line)
  text = text.replace(/^\+(.+?)\+$/gm, (m, t) => `<h3>${t.trim()}</h3>`);
  // Convert +Heading+ (inline) to <b>Heading</b>
  text = text.replace(/\+([^\n+]+)\+/g, (m, t) => `<b>${t.trim()}</b>`);

  // Nested lists (bulleted only, with * for parent, ** for child, etc.)
  const lines = text.split(/\r?\n/);
  let html = '';
  let listStack = [];
  function formatInline(content) {
    // Bold { * } or *text* (only if not at start of line)
    content = content.replace(/\{\*\}(.*?)\{\*\}/g, '<b>$1</b>');
    // Only bold *text* if not at start (avoid list marker)
    content = content.replace(/(^|\s)\*(\S(.*?\S)?)\*(?=\s|$)/g, '$1<b>$2</b>');
    // Italic _text_
    content = content.replace(/_(\S(.*?\S)?)_/g, '<i>$1</i>');
    // Monospace/code {{text}}
    content = content.replace(/\{\{(.*?)\}\}/g, '<code>$1</code>');
    // Links [text|url]
    content = content.replace(/\[(.+?)\|([^\]]+)]/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return content;
  }
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Match * ... (any number of * for nesting)
    let match = line.match(/^(\*{1,})\s+(.*)$/);
    if (match) {
      const stars = match[1];
      const content = match[2];
      const indent = stars.length;
      // Open new lists if needed
      while (listStack.length < indent) {
        html += '<ul>';
        listStack.push('ul');
      }
      // Close lists if dedented
      while (listStack.length > indent) {
        html += `</ul>`;
        listStack.pop();
      }
      // Parse inline formatting inside list item
      let parsedContent = formatInline(content);
      html += `<li>${parsedContent}</li>`;
    } else {
      // Close any open lists
      while (listStack.length) {
        html += `</ul>`;
        listStack.pop();
      }
      // Paragraphs and headings
      if (line.trim() === '') {
        html += '';
      } else if (/^<h[1-6]>/.test(line) || /^<h3>/.test(line)) {
        html += line;
      } else {
        html += `<p>${formatInline(line)}</p>`;
      }
    }
  }
  // Close any remaining open lists
  while (listStack.length) {
    html += `</ul>`;
    listStack.pop();
  }
  // Remove empty <p></p>
  html = html.replace(/<p>\s*<\/p>/g, '');
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
      setEditingAcceptance(false);
    });
    socket.on("reset", () => {
      setRevealed(false);
      setResults(null);
      setFinalPoint(null);
      setIssueTitle(null);
      setAcceptanceCriteria(null);
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

  return (
    <div>
      <h2>Planning Poker</h2>

      <h3>Participants</h3>
      <ul>
        {Object.values(users).map((u) => (
          <li key={u}>{u}</li>
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
      {isSarthak && storyList.length > 0 && (
        <div style={{marginBottom: 8}}>
          <span>Story {currentStoryIndex + 1} of {storyList.length}: <b>{storyList[currentStoryIndex]}</b></span>
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

      {/* Show summary as soon as jiraKey is entered and summary is available */}
      {jiraKey && issueTitle && (
        <div style={{marginTop: 8, marginBottom: 8, fontWeight: 'bold'}}>
          Summary: {issueTitle}
        </div>
      )}

      {!revealed && (
        <>
          {/* Acceptance Criteria controls, only if available */}
          {acceptanceCriteria && (
            <div style={{marginTop: 16, marginBottom: 16, background: '#f8f8f8', padding: 12, borderRadius: 6}}>
              <button onClick={() => setShowAcceptance(v => !v)}>
                {showAcceptance ? "Hide Acceptance Criteria" : "View Acceptance Criteria"}
              </button>
              <button style={{marginLeft:8}} onClick={() => setShowVisual(v => !v)}>
                {showVisual ? "Text" : "Visual"}
              </button>
              {description && (
                <button style={{marginLeft:8}} onClick={() => setShowDescription(v => !v)}>
                  {showDescription ? "Hide Description" : "View Description"}
                </button>
              )}
              {showAcceptance && (
                <div style={{marginTop: 8}}>
                  <strong>Acceptance Criteria:</strong>
                  {!editingAcceptance ? (
                    <>
                      {showVisual ? (
                        <div style={{marginTop: 6}} dangerouslySetInnerHTML={{__html: jiraWikiToHtml(acceptanceCriteria)}} />
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
                        <div style={{marginTop: 6}} dangerouslySetInnerHTML={{__html: jiraWikiToHtml(description)}} />
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

          {/* Always show card selection and Reveal button, even if acceptanceCriteria is not loaded yet */}
          <h3>Select a card</h3>
          {cards.map((c) => (
            <Card
              key={c}
              value={c}
              onClick={(v) => {
                setSelectedCard(v);
                socket.emit("vote", v);
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
                        <div style={{marginTop: 6}} dangerouslySetInnerHTML={{__html: jiraWikiToHtml(acceptanceCriteria)}} />
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

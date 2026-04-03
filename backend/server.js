const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const {
  createJiraClient,
  updateJiraStoryPoints,
  updateJiraDescription,
  getJiraIssueDetails,
  updateJiraAcceptanceCriteria,
  updateJiraStatus,
  getJiraTransitions
} = require("./jira-api");

const crypto = require("crypto");

const app = express();
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://your-vercel-app.vercel.app"
  ],
  credentials: true
}));

app.get("/", (req, res) => {
  res.send("Server is running");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://your-vercel-app.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Store rooms in memory
let rooms = {};

// Store Jira clients per room
const jiraClients = new Map();

// Helper function to get Jira client for a room
function getJiraClientForRoom(roomId) {
  return jiraClients.get(roomId);
}

io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);

    Object.keys(rooms).forEach(roomId => {
      if (rooms[roomId].users[socket.id]) {
        const leavingName = rooms[roomId].users[socket.id];
        const wasAdmin = rooms[roomId].admin === leavingName;

        // Remove the user
        delete rooms[roomId].users[socket.id];
        delete rooms[roomId].votes[socket.id];
        delete rooms[roomId].observers[socket.id];

        // If admin left, mark disconnection
        if (wasAdmin) {
          console.log(`Admin ${leavingName} left room ${roomId}`);
          rooms[roomId].adminDisconnected = true;
        }

        // Emit updates
        io.to(roomId).emit("users", rooms[roomId].users);
        io.to(roomId).emit("admin", rooms[roomId].admin);
        io.to(roomId).emit("observersUpdate", rooms[roomId].observers);
        io.to(roomId).emit("roomInfo", {
          roomId: roomId,
          roomName: rooms[roomId].name,
          users: rooms[roomId].users,
          estimationScale: rooms[roomId].estimationScale,
          jiraConnected: rooms[roomId].jiraConnected
        });

        // Clean up empty rooms after 5 minutes
        if (Object.keys(rooms[roomId].users).length === 0) {
          setTimeout(() => {
            if (rooms[roomId] && Object.keys(rooms[roomId].users).length === 0) {
              // Clean up Jira client
              jiraClients.delete(roomId);
              delete rooms[roomId];
              console.log(`Room ${roomId} deleted (empty)`);
            }
          }, 5 * 60 * 1000);
        }
      }
    });
  });

  // Handle room creation with Jira credentials
  socket.on("create-room", ({ userName, roomName, roomId, estimationScale, jiraEmail, jiraToken }) => {
    console.log("===== CREATE ROOM =====");
    console.log("Jira credentials provided:", !!jiraEmail && !!jiraToken);

    // Create Jira client if credentials provided
    let jiraClient = null;
    let jiraConnected = false;

    if (jiraEmail && jiraToken) {
      try {
        jiraClient = createJiraClient(jiraEmail, jiraToken);
        jiraConnected = true;
        console.log(`✅ Jira client created for room ${roomId}`);
      } catch (error) {
        console.error(`❌ Failed to create Jira client:`, error.message);
      }
    }

    // Generate a secret token that only the real admin will have
    const adminSecret = crypto.randomBytes(16).toString("hex");

    // Create room
    rooms[roomId] = {
      name: roomName,
      users: {},
      votes: {},
      revealed: false,
      finalPoint: null,
      admin: userName,
      adminSecret,
      observers: {},
      createdBy: socket.id,
      createdAt: new Date().toISOString(),
      adminSocketId: socket.id,
      estimationScale: estimationScale || {
        type: 'FIBONACCI',
        cards: [0, 1, 2, 3, 5, 8, 13, 21]
      },
      jiraEmail: jiraEmail || null,
      jiraToken: jiraToken || null,
      jiraConnected: jiraConnected,
      // Add stories array for simple mode
      stories: [],
      currentStoryIndex: 0
    };

    // Store Jira client if created
    if (jiraClient) {
      jiraClients.set(roomId, jiraClient);
    }

    // Add creator to room
    rooms[roomId].users[socket.id] = userName;
    rooms[roomId].observers[socket.id] = false;

    socket.join(roomId);

    // Send confirmation — include adminSecret so creator can store it locally
    socket.emit("room-created", { roomId, roomName, adminSecret });

    // Broadcast room data
    io.to(roomId).emit("users", rooms[roomId].users);
    io.to(roomId).emit("admin", rooms[roomId].admin);
    io.to(roomId).emit("observersUpdate", rooms[roomId].observers);
    io.to(roomId).emit("roomInfo", {
      roomId: roomId,
      roomName: rooms[roomId].name,
      users: rooms[roomId].users,
      estimationScale: rooms[roomId].estimationScale,
      jiraConnected: rooms[roomId].jiraConnected,
      stories: rooms[roomId].stories,
      currentStoryIndex: rooms[roomId].currentStoryIndex
    });

    console.log(`Room created: ${roomId} (${roomName}) by ${userName}`);
  });

  // Handle story updates (for simple mode)
  socket.on("update-stories", ({ roomId, stories, currentStoryIndex }) => {
    if (rooms[roomId] && rooms[roomId].admin === rooms[roomId].users[socket.id]) {
      // Only admin can update stories
      rooms[roomId].stories = stories;
      rooms[roomId].currentStoryIndex = currentStoryIndex;

      // Broadcast updated stories to all participants in the room
      io.to(roomId).emit("stories-updated", {
        stories: stories,
        currentStoryIndex: currentStoryIndex
      });

      console.log(`Stories updated in room ${roomId}: ${stories.length} stories`);
    }
  });

  // Handle request for current stories (when a user joins)
  socket.on("request-stories", ({ roomId }) => {
    if (rooms[roomId]) {
      socket.emit("stories-updated", {
        stories: rooms[roomId].stories || [],
        currentStoryIndex: rooms[roomId].currentStoryIndex || 0
      });
      console.log(`Sent stories to joining user in room ${roomId}`);
    }
  });

  // Handle join room
  socket.on("join-room", ({ userName, roomId, adminSecret }) => {
    roomId = roomId.toUpperCase();
    console.log(`Join-room attempt: ${userName} trying to join ${roomId}`);

    if (rooms[roomId]) {
      // Block impersonation: if the name matches the admin's reserved name,
      // require the correct adminSecret — but only if the room was created with one
      if (userName === rooms[roomId].admin && rooms[roomId].adminSecret) {
        if (!adminSecret || adminSecret !== rooms[roomId].adminSecret) {
          console.log(`Blocked impersonation attempt for admin "${userName}" in room ${roomId}`);
          socket.emit("error", { message: `The name "${userName}" is reserved for the room admin. Please use a different name.` });
          return;
        }
      }

      // Check if user already exists
      const existingUserId = Object.keys(rooms[roomId].users).find(
        id => rooms[roomId].users[id] === userName
      );

      if (existingUserId && existingUserId !== socket.id) {
        // Reconnecting user
        const oldVote = rooms[roomId].votes[existingUserId];
        const oldObserverStatus = rooms[roomId].observers[existingUserId];

        delete rooms[roomId].users[existingUserId];
        delete rooms[roomId].votes[existingUserId];
        delete rooms[roomId].observers[existingUserId];

        rooms[roomId].users[socket.id] = userName;
        if (oldVote !== undefined) rooms[roomId].votes[socket.id] = oldVote;
        rooms[roomId].observers[socket.id] = oldObserverStatus || false;

        // If this was the admin reconnecting
        if (userName === rooms[roomId].admin) {
          rooms[roomId].adminSocketId = socket.id;
          rooms[roomId].adminDisconnected = false;
        }
      } else if (!existingUserId) {
        // New user (or admin who fully disconnected and lost their slot)
        rooms[roomId].users[socket.id] = userName;
        rooms[roomId].observers[socket.id] = false;

        // Restore admin status if the admin is rejoining after a full disconnect
        if (userName === rooms[roomId].admin) {
          rooms[roomId].adminSocketId = socket.id;
          rooms[roomId].adminDisconnected = false;
        }
      }

      socket.join(roomId);

      // Send data to joining client
      socket.emit("room-joined", {
        roomId,
        roomName: rooms[roomId].name,
        participants: Object.values(rooms[roomId].users)
      });

      socket.emit("users", rooms[roomId].users);
      socket.emit("admin", rooms[roomId].admin);
      socket.emit("observersUpdate", rooms[roomId].observers);
      socket.emit("roomInfo", {
        roomId: roomId,
        roomName: rooms[roomId].name,
        users: rooms[roomId].users,
        estimationScale: rooms[roomId].estimationScale,
        jiraConnected: rooms[roomId].jiraConnected,
        stories: rooms[roomId].stories,
        currentStoryIndex: rooms[roomId].currentStoryIndex
      });

      // Also send stories to the joining user
      socket.emit("stories-updated", {
        stories: rooms[roomId].stories || [],
        currentStoryIndex: rooms[roomId].currentStoryIndex || 0
      });

      // Restore current vote state for the rejoining user
      socket.emit("voteUpdate", {
        votes: rooms[roomId].votes,
        users: rooms[roomId].users
      });

      // If voting has already been revealed, restore that state
      if (rooms[roomId].revealed) {
        socket.emit("reveal", {
          votes: rooms[roomId].votes,
          users: rooms[roomId].users
        });
      }

      // If a final point was already set, restore it
      if (rooms[roomId].finalPoint !== null && rooms[roomId].finalPoint !== undefined) {
        const storyData = rooms[roomId].currentStoryData || {};
        socket.emit("final", {
          point: rooms[roomId].finalPoint,
          issueTitle: storyData.issueTitle || null,
          acceptanceCriteria: storyData.acceptanceCriteria || null
        });
      }

      // Broadcast to all in room
      io.to(roomId).emit("users", rooms[roomId].users);
      io.to(roomId).emit("admin", rooms[roomId].admin);
      io.to(roomId).emit("observersUpdate", rooms[roomId].observers);
      io.to(roomId).emit("roomInfo", {
        roomId: roomId,
        roomName: rooms[roomId].name,
        users: rooms[roomId].users,
        estimationScale: rooms[roomId].estimationScale,
        jiraConnected: rooms[roomId].jiraConnected,
        stories: rooms[roomId].stories,
        currentStoryIndex: rooms[roomId].currentStoryIndex
      });

      console.log(`User ${userName} joined room: ${roomId}`);
    } else {
      socket.emit("error", { message: "Room not found" });
    }
  });

  // Handle fetch Jira details with room-specific credentials
  socket.on("fetchJiraDetails", async ({ roomId, jiraKey }) => {
    if (jiraKey && rooms[roomId]) {
      const jiraClient = getJiraClientForRoom(roomId);

      if (!jiraClient) {
        socket.emit("jiraError", { message: "Jira not configured for this room" });
        return;
      }

      try {
        const details = await getJiraIssueDetails(jiraClient, jiraKey);
        rooms[roomId].currentStoryData = {
          issueTitle: details.summary,
          acceptanceCriteria: details.acceptanceCriteria,
          description: details.description,
          issueType: details.issueType,
          storyStatus: details.status || "To Do"
        };

        io.to(roomId).emit("jiraDetails", {
          summary: details.summary,
          acceptanceCriteria: details.acceptanceCriteria,
          description: details.description,
          issueType: details.issueType,
          status: details.status || "To Do"
        });
      } catch (err) {
        console.error("Failed to fetch Jira details:", err.message);
        socket.emit("jiraError", { message: "Failed to fetch Jira details: " + err.message });
      }
    }
  });

  // Handle fetch multiple Jira details
  socket.on("fetchMultipleJiraDetails", async ({ roomId, issueKeys }) => {
    if (!rooms[roomId] || !issueKeys || !Array.isArray(issueKeys)) return;

    const jiraClient = getJiraClientForRoom(roomId);

    if (!jiraClient) {
      socket.emit("jiraError", { message: "Jira not configured for this room" });
      return;
    }

    try {
      const results = {};

      for (const key of issueKeys) {
        try {
          const details = await getJiraIssueDetails(jiraClient, key);
          results[key] = {
            summary: details.summary,
            type: details.issueType,
            status: details.status || "To Do",
            description: details.description,
            acceptanceCriteria: details.acceptanceCriteria
          };
          console.log(`Fetched details for ${key}: ${details.summary}`);
        } catch (err) {
          console.error(`Failed to fetch details for ${key}:`, err.message);
          results[key] = {
            summary: `Error loading ${key}`,
            type: 'Story',
            status: 'To Do'
          };
        }
      }

      socket.emit("multipleJiraDetails", { roomId, results });
    } catch (error) {
      console.error("Error in fetchMultipleJiraDetails:", error);
      socket.emit("jiraError", { message: "Failed to fetch multiple Jira details" });
    }
  });

  // Handle finalize with Jira update
  socket.on("finalize", async ({ roomId, data }) => {
    if (!rooms[roomId]) return;

    let point, jiraKey;
    if (typeof data === "object" && data !== null) {
      point = data.point;
      jiraKey = data.jiraKey;
    } else {
      point = data;
      jiraKey = null;
    }

    rooms[roomId].finalPoint = point;
    let issueTitle = null;
    let acceptanceCriteria = null;

    if (jiraKey) {
      const jiraClient = getJiraClientForRoom(roomId);

      if (jiraClient) {
        try {
          await updateJiraStoryPoints(jiraClient, jiraKey, point);
          const details = await getJiraIssueDetails(jiraClient, jiraKey);
          issueTitle = details.summary;
          acceptanceCriteria = details.acceptanceCriteria;

          rooms[roomId].currentStoryData = {
            issueTitle: details.summary,
            acceptanceCriteria: details.acceptanceCriteria,
            description: details.description,
            issueType: details.issueType,
            storyStatus: details.status || "To Do"
          };

          io.to(roomId).emit("jiraDetails", {
            summary: details.summary,
            acceptanceCriteria: details.acceptanceCriteria,
            description: details.description,
            issueType: details.issueType,
            status: details.status || "To Do"
          });
        } catch (err) {
          console.error("Failed to update Jira:", err.message);
          socket.emit("jiraError", { message: "Failed to update Jira: " + err.message });
        }
      } else {
        console.log("No Jira client available for room, skipping Jira update");
      }
    }

    io.to(roomId).emit("final", { point, issueTitle, acceptanceCriteria });
  });

  // Handle update acceptance criteria
  socket.on("updateAcceptanceCriteria", async ({ roomId, jiraKey, acceptanceCriteria }) => {
    if (jiraKey && acceptanceCriteria != null && rooms[roomId]) {
      const jiraClient = getJiraClientForRoom(roomId);

      if (!jiraClient) {
        socket.emit("jiraError", { message: "Jira not configured for this room" });
        return;
      }

      try {
        await updateJiraAcceptanceCriteria(jiraClient, jiraKey, acceptanceCriteria);
        const details = await getJiraIssueDetails(jiraClient, jiraKey);

        if (rooms[roomId].currentStoryData) {
          rooms[roomId].currentStoryData.acceptanceCriteria = acceptanceCriteria;
        }

        io.to(roomId).emit("jiraDetails", {
          summary: details.summary,
          acceptanceCriteria: details.acceptanceCriteria,
          description: details.description,
          issueType: details.issueType,
          status: details.status || "To Do"
        });
      } catch (err) {
        console.error("Failed to update Jira Acceptance Criteria:", err.message);
        socket.emit("jiraError", { message: "Failed to update acceptance criteria" });
      }
    }
  });

  // Handle update description
  socket.on("updateDescription", async ({ roomId, jiraKey, description }) => {
    if (jiraKey && description != null && rooms[roomId]) {
      const jiraClient = getJiraClientForRoom(roomId);

      if (!jiraClient) {
        socket.emit("jiraError", { message: "Jira not configured for this room" });
        return;
      }

      try {
        await updateJiraDescription(jiraClient, jiraKey, description);
        const details = await getJiraIssueDetails(jiraClient, jiraKey);

        if (rooms[roomId].currentStoryData) {
          rooms[roomId].currentStoryData.description = description;
        }

        io.to(roomId).emit("jiraDetails", {
          summary: details.summary,
          acceptanceCriteria: details.acceptanceCriteria,
          description: details.description,
          issueType: details.issueType,
          status: details.status || "To Do"
        });
      } catch (err) {
        console.error("Failed to update Jira Description:", err.message);
        socket.emit("jiraError", { message: "Failed to update description" });
      }
    }
  });

  // Handle update story status
  socket.on("updateStoryStatus", async ({ roomId, jiraKey, status }) => {
    if (jiraKey && status && rooms[roomId]) {
      const jiraClient = getJiraClientForRoom(roomId);

      if (!jiraClient) {
        socket.emit("jiraError", { message: "Jira not configured for this room" });
        return;
      }

      try {
        await updateJiraStatus(jiraClient, jiraKey, status);
        const details = await getJiraIssueDetails(jiraClient, jiraKey);

        if (rooms[roomId].currentStoryData) {
          rooms[roomId].currentStoryData.storyStatus = status;
        }

        io.to(roomId).emit("storyStatusUpdate", { jiraKey, status });
        io.to(roomId).emit("jiraDetails", {
          summary: details.summary,
          acceptanceCriteria: details.acceptanceCriteria,
          description: details.description,
          issueType: details.issueType,
          status: details.status || status
        });
      } catch (err) {
        console.error("Failed to update Jira Status:", err.message);
        socket.emit("statusUpdateError", {
          jiraKey,
          error: "Failed to update status in Jira"
        });
      }
    }
  });

  // Handle get Jira transitions
  socket.on("getJiraTransitions", async ({ roomId, issueKey }) => {
    if (!rooms[roomId]) return;

    const jiraClient = getJiraClientForRoom(roomId);

    if (!jiraClient) {
      socket.emit("jiraError", { message: "Jira not configured for this room" });
      return;
    }

    try {
      const transitions = await getJiraTransitions(jiraClient, issueKey);
      io.to(roomId).emit("jiraTransitions", transitions);
    } catch (error) {
      console.error('Error getting transitions:', error);
      io.to(roomId).emit("jiraTransitions", { transitions: [] });
    }
  });

  // Other existing handlers (voting, reveal, reset, etc.)
  socket.on("vote", ({ roomId, point }) => {
    if (!rooms[roomId]) return;

    if (rooms[roomId].observers[socket.id]) {
      socket.emit("voteError", "Observers cannot vote");
      return;
    }

    if (point === null) {
      delete rooms[roomId].votes[socket.id];
    } else {
      rooms[roomId].votes[socket.id] = point;
    }

    io.to(roomId).emit("voteUpdate", {
      votes: rooms[roomId].votes,
      users: rooms[roomId].users
    });
  });

  socket.on("reveal", ({ roomId }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].revealed = true;
    io.to(roomId).emit("reveal", {
      votes: rooms[roomId].votes,
      users: rooms[roomId].users
    });
  });

  socket.on("reset", ({ roomId }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].votes = {};
    rooms[roomId].revealed = false;
    rooms[roomId].finalPoint = null;
    delete rooms[roomId].currentStoryData;

    io.to(roomId).emit("reset");
  });

  socket.on("toggleObserver", ({ roomId, userId }) => {
    if (!rooms[roomId]) return;

    if (rooms[roomId].observers[userId] !== undefined) {
      rooms[roomId].observers[userId] = !rooms[roomId].observers[userId];

      if (rooms[roomId].observers[userId]) {
        delete rooms[roomId].votes[userId];
      }

      io.to(roomId).emit("observersUpdate", rooms[roomId].observers);
      io.to(roomId).emit("voteUpdate", {
        votes: rooms[roomId].votes,
        users: rooms[roomId].users
      });
    }
  });

  socket.on("getUsers", ({ roomId }) => {
    if (rooms[roomId]) {
      socket.emit("users", rooms[roomId].users);
      socket.emit("roomInfo", {
        roomId: roomId,
        roomName: rooms[roomId].name,
        users: rooms[roomId].users,
        estimationScale: rooms[roomId].estimationScale,
        jiraConnected: rooms[roomId].jiraConnected,
        stories: rooms[roomId].stories,
        currentStoryIndex: rooms[roomId].currentStoryIndex
      });
    }
  });

  socket.on("getRoomInfo", ({ roomId }) => {
    if (rooms[roomId]) {
      socket.emit("roomInfo", {
        roomId: roomId,
        roomName: rooms[roomId].name,
        users: rooms[roomId].users,
        estimationScale: rooms[roomId].estimationScale,
        jiraConnected: rooms[roomId].jiraConnected,
        stories: rooms[roomId].stories,
        currentStoryIndex: rooms[roomId].currentStoryIndex
      });
    }
  });

  socket.on("requestCurrentStory", ({ roomId }) => {
    if (rooms[roomId] && rooms[roomId].currentStoryData) {
      const storyData = rooms[roomId].currentStoryData;
      socket.emit("jiraDetails", {
        summary: storyData.issueTitle,
        acceptanceCriteria: storyData.acceptanceCriteria,
        description: storyData.description,
        issueType: storyData.issueType,
        status: storyData.storyStatus
      });
    }
  });

  socket.on("requestObservers", ({ roomId }) => {
    if (rooms[roomId]) {
      socket.emit("observersUpdate", rooms[roomId].observers);
    }
  });

  socket.on('getCurrentAdmin', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.admin) {
      socket.emit('currentAdmin', { adminName: room.admin });
    }
  });

  // Admin navigated to a historical story — broadcast its saved results to all participants
  socket.on("restore-story-state", ({ roomId, results, revealed, finalPoint }) => {
    if (!rooms[roomId]) return;

    // Update backend state with the historical data
    if (results && results.votes) {
      rooms[roomId].votes = results.votes;
    }
    rooms[roomId].revealed = revealed || false;
    rooms[roomId].finalPoint = finalPoint !== undefined ? finalPoint : null;

    // Broadcast to ALL participants (admin's viewingHistoryRef guard will absorb the echo)
    // First send voteUpdate so participants know who voted, then reveal to show results
    if (results && results.votes) {
      io.to(roomId).emit("voteUpdate", {
        votes: results.votes,
        users: rooms[roomId].users
      });
    }
    if (revealed && results) {
      io.to(roomId).emit("reveal", {
        votes: results.votes || {},
        users: rooms[roomId].users
      });
    }
    if (finalPoint !== null && finalPoint !== undefined) {
      io.to(roomId).emit("final", {
        point: finalPoint,
        issueTitle: null,
        acceptanceCriteria: null
      });
    }

    console.log(`Restored story state in room ${roomId}: revealed=${revealed}, finalPoint=${finalPoint}`);
  });

  // Sync room state for reconnecting users
  socket.on("sync-room-state", ({ roomId, revealed, results }) => {
    if (!rooms[roomId]) return;

    console.log(`Syncing state for room ${roomId}: revealed=${revealed}, hasResults=${!!results}`);

    // Store the revealed state in the room object for persistence
    if (revealed && results) {
      rooms[roomId].revealed = true;
      rooms[roomId].votes = results.votes || rooms[roomId].votes;

      // Broadcast to the specific client only
      socket.emit("reveal", {
        votes: results.votes,
        users: rooms[roomId].users
      });
    }
  });

  // Request current room state when rejoining
  socket.on("request-room-state", ({ roomId }) => {
    if (!rooms[roomId]) return;

    const room = rooms[roomId];

    // Always send current vote state (who has voted, even if not revealed)
    socket.emit("voteUpdate", {
      votes: room.votes,
      users: room.users
    });

    if (room.revealed && room.votes) {
      socket.emit("reveal", {
        votes: room.votes,
        users: room.users
      });
      console.log(`Sent revealed state to rejoining user in room ${roomId}`);
    }

    if (room.finalPoint !== null && room.finalPoint !== undefined) {
      const storyData = room.currentStoryData || {};
      socket.emit("final", {
        point: room.finalPoint,
        issueTitle: storyData.issueTitle || null,
        acceptanceCriteria: storyData.acceptanceCriteria || null
      });
    }
  });
});

app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  res.json({ exists: !!rooms[roomId] });
});

app.get('/api/rooms', (req, res) => {
  const activeRooms = Object.keys(rooms).map(roomId => ({
    id: roomId,
    name: rooms[roomId].name,
    userCount: Object.keys(rooms[roomId].users).length,
    createdAt: rooms[roomId].createdAt,
    admin: rooms[roomId].admin,
    adminPresent: rooms[roomId].users[rooms[roomId].adminSocketId] ? true : false,
    estimationScale: rooms[roomId].estimationScale,
    jiraConnected: rooms[roomId].jiraConnected
  }));
  res.json(activeRooms);
});

server.listen(4000, () =>
  console.log("Backend running on http://localhost:4000")
);
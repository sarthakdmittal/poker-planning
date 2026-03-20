// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const {
  updateJiraStoryPoints,
  updateJiraDescription,
  getJiraIssueDetails,
  updateJiraAcceptanceCriteria,
  updateJiraStatus,
} = require("./jira");

const app = express();
app.use(cors({
  origin: [
    "http://localhost:3000",
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
      "https://your-vercel-app.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Store multiple rooms
let rooms = {};

// Add connection logging
io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });

  socket.on("connect_error", (error) => {
    console.error(`Connection error for socket ${socket.id}:`, error);
  });

  // Update getUsers handler
  socket.on("getUsers", ({ roomId }) => {
    console.log(`getUsers called for room: ${roomId} by socket: ${socket.id}`);
    if (rooms[roomId]) {
      socket.emit("users", rooms[roomId].users);
      socket.emit("roomInfo", {
        roomId: roomId,
        roomName: rooms[roomId].name,
        users: rooms[roomId].users
      });
    } else {
      socket.emit("users", {});
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

  socket.on("getRoomInfo", ({ roomId }) => {
    if (rooms[roomId]) {
      socket.emit("roomInfo", {
        roomId: roomId,
        roomName: rooms[roomId].name,
        users: rooms[roomId].users
      });
    }
  });

  // Handle room creation
  socket.on("create-room", ({ userName, roomName, roomId }) => {
    // Create new room
    rooms[roomId] = {
      name: roomName,
      users: {},
      votes: {},
      revealed: false,
      finalPoint: null,
      admin: userName,
      observers: {},
      createdBy: socket.id,
      createdAt: new Date().toISOString(),
      // Store the admin's socket ID for tracking disconnection
      adminSocketId: socket.id
    };

    // Join the socket to the room
    socket.join(roomId);

    // Add user to the room
    rooms[roomId].users[socket.id] = userName;
    rooms[roomId].observers[socket.id] = false;

    // Send confirmation to the creator
    socket.emit("room-created", { roomId, roomName });

    // Emit room data
    io.to(roomId).emit("users", rooms[roomId].users);
    io.to(roomId).emit("admin", rooms[roomId].admin);
    io.to(roomId).emit("observersUpdate", rooms[roomId].observers);
    io.to(roomId).emit("roomInfo", {
      roomId: roomId,
      roomName: rooms[roomId].name,
      users: rooms[roomId].users
    });

    console.log(`Room created: ${roomId} (${roomName}) by ${userName}`);
  });

  // Handle joining existing room
  socket.on("join-room", ({ userName, roomId }) => {
    roomId = roomId.toUpperCase();
    console.log(`Join-room attempt: ${userName} trying to join ${roomId}`);

    if (rooms[roomId]) {
      const currentAdmin = rooms[roomId].admin;

      // Check if user is already in the room
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

        // If this was the admin reconnecting, update their socket ID
        if (userName === rooms[roomId].admin) {
          rooms[roomId].adminSocketId = socket.id;
        }
      } else if (!existingUserId) {
        // New user
        rooms[roomId].users[socket.id] = userName;
        rooms[roomId].observers[socket.id] = false;
      }

      // Preserve admin (don't change it)
      if (currentAdmin) {
        rooms[roomId].admin = currentAdmin;
      }

      socket.join(roomId);

      // Send all necessary data to the joining client
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
        users: rooms[roomId].users
      });

      // Broadcast to all in room
      io.to(roomId).emit("users", rooms[roomId].users);
      io.to(roomId).emit("admin", rooms[roomId].admin);
      io.to(roomId).emit("observersUpdate", rooms[roomId].observers);

      console.log(`User ${userName} joined room: ${roomId}`);
    } else {
      socket.emit("error", { message: "Room not found" });
    }
  });

  // Handle voting
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

  // Handle toggle observer
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

  // Handle fetch multiple Jira details
  socket.on("fetchMultipleJiraDetails", async ({ roomId, issueKeys }) => {
    if (!rooms[roomId] || !issueKeys || !Array.isArray(issueKeys)) return;

    try {
      const results = {};

      for (const key of issueKeys) {
        try {
          const details = await getJiraIssueDetails(key);
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
      console.log(`Sent multipleJiraDetails for ${Object.keys(results).length} stories`);
    } catch (error) {
      console.error("Error in fetchMultipleJiraDetails:", error);
    }
  });

  // Handle request observers
  socket.on("requestObservers", ({ roomId }) => {
    if (rooms[roomId]) {
      socket.emit("observersUpdate", rooms[roomId].observers);
    }
  });

  // Handle reveal
  socket.on("reveal", ({ roomId }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].revealed = true;
    io.to(roomId).emit("reveal", {
      votes: rooms[roomId].votes,
      users: rooms[roomId].users
    });
  });

  // Handle finalize
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
      try {
        await updateJiraStoryPoints(jiraKey, point);
        const details = await getJiraIssueDetails(jiraKey);
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
      }
    }

    io.to(roomId).emit("final", { point, issueTitle, acceptanceCriteria });
  });

  // Handle reset
  socket.on("reset", ({ roomId }) => {
    if (!rooms[roomId]) return;

    rooms[roomId].votes = {};
    rooms[roomId].revealed = false;
    rooms[roomId].finalPoint = null;
    delete rooms[roomId].currentStoryData;

    io.to(roomId).emit("reset");
  });

  // Handle get Jira transitions
  socket.on("getJiraTransitions", async ({ roomId, issueKey }) => {
    try {
      const { getJiraTransitions } = require("./jira");
      const transitions = await getJiraTransitions(issueKey);
      io.to(roomId).emit("jiraTransitions", transitions);
    } catch (error) {
      console.error('Error getting transitions:', error);
      io.to(roomId).emit("jiraTransitions", { transitions: [] });
    }
  });

  // Handle fetch Jira details
  socket.on("fetchJiraDetails", async ({ roomId, jiraKey }) => {
    if (jiraKey && rooms[roomId]) {
      try {
        const details = await getJiraIssueDetails(jiraKey);
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
      }
    }
  });

  // Handle update acceptance criteria
  socket.on("updateAcceptanceCriteria", async ({ roomId, jiraKey, acceptanceCriteria }) => {
    if (jiraKey && acceptanceCriteria != null && rooms[roomId]) {
      try {
        await updateJiraAcceptanceCriteria(jiraKey, acceptanceCriteria);
        const details = await getJiraIssueDetails(jiraKey);

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
      }
    }
  });

  // Handle update description
  socket.on("updateDescription", async ({ roomId, jiraKey, description }) => {
    if (jiraKey && description != null && rooms[roomId]) {
      try {
        await updateJiraDescription(jiraKey, description);
        const details = await getJiraIssueDetails(jiraKey);

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
      }
    }
  });

  socket.on('getCurrentAdmin', ({ roomId }) => {
    const room = rooms[roomId];
    if (room && room.admin) {
      socket.emit('currentAdmin', { adminName: room.admin });
    }
  });

  // Handle update story status
  socket.on("updateStoryStatus", async ({ roomId, jiraKey, status }) => {
    if (jiraKey && status && rooms[roomId]) {
      try {
        await updateJiraStatus(jiraKey, status);
        const details = await getJiraIssueDetails(jiraKey);

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

  // Handle disconnect - MODIFIED to NOT reassign admin
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);

    Object.keys(rooms).forEach(roomId => {
      if (rooms[roomId].users[socket.id]) {
        const leavingName = rooms[roomId].users[socket.id];
        const wasAdmin = rooms[roomId].admin === leavingName;

        // Remove the user from the room
        delete rooms[roomId].users[socket.id];
        delete rooms[roomId].votes[socket.id];
        delete rooms[roomId].observers[socket.id];

        // If the admin left, keep the admin name but mark that they're disconnected
        // This way, when they reconnect, they'll still be admin
        if (wasAdmin) {
          console.log(`Admin ${leavingName} left room ${roomId}, waiting for reconnection...`);
          // We keep rooms[roomId].admin as is, no reassignment
          // Also store that admin is disconnected
          rooms[roomId].adminDisconnected = true;
          rooms[roomId].adminSocketId = null;
        }

        // Emit updates
        io.to(roomId).emit("users", rooms[roomId].users);
        io.to(roomId).emit("admin", rooms[roomId].admin); // Still emit the same admin name
        io.to(roomId).emit("observersUpdate", rooms[roomId].observers);

        // Clean up empty rooms
        if (Object.keys(rooms[roomId].users).length === 0) {
          setTimeout(() => {
            if (rooms[roomId] && Object.keys(rooms[roomId].users).length === 0) {
              delete rooms[roomId];
              console.log(`Room ${roomId} deleted (empty)`);
            }
          }, 5 * 60 * 1000); // 5 minutes
        }
      }
    });
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
    adminPresent: rooms[roomId].users[rooms[roomId].adminSocketId] ? true : false
  }));
  res.json(activeRooms);
});

server.listen(4000, () =>
  console.log("Backend running on http://localhost:4000")
);
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const {
  updateJiraStoryPoints,
  updateJiraDescription,
  getJiraIssueSummary,
  getJiraIssueDetails,
  updateJiraAcceptanceCriteria,
  updateJiraStatus,
  getJiraIssueStatus
} = require("./jira");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let room = {
  users: {},
  votes: {},
  revealed: false,
  finalPoint: null,
  admin: null, // Track admin name
  observers: {} // Track which users are observers { socketId: boolean }
};

function emitUsersAndAdmin() {
  io.emit("users", room.users);
  io.emit("admin", room.admin);
}

function emitObserversUpdate() {
  io.emit("observersUpdate", room.observers);
}

async function emitJiraDetails(details, socket = null) {
  const payload = {
    summary: details.summary,
    acceptanceCriteria: details.acceptanceCriteria,
    description: details.description,
    issueType: details.issueType,
    status: details.status
  };
  if (socket) {
    socket.emit("jiraDetails", payload);
  } else {
    io.emit("jiraDetails", payload);
  }
}


io.on("connection", (socket) => {

  socket.on("join", ({ name }) => {
    room.users[socket.id] = name;
    // Initialize observer status for new user (default to false)
    if (room.observers[socket.id] === undefined) {
      room.observers[socket.id] = false;
    }

    // Set admin if not set
    if (!room.admin) {
      room.admin = name;
    }

    emitUsersAndAdmin();
    emitObserversUpdate(); // Send observer status to all clients
  });

  socket.on("vote", (point) => {
    // Check if user is observer before allowing vote
    if (room.observers[socket.id]) {
      // Observer trying to vote - ignore or send error
      socket.emit("voteError", "Observers cannot vote");
      return;
    }

    if (point === null) {
      delete room.votes[socket.id];
    } else {
      room.votes[socket.id] = point;
    }

    io.emit("votes", Object.keys(room.votes).length);
    io.emit("voteUpdate", { votes: room.votes, users: room.users });
  });



  socket.on("toggleObserver", (userId) => {
    // Toggle observer status for the specified user
    if (room.observers[userId] !== undefined) {
      room.observers[userId] = !room.observers[userId];

      // If user is now an observer, clear their vote
      if (room.observers[userId]) {
        delete room.votes[userId];
      }

      // Broadcast the updated observer status to all clients
      emitObserversUpdate();

      // Also send updated votes since we might have cleared a vote
      io.emit("voteUpdate", { votes: room.votes, users: room.users });
    }
  });

  socket.on("requestObservers", () => {
    // Send current observer status to requesting client
    socket.emit("observersUpdate", room.observers);
  });

  socket.on("reveal", () => {
    room.revealed = true;
    io.emit("reveal", {
      votes: room.votes,
      users: room.users
    });
  });

  socket.on("finalize", async (data) => {
    // Support both old (number) and new ({ point, jiraKey }) formats
    let point, jiraKey;
    if (typeof data === "object" && data !== null) {
      point = data.point;
      jiraKey = data.jiraKey;
    } else {
      point = data;
      jiraKey = null;
    }
    room.finalPoint = point;
    let issueTitle = null;
    let acceptanceCriteria = null;
    if (jiraKey) {
      try {
        await updateJiraStoryPoints(jiraKey, point);
        const details = await getJiraIssueDetails(jiraKey);
        issueTitle = details.summary;
        acceptanceCriteria = details.acceptanceCriteria;
        emitJiraDetails(details);
      } catch (err) {
        console.error("Failed to update Jira:", err.message);
      }
    }
    io.emit("final", { point, issueTitle, acceptanceCriteria });
  });

  socket.on("reset", () => {
    room.votes = {};
    room.revealed = false;
    room.finalPoint = null;
    io.emit("reset");
  });

  socket.on("disconnect", () => {
    const leavingName = room.users[socket.id];
    delete room.users[socket.id];
    delete room.votes[socket.id];
    delete room.observers[socket.id]; // Clean up observer status

    // If admin left, pick a new admin by name
    if (room.admin === leavingName) {
      const userIds = Object.keys(room.users);
      room.admin = userIds.length > 0 ? room.users[userIds[0]] : null;
    }

    emitUsersAndAdmin();
    emitObserversUpdate(); // Send updated observer list
  });

  // Add this with your other socket event handlers
  socket.on("getJiraTransitions", async (issueKey) => {
    try {
      const { getJiraTransitions } = require("./jira");
      const transitions = await getJiraTransitions(issueKey);
      socket.emit("jiraTransitions", transitions);
    } catch (error) {
      console.error('Error getting transitions:', error);
      socket.emit("jiraTransitions", { transitions: [] });
    }
  });

  socket.on("fetchJiraDetails", async (jiraKey) => {
    if (jiraKey) {
      try {
        const details = await getJiraIssueDetails(jiraKey);
        emitJiraDetails(details);
      } catch (err) {
        console.error("Failed to fetch Jira details:", err.message);
      }
    }
  });

  socket.on("updateAcceptanceCriteria", async ({ jiraKey, acceptanceCriteria }) => {
    console.log("Received updateAcceptanceCriteria event:", { jiraKey, acceptanceCriteria });
    if (jiraKey && acceptanceCriteria != null) {
      try {
        await updateJiraAcceptanceCriteria(jiraKey, acceptanceCriteria);
        const details = await getJiraIssueDetails(jiraKey);
        emitJiraDetails(details);
        console.log("Acceptance Criteria updated and broadcasted for issue:", jiraKey);
        console.log(`SUCCESS: Acceptance Criteria updated for ${jiraKey}`);
      } catch (err) {
        console.error("Failed to update Jira Acceptance Criteria:", err.message);
      }
    }
  });

  socket.on("updateDescription", async ({ jiraKey, description }) => {
    console.log("Received updateDescription event:", { jiraKey, description });
    if (jiraKey && description != null) {
      try {
        await updateJiraDescription(jiraKey, description);
        const details = await getJiraIssueDetails(jiraKey);
        emitJiraDetails(details);
        console.log("Description updated and broadcasted for issue:", jiraKey);
        console.log(`SUCCESS: Description updated for ${jiraKey}`);
      } catch (err) {
        console.error("Failed to update Jira Description:", err.message);
      }
    }
  });

  socket.on("updateStoryPoints", async ({ jiraKey, storyPoints }) => {
    console.log("Received updateStoryPoints event:", { jiraKey, storyPoints });
    if (jiraKey && storyPoints != null) {
      try {
        await updateJiraStoryPoints(jiraKey, storyPoints);
        const details = await getJiraIssueDetails(jiraKey);
        emitJiraDetails(details);
        console.log("Story Points updated and broadcasted for issue:", jiraKey);
        console.log(`SUCCESS: Story Points updated for ${jiraKey}`);
      } catch (err) {
        console.error("Failed to update Jira Story Points:", err.message);
      }
    }
  });

  socket.on("updateStoryStatus", async ({ jiraKey, status }) => {
    console.log("Received updateStoryStatus event:", { jiraKey, status });

    if (jiraKey && status) {
      try {
        await updateJiraStatus(jiraKey, status);
        const details = await getJiraIssueDetails(jiraKey);
        io.emit("storyStatusUpdate", { jiraKey, status });
        emitJiraDetails(details);
        emitJiraDetails(details, socket);
        console.log(`SUCCESS: Status updated for ${jiraKey} to ${status}`);
      } catch (err) {
        console.error("Failed to update Jira Status:", err.message);
        socket.emit("statusUpdateError", {
          jiraKey,
          error: "Failed to update status in Jira"
        });
      }
    }
  });
});



app.get('/api/test-issue', async (req, res) => {
  const details = await getJiraIssueDetails('EIPAAS-20957');
  console.log('Sending issue to frontend:', details);
  res.json(details);
});

server.listen(4000, () =>
  console.log("Backend running on http://localhost:4000")
);
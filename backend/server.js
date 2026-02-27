const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { updateJiraStoryPoints, updateJiraDescription, getJiraIssueSummary, getJiraIssueDetails, updateJiraAcceptanceCriteria } = require("./jira");

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
  admin: null // Track admin name
};

function emitUsersAndAdmin() {
  io.emit("users", room.users);
  io.emit("admin", room.admin); // Now admin is a name
}

io.on("connection", (socket) => {

  socket.on("join", ({ name }) => {
    room.users[socket.id] = name;
    // Set admin if not set
    if (!room.admin) {
      room.admin = name;
    }
    emitUsersAndAdmin();
  });

  socket.on("vote", (point) => {
    if (point === null) {
      delete room.votes[socket.id];   // 🔥 remove vote completely
    } else {
      room.votes[socket.id] = point;
    }

    io.emit("votes", Object.keys(room.votes).length);
    io.emit("voteUpdate", { votes: room.votes, users: room.users });
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
    // If admin left, pick a new admin by name
    if (room.admin === leavingName) {
      const userIds = Object.keys(room.users);
      room.admin = userIds.length > 0 ? room.users[userIds[0]] : null;
    }
    emitUsersAndAdmin();
  });

  socket.on("fetchJiraDetails", async (jiraKey) => {
    if (jiraKey) {
      try {
        const details = await getJiraIssueDetails(jiraKey);
        io.emit("jiraDetails", details);
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
        // Fetch updated details and broadcast
        const details = await getJiraIssueDetails(jiraKey);
        io.emit("jiraDetails", details);
        console.log("Acceptance Criteria updated and broadcasted for issue:", jiraKey);
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
        // Fetch updated details and broadcast
        const details = await getJiraIssueDetails(jiraKey);
        io.emit("jiraDetails", details);
        console.log("Description updated and broadcasted for issue:", jiraKey);
      } catch (err) {
        console.error("Failed to update Jira Description:", err.message);
      }
    }
  });
});

// For testing: update description on a known issue
// Uncomment and set a real issue key to test
// updateJiraDescription('EIPAAS-20957', 'Test update from API').then(() => process.exit());

server.listen(4000, () =>
  console.log("Backend running on http://localhost:4000")
);

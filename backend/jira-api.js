const axios = require("axios");
require("dotenv/config");

// =========================
// 🔹 CREATE AXIOS INSTANCE WITH BEARER TOKEN
// =========================
function createJiraClient(email, patToken) {
  // Validate credentials
  if (!patToken) {
    console.warn("⚠️ Jira token missing - Jira features will be disabled");
    return null;
  }

  // Use Bearer token authentication (no email needed for PAT)
  const authHeader = `Bearer ${patToken}`;
  console.log("Using Bearer token authentication");

  const client = axios.create({
    baseURL: process.env.JIRA_URL,
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      "Content-Type": "application/json"
    }
  });

  // Add request interceptor for debugging
  client.interceptors.request.use(request => {
    console.log(`Jira Request: ${request.method.toUpperCase()} ${request.url}`);
    return request;
  });

  // Response interceptor for error handling
  client.interceptors.response.use(
    res => res,
    err => {
      if (err.response?.status === 401) {
        console.error("❌ JIRA AUTH ERROR: Invalid token - Please check your Personal Access Token");
      } else if (err.response?.status === 403) {
        console.error("❌ JIRA FORBIDDEN: You don't have permission to access this resource");
        console.error("   Check that your token has the necessary permissions");
      } else if (err.response?.status === 404) {
        console.error("❌ JIRA NOT FOUND: The issue or resource doesn't exist");
      } else {
        console.error("❌ JIRA ERROR:",
          err.response?.status,
          err.response?.data ? JSON.stringify(err.response?.data, null, 2).substring(0, 500) : err.message
        );
      }
      return Promise.reject(err);
    }
  );

  return client;
}

// =========================
// 🔹 TEST CONNECTION
// =========================
async function testJiraConnection(jiraClient) {
  if (!jiraClient) return false;

  try {
    // Try to get current user info to test credentials
    const response = await jiraClient.get('/rest/api/2/myself');
    console.log(`✅ Jira connection successful for user: ${response.data.displayName || response.data.emailAddress}`);
    return true;
  } catch (err) {
    console.error("❌ Jira connection failed:", err.message);
    if (err.response?.status === 401) {
      console.error("   Authentication failed. Please check your Personal Access Token.");
    } else if (err.response?.status === 403) {
      console.error("   Access forbidden. Check your token permissions.");
    }
    return false;
  }
}

// =========================
// 🔹 UPDATE STORY POINTS
// =========================
async function updateJiraStoryPoints(jiraClient, issueKey, storyPoints) {
  if (!jiraClient) throw new Error("Jira client not initialized");

  const storyPointField = process.env.JIRA_STORYPOINT_FIELD;
  if (!storyPointField) {
    throw new Error("JIRA_STORYPOINT_FIELD is not configured in .env");
  }

  const payload = {
    fields: {
      [storyPointField]: storyPoints
    }
  };

  console.log(`Updating ${issueKey} story points to:`, storyPoints);

  const res = await jiraClient.put(`/rest/api/2/issue/${issueKey}`, payload);

  if (res.status === 204) {
    console.log(`✅ Successfully updated ${issueKey} story points`);
  }

  return res.data;
}

// =========================
// 🔹 UPDATE DESCRIPTION
// =========================
async function updateJiraDescription(jiraClient, issueKey, description) {
  if (!jiraClient) throw new Error("Jira client not initialized");

  const payload = {
    fields: {
      [process.env.JIRA_DESCRIPTION_FIELD || "description"]: description
    }
  };

  console.log(`Updating ${issueKey} description`);

  const res = await jiraClient.put(`/rest/api/2/issue/${issueKey}`, payload);

  if (res.status === 204) {
    console.log(`✅ Successfully updated ${issueKey} description`);
  }

  return res.data;
}

// =========================
// 🔹 UPDATE ACCEPTANCE CRITERIA
// =========================
async function updateJiraAcceptanceCriteria(jiraClient, issueKey, acceptanceCriteria) {
  if (!jiraClient) throw new Error("Jira client not initialized");

  const payload = {
    fields: {
      [process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD]: acceptanceCriteria
    }
  };

  console.log(`Updating ${issueKey} acceptance criteria`);

  const res = await jiraClient.put(`/rest/api/2/issue/${issueKey}`, payload);

  if (res.status === 204) {
    console.log(`✅ Successfully updated ${issueKey} acceptance criteria`);
  }

  return res.data;
}

// =========================
// 🔹 GET TRANSITIONS
// =========================
async function getJiraTransitions(jiraClient, issueKey) {
  if (!jiraClient) return { transitions: [] };

  try {
    const res = await jiraClient.get(`/rest/api/2/issue/${issueKey}/transitions`);

    console.log(`Available transitions for ${issueKey}:`,
      res.data.transitions?.map(t => ({ id: t.id, name: t.name, to: t.to.name }))
    );

    return res.data;

  } catch (err) {
    console.error("Failed to fetch Jira transitions");
    return { transitions: [] };
  }
}

// =========================
// 🔹 TRANSITION ISSUE
// =========================
async function transitionJiraIssue(jiraClient, issueKey, transitionId) {
  if (!jiraClient) throw new Error("Jira client not initialized");

  const payload = {
    transition: { id: transitionId }
  };

  console.log(`Transitioning ${issueKey} to transition ID: ${transitionId}`);

  await jiraClient.post(
    `/rest/api/2/issue/${issueKey}/transitions`,
    payload
  );

  console.log(`✅ Successfully transitioned ${issueKey}`);
}

// =========================
// 🔹 GET TRANSITION ID
// =========================
async function getTransitionIdForStatus(jiraClient, issueKey, targetStatus) {
  if (!jiraClient) return null;

  try {
    const transitionsData = await getJiraTransitions(jiraClient, issueKey);

    const transition = transitionsData.transitions?.find(t =>
      t.to.name.toLowerCase() === targetStatus.toLowerCase()
    );

    if (transition) {
      console.log(`Found transition for ${targetStatus}:`, transition);
      return transition.id;
    } else {
      console.log(`No transition found for ${targetStatus}`);
      console.log("Available transitions:",
        transitionsData.transitions?.map(t => ({
          id: t.id,
          name: t.name,
          to: t.to.name
        }))
      );
      return null;
    }
  } catch (err) {
    console.error("Failed to get transition ID:", err.message);
    return null;
  }
}

// =========================
// 🔹 GET ISSUE DETAILS
// =========================
async function getJiraIssueDetails(jiraClient, issueKey) {
  if (!jiraClient) {
    console.warn("Jira client not available");
    return {
      summary: null,
      acceptanceCriteria: null,
      description: null,
      issueType: null,
      status: "To Do"
    };
  }

  try {
    const res = await jiraClient.get(`/rest/api/2/issue/${issueKey}`, {
      params: {
        fields: [
          "summary",
          "description",
          "status",
          "issuetype",
          process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD,
          process.env.JIRA_DESCRIPTION_FIELD
        ].filter(Boolean).join(",")
      }
    });

    const issue = res.data;

    const descCustom = issue.fields[process.env.JIRA_DESCRIPTION_FIELD];
    const desc =
      descCustom && typeof descCustom === "string"
        ? descCustom
        : issue.fields.description;

    const acceptanceCriteria =
      issue.fields[process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD];

    return {
      summary: issue.fields.summary,
      acceptanceCriteria,
      description: desc,
      issueType: issue.fields.issuetype?.name,
      status: issue.fields.status?.name || "To Do"
    };

  } catch (err) {
    console.error(`Failed to fetch Jira issue details for ${issueKey}:`, err.message);
    return {
      summary: null,
      acceptanceCriteria: null,
      description: null,
      issueType: null,
      status: "To Do"
    };
  }
}

// =========================
// 🔹 GET STATUS
// =========================
async function getJiraIssueStatus(jiraClient, issueKey) {
  if (!jiraClient) return "To Do";

  try {
    const res = await jiraClient.get(`/rest/api/2/issue/${issueKey}`);
    return res.data.fields.status?.name || "To Do";
  } catch (err) {
    console.error("Failed to fetch Jira issue status");
    return "To Do";
  }
}

// =========================
// 🔹 UPDATE STATUS
// =========================
async function updateJiraStatus(jiraClient, issueKey, targetStatus) {
  if (!jiraClient) throw new Error("Jira client not initialized");

  try {
    const transitionId = await getTransitionIdForStatus(jiraClient, issueKey, targetStatus);

    if (!transitionId) {
      throw new Error(`No transition found to status: ${targetStatus}`);
    }

    await transitionJiraIssue(jiraClient, issueKey, transitionId);

    const updated = await jiraClient.get(`/rest/api/2/issue/${issueKey}`);
    return updated.data.fields.status.name;

  } catch (err) {
    console.error("Failed to update Jira status:", err.message);
    throw err;
  }
}

// =========================
// 🔹 EXPORTS
// =========================
module.exports = {
  createJiraClient,
  updateJiraStoryPoints,
  updateJiraDescription,
  updateJiraAcceptanceCriteria,
  getJiraIssueDetails,
  getJiraIssueStatus,
  updateJiraStatus,
  getJiraTransitions,
  transitionJiraIssue,
  getTransitionIdForStatus,
  testJiraConnection
};
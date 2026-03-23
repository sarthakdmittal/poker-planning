const axios = require("axios");
require("dotenv/config");

// =========================
// 🔹 AXIOS INSTANCE
// =========================
const jira = axios.create({
  baseURL: process.env.JIRA_URL, // e.g. https://jira.axway.com
  headers: {
    Authorization: `Bearer ${process.env.JIRA_PASSWORD}`, // PAT token
    Accept: "application/json",
    "Content-Type": "application/json"
  }
});

// Optional: global error logging
jira.interceptors.response.use(
  res => res,
  err => {
    console.error("❌ JIRA ERROR:",
      err.response?.status,
      JSON.stringify(err.response?.data, null, 2)
    );
    return Promise.reject(err);
  }
);

// =========================
// 🔹 UPDATE STORY POINTS
// =========================
async function updateJiraStoryPoints(issueKey, storyPoints) {
  const payload = {
    fields: {
      [process.env.JIRA_STORYPOINT_FIELD]: storyPoints
    }
  };

  console.log("Sending to Jira (story points):", JSON.stringify(payload, null, 2));

  const res = await jira.put(`/rest/api/2/issue/${issueKey}`, payload);

  if (res.status === 204) {
    console.log("Jira responded with 204 No Content");
  }

  return res.data;
}

// =========================
// 🔹 UPDATE DESCRIPTION
// =========================
async function updateJiraDescription(issueKey, description) {
  const payload = {
    fields: {
      [process.env.JIRA_DESCRIPTION_FIELD || "description"]: description
    }
  };

  console.log("Sending to Jira (description):", JSON.stringify(payload, null, 2));

  const res = await jira.put(`/rest/api/2/issue/${issueKey}`, payload);

  if (res.status === 204) {
    console.log("Jira responded with 204 No Content");
  }

  return res.data;
}

// =========================
// 🔹 UPDATE ACCEPTANCE CRITERIA
// =========================
async function updateJiraAcceptanceCriteria(issueKey, acceptanceCriteria) {
  const payload = {
    fields: {
      [process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD]: acceptanceCriteria
    }
  };

  console.log("Sending to Jira (acceptanceCriteria):", JSON.stringify(payload, null, 2));

  const res = await jira.put(`/rest/api/2/issue/${issueKey}`, payload);

  if (res.status === 204) {
    console.log("Jira responded with 204 No Content");
  }

  return res.data;
}

// =========================
// 🔹 GET TRANSITIONS
// =========================
async function getJiraTransitions(issueKey) {
  try {
    const res = await jira.get(`/rest/api/2/issue/${issueKey}/transitions`);

    console.log(`Available transitions for ${issueKey}:`,
      JSON.stringify(res.data, null, 2)
    );

    // Keep SAME structure as old code
    return res.data;

  } catch (err) {
    console.error("Failed to fetch Jira transitions");
    return { transitions: [] };
  }
}

// =========================
// 🔹 TRANSITION ISSUE
// =========================
async function transitionJiraIssue(issueKey, transitionId) {
  const payload = {
    transition: { id: transitionId }
  };

  console.log("Sending transition to Jira:", JSON.stringify(payload, null, 2));

  await jira.post(
    `/rest/api/2/issue/${issueKey}/transitions`,
    payload
  );

  console.log("Jira transition successful");
}

// =========================
// 🔹 GET TRANSITION ID
// =========================
async function getTransitionIdForStatus(issueKey, targetStatus) {
  try {
    const transitionsData = await getJiraTransitions(issueKey);

    const transition = transitionsData.transitions.find(t =>
      t.to.name.toLowerCase() === targetStatus.toLowerCase()
    );

    if (transition) {
      console.log(`Found transition for ${targetStatus}:`, transition);
      return transition.id;
    } else {
      console.log(`No transition found for ${targetStatus}`);
      console.log("Available transitions:",
        transitionsData.transitions.map(t => ({
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
async function getJiraIssueDetails(issueKey) {
  try {
    const res = await jira.get(`/rest/api/2/issue/${issueKey}`, {
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

    // ✅ IMPORTANT: Preserve fallback logic
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
    console.error("Failed to fetch Jira issue details");

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
// 🔹 GET SUMMARY
// =========================
async function getJiraIssueSummary(issueKey) {
  try {
    const res = await jira.get(`/rest/api/2/issue/${issueKey}`);
    return res.data.fields.summary;
  } catch (err) {
    console.error("Failed to fetch Jira issue summary");
    return null;
  }
}

// =========================
// 🔹 GET DESCRIPTION
// =========================
async function getJiraDescription(issueKey) {
  try {
    const res = await jira.get(`/rest/api/2/issue/${issueKey}`);

    const fields = res.data.fields;

    const descCustom = fields[process.env.JIRA_DESCRIPTION_FIELD];
    const desc =
      descCustom && typeof descCustom === "string"
        ? descCustom
        : fields.description;

    console.log("DEBUG description:", desc);

    return desc;

  } catch (err) {
    console.error("Failed to fetch Jira description");
    return null;
  }
}

// =========================
// 🔹 UPDATE STATUS
// =========================
async function updateJiraStatus(issueKey, targetStatus) {
  try {
    const transitionId = await getTransitionIdForStatus(issueKey, targetStatus);

    if (!transitionId) {
      throw new Error(`No transition found to status: ${targetStatus}`);
    }

    await transitionJiraIssue(issueKey, transitionId);

    const updated = await jira.get(`/rest/api/2/issue/${issueKey}`);
    return updated.data.fields.status.name;

  } catch (err) {
    console.error("Failed to update Jira status:", err.message);
    throw err;
  }
}

// =========================
// 🔹 GET STATUS
// =========================
async function getJiraIssueStatus(issueKey) {
  try {
    const res = await jira.get(`/rest/api/2/issue/${issueKey}`);
    return res.data.fields.status?.name || "To Do";
  } catch (err) {
    console.error("Failed to fetch Jira issue status");
    return "To Do";
  }
}

// =========================
// 🔹 EXPORTS
// =========================
module.exports = {
  updateJiraStoryPoints,
  updateJiraDescription,
  getJiraIssueSummary,
  getJiraIssueDetails,
  updateJiraAcceptanceCriteria,
  getJiraDescription,
  updateJiraStatus,
  getJiraIssueStatus,
  getJiraTransitions,
  transitionJiraIssue,
  getTransitionIdForStatus
};
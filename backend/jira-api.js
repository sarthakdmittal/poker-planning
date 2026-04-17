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
          "fixVersions",
          "attachment",
          "reporter",
          "assignee",
          "priority",
          "resolution",
          process.env.JIRA_SQUAD_FIELD || "customfield_18030",
          process.env.JIRA_EPIC_LINK_FIELD || "customfield_11731",
          process.env.JIRA_SPRINT_FIELD || "customfield_11730",
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

    const fixVersions = (issue.fields.fixVersions || []).map(v => v.name);

    const attachments = (issue.fields.attachment || []).map(a => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      content: a.content,
      thumbnail: a.thumbnail
    }));

    const squadField = process.env.JIRA_SQUAD_FIELD || "customfield_18030";
    const epicLinkField = process.env.JIRA_EPIC_LINK_FIELD || "customfield_11731";
    const sprintField = process.env.JIRA_SPRINT_FIELD || "customfield_11730";

    // Sprint field can be array or single value; each entry may be an object or
    // a Jira Server string like "com.atlassian...Sprint@x[id=77,name=Foo,state=ACTIVE,...]"
    const sprintRaw = issue.fields[sprintField];
    const parseSprintEntry = (s) => {
      if (s && typeof s === 'object') return { id: s.id, name: s.name, state: (s.state || '').toLowerCase() };
      if (typeof s === 'string') {
        const id = (s.match(/\bid=(\d+)/) || [])[1];
        const name = (s.match(/\bname=([^,\]]+)/) || [])[1];
        const state = ((s.match(/\bstate=([^,\]]+)/) || [])[1] || '').toLowerCase();
        if (name) return { id: id ? parseInt(id) : null, name, state };
      }
      return null;
    };
    const sprintArr = Array.isArray(sprintRaw) ? sprintRaw : (sprintRaw ? [sprintRaw] : []);
    const sprints = sprintArr.map(parseSprintEntry).filter(Boolean);

    const epicLinkKey = issue.fields[epicLinkField] || null;
    let epicLinkName = epicLinkKey;
    if (epicLinkKey) {
      try {
        const epicRes = await jiraClient.get(`/rest/api/2/issue/${epicLinkKey}`, { params: { fields: 'summary' } });
        epicLinkName = epicRes.data.fields?.summary || epicLinkKey;
      } catch (_) {}
    }

    return {
      summary: issue.fields.summary,
      acceptanceCriteria,
      description: desc,
      issueType: issue.fields.issuetype?.name,
      status: issue.fields.status?.name || "To Do",
      fixVersions,
      attachments,
      reporter: issue.fields.reporter?.displayName || null,
      reporterAccountId: issue.fields.reporter?.name || issue.fields.reporter?.accountId || null,
      assignee: issue.fields.assignee?.displayName || null,
      assigneeAccountId: issue.fields.assignee?.name || issue.fields.assignee?.accountId || null,
      priority: issue.fields.priority?.name || null,
      priorityIconUrl: issue.fields.priority?.iconUrl || null,
      resolution: issue.fields.resolution?.name || null,
      squad: issue.fields[squadField]?.value || null,
      squadId: issue.fields[squadField]?.id || null,
      epicLink: epicLinkName,
      epicLinkKey,
      sprints
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
// 🔹 GET PRIORITIES
// =========================
async function getJiraPriorities(jiraClient) {
  if (!jiraClient) return [];
  try {
    const res = await jiraClient.get('/rest/api/2/priority');
    return (res.data || []).map(p => ({ id: p.id, name: p.name, iconUrl: p.iconUrl }));
  } catch (err) {
    console.error("Failed to fetch priorities:", err.message);
    return [];
  }
}

// =========================
// 🔹 UPDATE PRIORITY
// =========================
async function updateJiraPriority(jiraClient, issueKey, priorityName) {
  if (!jiraClient) throw new Error("Jira client not initialized");
  const payload = { fields: { priority: { name: priorityName } } };
  await jiraClient.put(`/rest/api/2/issue/${issueKey}`, payload);
  console.log(`✅ Updated ${issueKey} priority to ${priorityName}`);
}

// =========================
// 🔹 GET SQUAD OPTIONS
// =========================
async function getJiraSquadOptions(jiraClient, issueKey) {
  if (!jiraClient) return [];
  const squadField = process.env.JIRA_SQUAD_FIELD || "customfield_18030";
  try {
    const res = await jiraClient.get(`/rest/api/2/issue/${issueKey}/editmeta`);
    const field = res.data?.fields?.[squadField];
    return (field?.allowedValues || []).map(v => ({ id: v.id, value: v.value }));
  } catch (err) {
    console.error("Failed to fetch squad options:", err.message);
    return [];
  }
}

// =========================
// 🔹 UPDATE SQUAD
// =========================
async function updateJiraSquad(jiraClient, issueKey, squadId) {
  if (!jiraClient) throw new Error("Jira client not initialized");
  const squadField = process.env.JIRA_SQUAD_FIELD || "customfield_18030";
  const payload = { fields: { [squadField]: { id: squadId } } };
  await jiraClient.put(`/rest/api/2/issue/${issueKey}`, payload);
  console.log(`✅ Updated ${issueKey} squad to ${squadId}`);
}

// =========================
// 🔹 GET RESOLUTIONS
// =========================
async function getJiraResolutions(jiraClient) {
  if (!jiraClient) return [];
  try {
    const res = await jiraClient.get('/rest/api/2/resolution');
    return (res.data || []).map(r => ({ id: r.id, name: r.name }));
  } catch (err) {
    console.error("Failed to fetch resolutions:", err.message);
    return [];
  }
}

// =========================
// 🔹 UPDATE RESOLUTION
// =========================
async function updateJiraResolution(jiraClient, issueKey, resolutionName) {
  if (!jiraClient) throw new Error("Jira client not initialized");
  const payload = { fields: { resolution: { name: resolutionName } } };
  await jiraClient.put(`/rest/api/2/issue/${issueKey}`, payload);
  console.log(`✅ Updated ${issueKey} resolution to ${resolutionName}`);
}

// =========================
// 🔹 GET SPRINTS FOR PROJECT
// =========================
async function getJiraSprints(jiraClient, projectKey) {
  if (!jiraClient) return [];
  try {
    const boardsRes = await jiraClient.get('/rest/agile/1.0/board', {
      params: { projectKeyOrId: projectKey, maxResults: 50 }
    });
    const boards = boardsRes.data?.values || [];
    if (!boards.length) return [];

    // Collect sprints from all boards, deduplicate by id
    const sprintMap = new Map();
    await Promise.all(boards.map(async board => {
      try {
        const sprintsRes = await jiraClient.get(`/rest/agile/1.0/board/${board.id}/sprint`, {
          params: { state: 'active,future', maxResults: 50 }
        });
        for (const s of (sprintsRes.data?.values || [])) {
          if (!sprintMap.has(s.id)) {
            sprintMap.set(s.id, { id: s.id, name: s.name, state: s.state });
          }
        }
      } catch (_) {}
    }));

    // Sort: active first, then by id descending (most recent first)
    return [...sprintMap.values()].sort((a, b) => {
      if (a.state === 'active' && b.state !== 'active') return -1;
      if (b.state === 'active' && a.state !== 'active') return 1;
      return b.id - a.id;
    });
  } catch (err) {
    console.error("Failed to fetch sprints:", err.message);
    return [];
  }
}

// =========================
// 🔹 UPDATE SPRINT
// =========================
async function updateJiraSprint(jiraClient, issueKey, sprintId) {
  if (!jiraClient) throw new Error("Jira client not initialized");
  const sprintField = process.env.JIRA_SPRINT_FIELD || "customfield_11730";
  const payload = { fields: { [sprintField]: sprintId } };
  await jiraClient.put(`/rest/api/2/issue/${issueKey}`, payload);
  console.log(`✅ Updated ${issueKey} sprint to ${sprintId}`);
}

// =========================
// 🔹 GET EPICS FOR PROJECT
// =========================
async function getJiraEpics(jiraClient, projectKey) {
  if (!jiraClient) return [];
  try {
    const res = await jiraClient.get('/rest/agile/1.0/board', {
      params: { projectKeyOrId: projectKey, maxResults: 5 }
    });
    const boards = res.data?.values || [];
    if (!boards.length) return [];

    const boardId = boards[0].id;
    const epicsRes = await jiraClient.get(`/rest/agile/1.0/board/${boardId}/epic`, {
      params: { done: false, maxResults: 50 }
    });
    return (epicsRes.data?.values || []).map(e => ({ id: e.id, key: e.key, name: e.name || e.summary }));
  } catch (err) {
    console.error("Failed to fetch epics:", err.message);
    return [];
  }
}

// =========================
// 🔹 UPDATE EPIC LINK
// =========================
async function updateJiraEpicLink(jiraClient, issueKey, epicKey) {
  if (!jiraClient) throw new Error("Jira client not initialized");
  const epicLinkField = process.env.JIRA_EPIC_LINK_FIELD || "customfield_11731";
  const payload = { fields: { [epicLinkField]: epicKey || null } };
  await jiraClient.put(`/rest/api/2/issue/${issueKey}`, payload);
  console.log(`✅ Updated ${issueKey} epic link to ${epicKey}`);
}

// =========================
// 🔹 GET PROJECT VERSIONS
// =========================
async function getJiraProjectVersions(jiraClient, projectKey) {
  if (!jiraClient) return [];

  try {
    const res = await jiraClient.get(`/rest/api/2/project/${projectKey}/versions`);
    return res.data.map(v => ({ id: v.id, name: v.name, released: v.released, archived: v.archived }));
  } catch (err) {
    console.error("Failed to fetch project versions:", err.message);
    return [];
  }
}

// =========================
// 🔹 UPDATE FIX VERSIONS
// =========================
async function updateJiraFixVersions(jiraClient, issueKey, versionIds) {
  if (!jiraClient) throw new Error("Jira client not initialized");

  const payload = {
    fields: {
      fixVersions: versionIds.map(id => ({ id }))
    }
  };

  console.log(`Updating ${issueKey} fixVersions to:`, versionIds);
  const res = await jiraClient.put(`/rest/api/2/issue/${issueKey}`, payload);

  if (res.status === 204) {
    console.log(`✅ Successfully updated ${issueKey} fixVersions`);
  }

  return res.data;
}

// =========================
// 🔹 SEARCH USERS
// =========================
async function searchJiraUsers(jiraClient, query, projectKey) {
  if (!jiraClient) return [];

  try {
    const res = await jiraClient.get(`/rest/api/2/user/search`, {
      params: { username: query, query, maxResults: 20 }
    });
    return (res.data || []).map(u => ({
      accountId: u.name || u.accountId,
      displayName: u.displayName,
      emailAddress: u.emailAddress,
      avatarUrl: u.avatarUrls?.['24x24']
    }));
  } catch (err) {
    console.error("Failed to search users:", err.message);
    return [];
  }
}

// =========================
// 🔹 UPDATE ASSIGNEE
// =========================
async function updateJiraAssignee(jiraClient, issueKey, accountId) {
  if (!jiraClient) throw new Error("Jira client not initialized");

  const payload = { name: accountId };

  console.log(`Updating ${issueKey} assignee to:`, accountId);
  await jiraClient.put(`/rest/api/2/issue/${issueKey}/assignee`, payload);
  console.log(`✅ Successfully updated ${issueKey} assignee`);
}

// =========================
// 🔹 DELETE ATTACHMENT
// =========================
async function deleteJiraAttachment(jiraClient, attachmentId) {
  if (!jiraClient) throw new Error("Jira client not initialized");

  console.log(`Deleting attachment ${attachmentId}`);
  await jiraClient.delete(`/rest/api/2/attachment/${attachmentId}`);
  console.log(`✅ Successfully deleted attachment ${attachmentId}`);
}

// =========================
// 🔹 ADD ATTACHMENT
// =========================
async function addJiraAttachment(jiraClient, issueKey, filename, fileBuffer, mimeType) {
  if (!jiraClient) throw new Error("Jira client not initialized");

  const FormData = require("form-data");
  const form = new FormData();
  form.append("file", fileBuffer, { filename, contentType: mimeType });

  console.log(`Uploading attachment ${filename} to ${issueKey}`);

  const res = await jiraClient.post(`/rest/api/2/issue/${issueKey}/attachments`, form, {
    headers: {
      ...form.getHeaders(),
      "X-Atlassian-Token": "no-check"
    }
  });

  console.log(`✅ Successfully uploaded attachment to ${issueKey}`);
  return res.data;
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
  testJiraConnection,
  getJiraProjectVersions,
  updateJiraFixVersions,
  searchJiraUsers,
  updateJiraAssignee,
  deleteJiraAttachment,
  addJiraAttachment,
  getJiraPriorities,
  updateJiraPriority,
  getJiraSquadOptions,
  updateJiraSquad,
  getJiraResolutions,
  updateJiraResolution,
  getJiraSprints,
  updateJiraSprint,
  getJiraEpics,
  updateJiraEpicLink
};
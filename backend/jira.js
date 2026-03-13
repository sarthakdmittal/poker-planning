const JiraClient = require('jira-connector');
require('dotenv/config');

const jira = new JiraClient({
  host: process.env.JIRA_URL.replace(/^https?:\/\//, ''),
  basic_auth: {
    email: process.env.JIRA_USERNAME,
    api_token: process.env.JIRA_PASSWORD // Use API token here
  }
});

function updateJiraStoryPoints(issueKey, storyPoints) {
  const payload = {
    issueKey,
    issue: {
      fields: {
        [process.env.JIRA_STORYPOINT_FIELD]: storyPoints
      }
    }
  };
  console.log('Sending to Jira:', JSON.stringify(payload, null, 2));
  return jira.issue.editIssue(payload)
    .then(response => {
      if (!response) {
        console.log('Jira responded with 204 No Content (success, but no body)');
      } else {
        console.log('Jira update response:', response);
      }
      return response;
    })
    .catch(error => {
      if (error && error.response) {
        console.error('Jira update error:', error.response.status, error.response.data);
      } else {
        console.error('Jira update error:', error);
      }
      throw error;
    });
}

function updateJiraDescription(issueKey, description) {
  const payload = {
    issueKey,
    issue: {
      fields: {
        [process.env.JIRA_DESCRIPTION_FIELD]: description
      }
    }
  };
  console.log('Sending to Jira (description):', JSON.stringify(payload, null, 2));
  return jira.issue.editIssue(payload)
    .then(response => {
      if (!response) {
        console.log('Jira responded with 204 No Content (success, but no body)');
      } else {
        console.log('Jira update response:', response);
      }
      return response;
    })
    .catch(error => {
      if (error && error.response) {
        console.error('Jira update error:', error.response.status, error.response.data);
      } else {
        console.error('Jira update error:', error);
      }
      throw error;
    });
}

function updateJiraAcceptanceCriteria(issueKey, acceptanceCriteria) {
  const payload = {
    issueKey,
    issue: {
      fields: {
        [process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD]: acceptanceCriteria
      }
    }
  };
  console.log('Sending to Jira (acceptanceCriteria):', JSON.stringify(payload, null, 2));
  return jira.issue.editIssue(payload)
    .then(response => {
      if (!response) {
        console.log('Jira responded with 204 No Content (success, but no body)');
      } else {
        console.log('Jira update response:', response);
      }
      return response;
    })
    .catch(error => {
      if (error && error.response) {
        console.error('Jira update error:', error.response.status, error.response.data);
      } else {
        console.error('Jira update error:', error);
      }
      throw error;
    });
}

// Get available transitions for an issue
async function getJiraTransitions(issueKey) {
  try {
    const transitions = await jira.issue.getTransitions({
      issueKey: issueKey
    });
    console.log(`Available transitions for ${issueKey}:`, JSON.stringify(transitions, null, 2));
    return transitions;
  } catch (err) {
    console.error('Failed to fetch Jira transitions:', err.message);
    if (err.response) {
      console.error('Jira API error response:', err.response.data);
    }
    return { transitions: [] };
  }
}

// Transition an issue to a new status
async function transitionJiraIssue(issueKey, transitionId) {
  const payload = {
    issueKey,
    transition: {
      id: transitionId
    }
  };

  console.log('Sending transition to Jira:', JSON.stringify(payload, null, 2));

  return jira.issue.transitionIssue(payload)
    .then(response => {
      console.log('Jira transition response:', response);
      return response;
    })
    .catch(error => {
      if (error && error.response) {
        console.error('Jira transition error:', error.response.status, error.response.data);
      } else {
        console.error('Jira transition error:', error);
      }
      throw error;
    });
}

// Map status names to transition IDs (you'll need to discover these for your project)
async function getTransitionIdForStatus(issueKey, targetStatus) {
  try {
    const transitions = await getJiraTransitions(issueKey);

    // Find the transition that leads to the target status
    const transition = transitions.transitions.find(t =>
      t.to.name.toLowerCase() === targetStatus.toLowerCase()
    );

    if (transition) {
      console.log(`Found transition for ${targetStatus}:`, transition);
      return transition.id;
    } else {
      console.log(`No direct transition found for ${targetStatus}`);
      console.log('Available transitions:', transitions.transitions.map(t => ({
        id: t.id,
        name: t.name,
        to: t.to.name
      })));
      return null;
    }
  } catch (err) {
    console.error('Failed to get transition ID:', err.message);
    return null;
  }
}

async function getJiraIssueSummary(issueKey) {
  try {
    const issue = await jira.issue.getIssue({ issueKey });
    return issue.fields.summary;
  } catch (err) {
    console.error('Failed to fetch Jira issue summary:', err.message);
    return null;
  }
}

async function getJiraIssueDetails(issueKey) {
  try {
    // Fetch the issue directly instead of using edit metadata
    const issue = await jira.issue.getIssue({
      issueKey,
      fields: ['summary', 'description', 'status', 'issuetype', process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD, process.env.JIRA_DESCRIPTION_FIELD]
    });

    console.log('Jira API Response for issue:', issueKey, JSON.stringify(issue, null, 2));

    let desc = issue.fields[process.env.JIRA_DESCRIPTION_FIELD];
    if (!desc || typeof desc !== 'string') {
      desc = issue.fields.description;
    }
    let acceptanceCriteria = issue.fields[process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD];
    // Get status from the issue fields
    const status = issue.fields.status?.name || "To Do";
    const issueType = issue.fields.issuetype?.name;
    const summary = issue.fields.summary;

    return {
      summary: summary,
      acceptanceCriteria: acceptanceCriteria,
      description: desc,
      issueType: issueType,
      status: status
    };

  } catch (err) {
    console.error('Failed to fetch Jira issue details:', err.message);
    if (err.response) {
      console.error('Jira API error response:', err.response.data);
    }
    return {
      summary: null,
      acceptanceCriteria: null,
      description: null,
      issueType: null,
      status: "To Do"
    };
  }
}

async function getJiraDescription(issueKey) {
  try {
    const issue = await jira.issue.getIssue({ issueKey });
    let desc = issue.fields[process.env.JIRA_DESCRIPTION_FIELD];
    if (typeof desc !== 'string') desc = issue.fields.description;
    console.log('DEBUG: getJiraDescription for', issueKey, '->', desc);
    return desc;
  } catch (err) {
    console.error('Failed to fetch Jira description:', err.message);
    return null;
  }
}

// Update the updateJiraStatus function to use transitions
async function updateJiraStatus(issueKey, targetStatus) {
  try {
    // First, get the transition ID for the target status
    const transitionId = await getTransitionIdForStatus(issueKey, targetStatus);

    if (!transitionId) {
      throw new Error(`No transition found to status: ${targetStatus}`);
    }

    // Perform the transition
    await transitionJiraIssue(issueKey, transitionId);

    // Verify the new status
    const updatedIssue = await jira.issue.getIssue({ issueKey });
    return updatedIssue.fields.status.name;

  } catch (err) {
    console.error('Failed to update Jira status:', err.message);
    throw err;
  }
}

// Add function to get status
async function getJiraIssueStatus(issueKey) {
  try {
    const issue = await jira.issue.getIssue({ issueKey });
    return issue.fields.status?.name || "To Do";
  } catch (err) {
    console.error('Failed to fetch Jira issue status:', err.message);
    return "To Do";
  }
}

// Export ALL functions at the end
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
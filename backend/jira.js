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
    const issue = await jira.issue.getIssue({ issueKey });
    let desc = issue.fields[process.env.JIRA_DESCRIPTION_FIELD];
    if (typeof desc !== 'string') desc = issue.fields.description;
    return {
      summary: issue.fields.summary,
      acceptanceCriteria: issue.fields[process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD],
      description: desc
    };
  } catch (err) {
    console.error('Failed to fetch Jira issue details:', err.message);
    return { summary: null, acceptanceCriteria: null, description: null };
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

module.exports = { updateJiraStoryPoints, updateJiraDescription, getJiraIssueSummary, getJiraIssueDetails, updateJiraAcceptanceCriteria, getJiraDescription };

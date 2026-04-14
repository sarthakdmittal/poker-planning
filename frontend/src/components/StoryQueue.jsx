import React, { useState, useEffect } from 'react';
import { FaList, FaPlus, FaTimes, FaStar, FaRegCircle, FaCode, FaBug, FaBook, FaTasks } from 'react-icons/fa';

const getIssueTypeIcon = (type) => {
  const icons = {
    'Story': <FaBook />,
    'Bug': <FaBug />,
    'Task': <FaTasks />,
    'Epic': <FaStar />,
    'Sub-task': <FaCode />
  };
  return icons[type] || <FaRegCircle />;
};

const StoryQueue = ({
  stories,
  currentStoryIndex,
  onSelectStory,
  onAddStories,
  onRemoveStory,
  onReorderStories,
  isAdmin,
  votes,
  revealed,
  finalPoint
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStoriesInput, setNewStoriesInput] = useState('');
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [storyDetails, setStoryDetails] = useState({});

  // Load saved story details from localStorage whenever stories change
  useEffect(() => {
    const savedDetails = {};
    stories.forEach(story => {
      const saved = localStorage.getItem(`storyDetails_${story.key}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          savedDetails[story.key] = parsed;
          console.log(`Loaded details for ${story.key}:`, parsed.summary);
        } catch (e) {
          console.error('Error parsing saved details for', story.key, e);
        }
      }
    });
    setStoryDetails(savedDetails);
  }, [stories.map(s => s.key).join(',')]); // Re-run when stories change

  // Save story details to localStorage when they are updated via props
  useEffect(() => {
    stories.forEach(story => {
      // Only save if the story has meaningful data
      if (story.summary && story.summary !== `Loading ${story.key}...` && story.summary !== `Story ${story.key}`) {
        const detailsToSave = {
          summary: story.summary,
          type: story.type,
          status: story.status,
          point: story.point,
          savedAt: new Date().toISOString()
        };

        // Check if we need to update localStorage
        const existing = localStorage.getItem(`storyDetails_${story.key}`);
        if (existing) {
          try {
            const parsed = JSON.parse(existing);
            // Only update if data has changed
            if (parsed.summary !== detailsToSave.summary ||
                parsed.type !== detailsToSave.type ||
                parsed.status !== detailsToSave.status ||
                parsed.point !== detailsToSave.point) {
              localStorage.setItem(`storyDetails_${story.key}`, JSON.stringify(detailsToSave));
              console.log(`Updated details for ${story.key}`);
            }
          } catch (e) {
            console.error('Error parsing existing details', e);
            localStorage.setItem(`storyDetails_${story.key}`, JSON.stringify(detailsToSave));
          }
        } else if (detailsToSave.summary !== `Loading ${story.key}...`) {
          // Only save if it's not the loading placeholder
          localStorage.setItem(`storyDetails_${story.key}`, JSON.stringify(detailsToSave));
          console.log(`Saved details for ${story.key}`);
        }
      }
    });
  }, [stories.map(s => `${s.key}-${s.summary}-${s.type}-${s.status}-${s.point}`).join(',')]);

  const handleDragStart = (e, index) => {
    if (!isAdmin) {
      e.preventDefault();
      return;
    }

    // Store the dragged item index in state
    setDraggedItem(index);

    // Set the data in dataTransfer
    e.dataTransfer.setData('application/json', JSON.stringify({
      key: stories[index].key,
      index: index
    }));

    e.dataTransfer.effectAllowed = 'move';

    // Add a class for styling
    e.currentTarget.classList.add('dragging');

    // This helps with some browsers
    e.stopPropagation();
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedItem === null) return;
    setDragOverItem(index);
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();

    // Try to get the dragged index from the draggedItem state first
    let sourceIndex = draggedItem;

    // If draggedItem is null, try to get it from the dataTransfer
    if (sourceIndex === null) {
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        sourceIndex = data.index;
      } catch (error) {
        console.log('Could not parse drag data');
        return;
      }
    }

    if (sourceIndex === null || sourceIndex === undefined || !isAdmin) return;

    // Don't do anything if dropping at the same position
    if (sourceIndex === dropIndex) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    // Create a new array from the current stories
    const newStories = [...stories];

    // Remove the dragged item and insert at new position
    const [draggedStory] = newStories.splice(sourceIndex, 1);
    newStories.splice(dropIndex, 0, draggedStory);

    // Call the parent's reorder function
    onReorderStories(newStories);

    // Reset drag states
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleAddStories = () => {
    const storyList = newStoriesInput
      .split(/\r?\n|,|\s+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(key => ({
        key,
        summary: `Loading ${key}...`,
        type: 'Story',
        status: 'To Do',
        point: null
      }));

    onAddStories(storyList);
    setNewStoriesInput('');
    setShowAddModal(false);
  };

  const getStoryStatus = (story, index) => {
    if (index === currentStoryIndex) return 'current';
    if (story.point) return 'finalized';
    return '';
  };

  // Get the display story with any saved details
  const getDisplayStory = (story, index) => {
    const savedDetail = storyDetails[story.key];
    const isCurrentStory = index === currentStoryIndex;

    // Start with the story object from props
    let displayStory = { ...story };

    // If we have saved details from localStorage, use them as fallback
    if (savedDetail && (!displayStory.summary || displayStory.summary === `Loading ${story.key}...`)) {
      displayStory = {
        ...displayStory,
        summary: savedDetail.summary || displayStory.summary,
        type: savedDetail.type || displayStory.type,
        status: savedDetail.status || displayStory.status,
        point: savedDetail.point || displayStory.point,
      };
    }

    // For current story, we might have fresh data from props (override saved details)
    if (isCurrentStory) {
      // Check if the current story has real data (not placeholder)
      const hasRealData = story.summary &&
                         story.summary !== `Loading ${story.key}...` &&
                         story.summary !== `Story ${story.key}`;

      if (hasRealData) {
        displayStory = {
          ...displayStory,
          summary: story.summary,
          type: story.type !== 'Story' ? story.type : displayStory.type,
          status: story.status !== 'To Do' ? story.status : displayStory.status,
          point: story.point || displayStory.point
        };
      }
    }

    return displayStory;
  };

  return (
    <>
      <div className="story-queue-sidebar">
        <div className="story-queue-header">
          <h3>
            <FaList /> Story Queue
            <span className="story-count-badge">{stories.length}</span>
          </h3>
          {isAdmin && (
            <button
              className="add-story-btn-small"
              onClick={() => setShowAddModal(true)}
              title="Add Stories"
            >
              <FaPlus />
            </button>
          )}
        </div>

        <div className="story-queue-content">
          {stories.length === 0 ? (
            <div className="empty-queue">
              <p>No stories in queue</p>
              {isAdmin && (
                <button onClick={() => setShowAddModal(true)}>
                  <FaPlus /> Add Stories
                </button>
              )}
            </div>
          ) : (
            stories.map((story, index) => {
              const displayStory = getDisplayStory(story, index);
              const status = getStoryStatus(story, index);
              const isDragged = draggedItem === index;
              const isDragOver = dragOverItem === index;
              const isLoading = displayStory.summary === `Loading ${story.key}...`;

              return (
                <div
                  key={`${story.key}-${index}`}
                  className={`story-queue-card ${status} ${isDragged ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${!isAdmin ? 'non-admin' : ''}`}
                  draggable={isAdmin}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  onClick={() => { if (isAdmin) onSelectStory(index); }}
                >
                  <div className="story-number">
                    <span>
                      <span className="story-type-icon">
                        {getIssueTypeIcon(displayStory.type)}
                      </span>
                      {story.key}
                    </span>
                    {index === currentStoryIndex && (
                      <span className="current-indicator" title="Current Story">▶</span>
                    )}
                  </div>

                  <div className="story-summary">
                    {isLoading ? (
                      <span className="loading-summary">
                        <span className="loading-dots">Loading</span>
                      </span>
                    ) : (
                      displayStory.summary || 'No summary available'
                    )}
                  </div>

                  <div className="story-metadata">
                    <span className={`story-status-badge status-${displayStory.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                      {displayStory.status || 'To Do'}
                    </span>
                    {displayStory.point && (
                      <span className="story-point-badge">
                        <FaStar /> {displayStory.point}
                      </span>
                    )}
                  </div>

                  {isAdmin && (
                    <button
                      className="remove-story-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        localStorage.removeItem(`storyDetails_${story.key}`);
                        onRemoveStory(index);
                      }}
                      title="Remove from queue"
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {stories.length > 0 && (
          <div className="story-queue-footer">
            <small>{isAdmin ? 'Drag to reorder • Click to load' : 'View only'}</small>
          </div>
        )}
      </div>

      {/* Add Story Modal */}
      {showAddModal && (
        <div className="story-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="story-modal" onClick={e => e.stopPropagation()}>
            <h3>Add Stories to Queue</h3>
            <p className="input-hint">Enter one issue key per line (e.g., PROJ-123)</p>
            <textarea
              rows={6}
              value={newStoriesInput}
              onChange={e => setNewStoriesInput(e.target.value)}
              placeholder="PROJ-123&#10;PROJ-124&#10;PROJ-125"
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleAddStories}
                disabled={!newStoriesInput.trim()}
              >
                Add to Queue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StoryQueue;
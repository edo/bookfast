/**
 * Main application logic for Bookfast web interface
 */

const app = {
  api: null,
  config: null,
  editingClassId: null,

  /**
   * Initialize the application
   */
  async init() {
    this.api = new GitHubAPI();

    // Set up event listeners
    this.setupEventListeners();

    // Auto-authenticate with hardcoded token
    const token = this.api.getToken();
    await this.authenticate(token);
  },

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Auth
    document.getElementById('save-token-btn').addEventListener('click', () => this.handleSaveToken());
    document.getElementById('github-token').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSaveToken();
    });

    // Class management
    document.getElementById('add-class-btn').addEventListener('click', () => this.showClassModal());
    document.getElementById('cancel-btn').addEventListener('click', () => this.hideClassModal());
    document.getElementById('class-form').addEventListener('submit', (e) => this.handleSaveClass(e));

    // Modal close
    document.querySelector('.modal-close').addEventListener('click', () => this.hideClassModal());
    document.getElementById('class-modal').addEventListener('click', (e) => {
      if (e.target.id === 'class-modal') this.hideClassModal();
    });

    // Actions
    document.getElementById('refresh-btn').addEventListener('click', () => this.loadClasses());
    document.getElementById('test-workflow-btn').addEventListener('click', () => this.triggerWorkflow());
    document.getElementById('view-logs-btn').addEventListener('click', () => this.viewLogs());
  },

  /**
   * Handle save token button click
   */
  async handleSaveToken() {
    const tokenInput = document.getElementById('github-token');
    const token = tokenInput.value.trim();

    if (!token) {
      this.showStatus('auth-status', 'Please enter a token', 'error');
      return;
    }

    await this.authenticate(token);
  },

  /**
   * Authenticate with GitHub
   */
  async authenticate(token) {
    try {
      this.api.setToken(token);

      const user = await this.api.testAuth();

      // Show main content
      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('main-content').style.display = 'block';

      // Load classes
      await this.loadClasses();

    } catch (error) {
      // Show auth section if authentication fails
      document.getElementById('auth-section').style.display = 'block';
      this.showStatus('auth-status', `Authentication failed: ${error.message}`, 'error');
      this.api.clearToken();
    }
  },

  /**
   * Load classes from GitHub
   */
  async loadClasses() {
    try {
      document.getElementById('classes-loading').style.display = 'block';
      document.getElementById('classes-error').style.display = 'none';
      document.getElementById('classes-table').style.display = 'none';
      document.getElementById('no-classes').style.display = 'none';

      this.config = await this.api.getClassConfig();

      document.getElementById('classes-loading').style.display = 'none';

      if (this.config.classes.length === 0) {
        document.getElementById('no-classes').style.display = 'block';
      } else {
        this.renderClassesTable();
        document.getElementById('classes-table').style.display = 'table';
      }

    } catch (error) {
      document.getElementById('classes-loading').style.display = 'none';
      document.getElementById('classes-error').style.display = 'block';
      document.getElementById('classes-error').textContent = `Failed to load classes: ${error.message}`;
    }
  },

  /**
   * Render classes table
   */
  renderClassesTable() {
    const tbody = document.getElementById('classes-tbody');
    tbody.innerHTML = '';

    this.config.classes.forEach(classConfig => {
      const row = document.createElement('tr');

      // Enabled toggle
      const enabledCell = document.createElement('td');
      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'toggle-switch';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = classConfig.enabled;
      checkbox.addEventListener('change', () => this.toggleClass(classConfig.id, checkbox.checked));
      const slider = document.createElement('span');
      slider.className = 'slider';
      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(slider);
      enabledCell.appendChild(toggleLabel);

      // Class name
      const nameCell = document.createElement('td');
      nameCell.textContent = classConfig.className;

      // Day
      const dayCell = document.createElement('td');
      dayCell.textContent = classConfig.dayName;

      // Time
      const timeCell = document.createElement('td');
      timeCell.textContent = classConfig.timeSlot;

      // Actions
      const actionsCell = document.createElement('td');
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'btn btn-secondary';
      editBtn.style.marginRight = '8px';
      editBtn.addEventListener('click', () => this.editClass(classConfig.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'btn btn-danger';
      deleteBtn.addEventListener('click', () => this.deleteClass(classConfig.id));

      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(deleteBtn);

      row.appendChild(enabledCell);
      row.appendChild(nameCell);
      row.appendChild(dayCell);
      row.appendChild(timeCell);
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });
  },

  /**
   * Show class modal for adding or editing
   */
  showClassModal(classConfig = null) {
    this.editingClassId = classConfig?.id || null;

    const modal = document.getElementById('class-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('class-form');

    if (classConfig) {
      title.textContent = 'Edit Class';
      document.getElementById('class-name').value = classConfig.className;
      document.getElementById('class-day').value = `${classConfig.dayOfWeek}:${classConfig.dayName}`;
      document.getElementById('class-time').value = classConfig.timeSlot;
      document.getElementById('class-description').value = classConfig.description || '';
      document.getElementById('class-enabled').checked = classConfig.enabled;
      document.getElementById('class-retries').value = classConfig.retryConfig.maxRetries;
    } else {
      title.textContent = 'Add Class';
      form.reset();
      document.getElementById('class-enabled').checked = true;
      document.getElementById('class-retries').value = 3;
    }

    modal.style.display = 'flex';
  },

  /**
   * Hide class modal
   */
  hideClassModal() {
    document.getElementById('class-modal').style.display = 'none';
    this.editingClassId = null;
  },

  /**
   * Handle save class form submission
   */
  async handleSaveClass(event) {
    event.preventDefault();

    const className = document.getElementById('class-name').value.trim();
    const dayValue = document.getElementById('class-day').value;
    const timeSlot = document.getElementById('class-time').value;
    const description = document.getElementById('class-description').value.trim();
    const enabled = document.getElementById('class-enabled').checked;
    const maxRetries = parseInt(document.getElementById('class-retries').value);

    // Parse day value
    const [dayOfWeek, dayName] = dayValue.split(':');

    // Generate or use existing ID
    const id = this.editingClassId || Validation.generateClassId(className, dayName, timeSlot);

    // Create class config
    const newClass = {
      id,
      enabled,
      className,
      timeSlot,
      dayOfWeek: parseInt(dayOfWeek),
      dayName,
      retryConfig: {
        maxRetries,
        retryDelayMs: 5000
      },
      description: description || `${className} on ${dayName} at ${timeSlot}`
    };

    // Validate
    const errors = Validation.validateClassConfig(newClass);
    if (errors) {
      alert('Validation errors:\n' + Object.values(errors).join('\n'));
      return;
    }

    // Check for duplicates
    const duplicate = Validation.findDuplicateClass(this.config.classes, newClass, this.editingClassId);
    if (duplicate) {
      alert(`A class with the same name, day, and time already exists: ${duplicate.id}`);
      return;
    }

    // Add or update class
    if (this.editingClassId) {
      const index = this.config.classes.findIndex(c => c.id === this.editingClassId);
      this.config.classes[index] = newClass;
    } else {
      this.config.classes.push(newClass);
    }

    // Save to GitHub
    try {
      const commitMessage = this.editingClassId
        ? `Update class: ${className}`
        : `Add class: ${className}`;

      await this.api.updateClassConfig(this.config, commitMessage);

      this.hideClassModal();
      this.showStatus('action-status', 'Class saved successfully!', 'success');
      await this.loadClasses();

    } catch (error) {
      this.showStatus('action-status', `Failed to save: ${error.message}`, 'error');
    }
  },

  /**
   * Toggle class enabled/disabled
   */
  async toggleClass(classId, enabled) {
    const classConfig = this.config.classes.find(c => c.id === classId);
    if (!classConfig) return;

    classConfig.enabled = enabled;

    try {
      await this.api.updateClassConfig(this.config, `${enabled ? 'Enable' : 'Disable'} class: ${classConfig.className}`);
      this.showStatus('action-status', `Class ${enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (error) {
      this.showStatus('action-status', `Failed to update: ${error.message}`, 'error');
      // Revert toggle
      classConfig.enabled = !enabled;
      await this.loadClasses();
    }
  },

  /**
   * Edit a class
   */
  editClass(classId) {
    const classConfig = this.config.classes.find(c => c.id === classId);
    if (classConfig) {
      this.showClassModal(classConfig);
    }
  },

  /**
   * Delete a class
   */
  async deleteClass(classId) {
    const classConfig = this.config.classes.find(c => c.id === classId);
    if (!classConfig) return;

    if (!confirm(`Are you sure you want to delete "${classConfig.className}"?`)) {
      return;
    }

    this.config.classes = this.config.classes.filter(c => c.id !== classId);

    try {
      await this.api.updateClassConfig(this.config, `Delete class: ${classConfig.className}`);
      this.showStatus('action-status', 'Class deleted successfully', 'success');
      await this.loadClasses();
    } catch (error) {
      this.showStatus('action-status', `Failed to delete: ${error.message}`, 'error');
    }
  },

  /**
   * Trigger workflow manually
   */
  async triggerWorkflow() {
    try {
      this.showStatus('action-status', 'Triggering workflow...', 'info');
      await this.api.triggerWorkflow();
      this.showStatus('action-status', 'Workflow triggered! Check GitHub Actions for results.', 'success');
    } catch (error) {
      this.showStatus('action-status', `Failed to trigger workflow: ${error.message}`, 'error');
    }
  },

  /**
   * View logs on GitHub
   */
  async viewLogs() {
    try {
      const repo = await this.api.getRepository();
      const logsUrl = `${repo.html_url}/actions`;
      window.open(logsUrl, '_blank');
    } catch (error) {
      this.showStatus('action-status', `Failed to open logs: ${error.message}`, 'error');
    }
  },

  /**
   * Show status message
   */
  showStatus(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `status-message ${type}`;
    element.style.display = 'block';

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        element.style.display = 'none';
      }, 5000);
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

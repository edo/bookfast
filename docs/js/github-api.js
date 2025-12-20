/**
 * GitHub API Client
 * Handles authentication and API calls to manage class configuration
 */
class GitHubAPI {
  constructor() {
    this.token = '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'; // Hardcoded token
    this.owner = 'edo'; // Hardcoded repository owner
    this.repo = 'bookfast';  // Hardcoded repository name
    this.apiBase = 'https://api.github.com';
    this.configPath = 'config/classes.json';
    this.configSha = null; // SHA of current config file
  }

  /**
   * Set GitHub Personal Access Token
   */
  setToken(token) {
    this.token = token;
    localStorage.setItem('github_token', token);
  }

  /**
   * Get stored token
   */
  getToken() {
    return this.token;
  }

  /**
   * Clear token from storage
   */
  clearToken() {
    this.token = '';
    localStorage.removeItem('github_token');
  }

  /**
   * Get repository info (now hardcoded)
   */
  async detectRepository() {
    // Repository is hardcoded in constructor, just return it
    return { owner: this.owner, repo: this.repo };
  }

  /**
   * Make authenticated request to GitHub API
   */
  async request(endpoint, options = {}) {
    if (!this.token) {
      throw new Error('No GitHub token configured');
    }

    const url = `${this.apiBase}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Test authentication and get user info
   */
  async testAuth() {
    const user = await this.request('/user');
    return user;
  }

  /**
   * Get class configuration from repository
   */
  async getClassConfig() {
    if (!this.owner || !this.repo) {
      await this.detectRepository();
    }

    const data = await this.request(`/repos/${this.owner}/${this.repo}/contents/${this.configPath}`);

    // Store SHA for later updates
    this.configSha = data.sha;

    // Decode base64 content
    const content = atob(data.content);
    return JSON.parse(content);
  }

  /**
   * Update class configuration in repository
   */
  async updateClassConfig(config, commitMessage = 'Update class configuration') {
    if (!this.owner || !this.repo) {
      await this.detectRepository();
    }

    // Get current SHA if not already cached
    if (!this.configSha) {
      const data = await this.request(`/repos/${this.owner}/${this.repo}/contents/${this.configPath}`);
      this.configSha = data.sha;
    }

    // Encode content to base64
    const content = btoa(JSON.stringify(config, null, 2));

    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/contents/${this.configPath}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: commitMessage,
          content: content,
          sha: this.configSha
        })
      }
    );

    // Update SHA
    this.configSha = response.content.sha;

    return response;
  }

  /**
   * Trigger workflow run
   */
  async triggerWorkflow(workflowFile = 'book-classes.yml') {
    if (!this.owner || !this.repo) {
      await this.detectRepository();
    }

    const response = await this.request(
      `/repos/${this.owner}/${this.repo}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main' // or 'master', depending on your default branch
        })
      }
    );

    return response;
  }

  /**
   * Get workflow runs
   */
  async getWorkflowRuns(limit = 5) {
    if (!this.owner || !this.repo) {
      await this.detectRepository();
    }

    const data = await this.request(
      `/repos/${this.owner}/${this.repo}/actions/runs?per_page=${limit}`
    );

    return data.workflow_runs;
  }

  /**
   * Get repository info
   */
  async getRepository() {
    if (!this.owner || !this.repo) {
      await this.detectRepository();
    }

    return await this.request(`/repos/${this.owner}/${this.repo}`);
  }
}

// Export for use in app.js
window.GitHubAPI = GitHubAPI;

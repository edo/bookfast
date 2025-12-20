import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load and parse the class configuration file
 * @param {string} configPath - Path to config file (relative to project root)
 * @returns {Object} Parsed configuration object
 */
export function loadConfig(configPath = 'config/classes.json') {
  try {
    const fullPath = join(__dirname, '..', '..', configPath);
    const configContent = readFileSync(fullPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Validate configuration schema
    validateConfig(config);

    console.log(`Loaded configuration with ${config.classes.length} class(es)`);
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Configuration file not found: ${configPath}`);
      throw new Error(`Configuration file not found: ${configPath}`);
    } else if (error instanceof SyntaxError) {
      console.error(`Invalid JSON in configuration file: ${error.message}`);
      throw new Error(`Invalid JSON in configuration file: ${error.message}`);
    } else {
      console.error(`Error loading configuration: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Validate configuration schema
 * @param {Object} config - Configuration object to validate
 * @throws {Error} If configuration is invalid
 */
function validateConfig(config) {
  if (!config.version) {
    throw new Error('Configuration missing "version" field');
  }

  if (!Array.isArray(config.classes)) {
    throw new Error('Configuration "classes" must be an array');
  }

  if (!config.globalSettings) {
    throw new Error('Configuration missing "globalSettings" field');
  }

  // Validate each class configuration
  config.classes.forEach((classConfig, index) => {
    if (!classConfig.id) {
      throw new Error(`Class at index ${index} missing "id" field`);
    }
    if (typeof classConfig.enabled !== 'boolean') {
      throw new Error(`Class "${classConfig.id}" missing or invalid "enabled" field`);
    }
    if (!classConfig.className) {
      throw new Error(`Class "${classConfig.id}" missing "className" field`);
    }
    if (!classConfig.timeSlot) {
      throw new Error(`Class "${classConfig.id}" missing "timeSlot" field`);
    }
    if (typeof classConfig.dayOfWeek !== 'number' || classConfig.dayOfWeek < 0 || classConfig.dayOfWeek > 6) {
      throw new Error(`Class "${classConfig.id}" has invalid "dayOfWeek" (must be 0-6)`);
    }
    if (!classConfig.dayName) {
      throw new Error(`Class "${classConfig.id}" missing "dayName" field`);
    }
    if (!classConfig.retryConfig) {
      throw new Error(`Class "${classConfig.id}" missing "retryConfig" field`);
    }
  });

  console.log('Configuration validation passed');
}

/**
 * Get classes configured for a specific day of week
 * @param {Object} config - Full configuration object
 * @param {number} dayOfWeek - Day of week (0=Sunday, 6=Saturday)
 * @returns {Array} Array of class configurations for that day
 */
export function getClassesForDay(config, dayOfWeek) {
  return config.classes.filter(c => c.enabled && c.dayOfWeek === dayOfWeek);
}

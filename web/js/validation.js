/**
 * Validation utilities for class configuration
 */

const Validation = {
  /**
   * Validate class name
   */
  validateClassName(name) {
    if (!name || name.trim().length === 0) {
      return 'Class name is required';
    }
    if (name.length > 50) {
      return 'Class name must be less than 50 characters';
    }
    return null;
  },

  /**
   * Validate time slot format (HH:MM)
   */
  validateTimeSlot(time) {
    if (!time) {
      return 'Time slot is required';
    }
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(time)) {
      return 'Time must be in HH:MM format (e.g., 08:30)';
    }
    return null;
  },

  /**
   * Validate day of week
   */
  validateDayOfWeek(day) {
    if (day === '' || day === null || day === undefined) {
      return 'Day of week is required';
    }
    const dayNum = parseInt(day);
    if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
      return 'Invalid day of week';
    }
    return null;
  },

  /**
   * Validate retry count
   */
  validateRetries(retries) {
    if (retries === '' || retries === null || retries === undefined) {
      return 'Max retries is required';
    }
    const retriesNum = parseInt(retries);
    if (isNaN(retriesNum) || retriesNum < 0 || retriesNum > 10) {
      return 'Max retries must be between 0 and 10';
    }
    return null;
  },

  /**
   * Validate class ID (used internally)
   */
  validateClassId(id) {
    if (!id || id.trim().length === 0) {
      return 'Class ID is required';
    }
    // ID should be lowercase, no spaces, only letters, numbers, and hyphens
    const idRegex = /^[a-z0-9-]+$/;
    if (!idRegex.test(id)) {
      return 'Class ID must contain only lowercase letters, numbers, and hyphens';
    }
    return null;
  },

  /**
   * Generate a unique class ID from class name, day, and time
   */
  generateClassId(className, dayName, timeSlot) {
    const cleanName = className.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cleanDay = dayName.substring(0, 3); // First 3 letters of day
    const cleanTime = timeSlot.replace(':', '');
    return `${cleanName}-${cleanDay}-${cleanTime}`;
  },

  /**
   * Validate entire class configuration
   */
  validateClassConfig(classConfig) {
    const errors = {};

    const classNameError = this.validateClassName(classConfig.className);
    if (classNameError) errors.className = classNameError;

    const timeSlotError = this.validateTimeSlot(classConfig.timeSlot);
    if (timeSlotError) errors.timeSlot = timeSlotError;

    const dayError = this.validateDayOfWeek(classConfig.dayOfWeek);
    if (dayError) errors.dayOfWeek = dayError;

    if (classConfig.retryConfig) {
      const retriesError = this.validateRetries(classConfig.retryConfig.maxRetries);
      if (retriesError) errors.maxRetries = retriesError;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  },

  /**
   * Check for duplicate classes (same day + time + name)
   */
  findDuplicateClass(classes, newClass, excludeId = null) {
    return classes.find(c =>
      c.id !== excludeId &&
      c.className === newClass.className &&
      c.dayOfWeek === newClass.dayOfWeek &&
      c.timeSlot === newClass.timeSlot
    );
  }
};

window.Validation = Validation;

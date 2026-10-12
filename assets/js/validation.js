/**
 * BINTH.IN — Client-Side Form Validation Module
 * Semantic, accessible validation for public giveaway and admin forms
 */

export const Validation = {
  /**
   * Validate parent / guardian name
   * Must be at least 2 characters, only letters, spaces, and periods/apostrophes
   */
  validateParentName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, message: 'Please enter your name.' };
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return { valid: false, message: 'Name must be at least 2 characters long.' };
    }
    if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
      return { valid: false, message: 'Please enter a valid name using letters only.' };
    }
    return { valid: true, sanitized: trimmed };
  },

  /**
   * Validate WhatsApp phone number (Indian mobile format: 10 digits, starts with 6-9)
   */
  validateWhatsAppPhone(phone) {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, message: 'Please enter your WhatsApp mobile number.' };
    }
    // Remove all spaces, dashes, parentheses
    const cleanDigits = phone.replace(/[\s\-()]/g, '');
    
    // Check Indian mobile format (+91 optional, followed by 10 digits starting with 6,7,8,9)
    const indianMobileRegex = /^(?:\+91|91)?([6-9]\d{9})$/;
    const match = cleanDigits.match(indianMobileRegex);
    
    if (!match) {
      return { 
        valid: false, 
        message: 'Please enter a valid 10-digit WhatsApp number (e.g. 98470 12345).' 
      };
    }
    
    const formatted = `+91 ${match[1].slice(0, 5)} ${match[1].slice(5)}`;
    return { valid: true, raw: match[1], formatted, sanitized: `+91${match[1]}` };
  },

  /**
   * Validate child's age range selection
   * Allowed: '5–7', '8–10', '11–13', '14–16'
   */
  validateAgeRange(value) {
    const allowed = ['5–7', '8–10', '11–13', '14–16'];
    if (!value || !allowed.includes(value)) {
      return { valid: false, message: 'Please select an age range for her.' };
    }
    return { valid: true, value };
  },

  /**
   * Validate clothing interests selection
   * Must have at least one interest checked
   */
  validateClothingInterests(selectedArray) {
    if (!Array.isArray(selectedArray) || selectedArray.length === 0) {
      return { valid: false, message: 'Please select at least one clothing preference.' };
    }
    return { valid: true, values: selectedArray };
  },

  /**
   * Accessible error renderer helper
   */
  showFieldError(inputEl, errorEl, message) {
    if (!inputEl || !errorEl) return;
    inputEl.setAttribute('aria-invalid', 'true');
    errorEl.textContent = message;
    errorEl.classList.add('visible');
    errorEl.setAttribute('role', 'alert');
  },

  /**
   * Clear accessible error helper
   */
  clearFieldError(inputEl, errorEl) {
    if (!inputEl || !errorEl) return;
    inputEl.removeAttribute('aria-invalid');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
    errorEl.removeAttribute('role');
  }
};

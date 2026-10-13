/**
 * BINTH.IN — Public Giveaway Controller (index.html)
 * 
 * CHANGE REQUEST COMPLIANCE:
 * - Hidden source tracking: Source code is NEVER displayed visibly to participants.
 * - Format validation for source parameter via URLSearchParams.
 * - Form starts & landing visits tracked silently to backend.
 * - Zero mock data: live API integration with honest unavailable states.
 * - Refresh-safe submission confirmation.
 */

import { Api } from './api.js';
import { Validation } from './validation.js';

let countdownTimerId = null;
let currentSourceCode = null;
let formStartTracked = false;
let isSourceValidFormat = true;

document.addEventListener('DOMContentLoaded', async () => {
  initSourceTracking();
  initFormInteractions();
  await loadCampaignData();
});

/**
 * Extract and validate QR source parameter from URL (Hidden from participant)
 */
function initSourceTracking() {
  const urlParams = new URLSearchParams(window.location.search);
  const rawSource = urlParams.get('source');

  if (rawSource !== null && rawSource !== '') {
    const trimmed = rawSource.trim();
    // Validate format: alphanumeric, hyphens, underscores (3 to 35 chars)
    const validFormatRegex = /^[A-Za-z0-9_-]{3,35}$/;
    if (validFormatRegex.test(trimmed)) {
      currentSourceCode = trimmed;
      isSourceValidFormat = true;
      
      // Track landing page visit silently once per session
      const visitTrackKey = `binth_visit_${currentSourceCode}`;
      if (!sessionStorage.getItem(visitTrackKey)) {
        sessionStorage.setItem(visitTrackKey, 'true');
        Api.recordVisit(currentSourceCode).catch(() => {});
      }
    } else {
      currentSourceCode = null;
      isSourceValidFormat = false;
      showSourceFormatError();
    }
  } else {
    // Direct web visitor without source parameter
    currentSourceCode = null;
    isSourceValidFormat = true;
  }
}

function showSourceFormatError() {
  const generalAlert = document.getElementById('formGeneralAlert');
  if (generalAlert) {
    generalAlert.style.display = 'flex';
    generalAlert.className = 'alert alert-warning';
    generalAlert.innerHTML = `
      <div>
        That poster link looked a little different than expected, but you can still enter the giveaway below.
      </div>
    `;
  }
}

/**
 * Fetch campaign details from live backend
 */
async function loadCampaignData() {
  const loadingBanner = document.getElementById('campaignLoadingBanner');
  const campaignNotice = document.getElementById('campaignStatusNotice');
  const heroTitle = document.getElementById('campaignHeroTitle');
  const heroDesc = document.getElementById('campaignHeroDesc');
  const prizeTitle = document.getElementById('prizeTitle');
  const prizeDesc = document.getElementById('prizeDesc');

  if (loadingBanner) loadingBanner.style.display = 'flex';

  const result = await Api.getActiveCampaign(currentSourceCode);

  if (loadingBanner) loadingBanner.style.display = 'none';

  // API returns a flat campaign object directly at result.data (not nested under .campaign)
  if (result.ok && result.data && result.data.id) {
    const campaign = result.data;

    if (heroTitle && campaign.title) heroTitle.textContent = campaign.title;
    if (heroDesc && (campaign.tagline || campaign.description)) {
      heroDesc.textContent = campaign.tagline || campaign.description;
    }
    if (prizeTitle && campaign.prize) prizeTitle.textContent = campaign.prize;
    if (prizeDesc && campaign.description) prizeDesc.textContent = campaign.description;

    if (campaign.endTime && campaign.status === 'active') {
      startCountdown(campaign.endTime);
    } else {
      const status = campaign.status || 'active';
      showTimingUnavailable(
        status === 'scheduled' ? 'This giveaway has not opened yet.' :
        status === 'closed' ? 'This giveaway has closed. Thank you for taking part.' :
        'The closing time will appear here shortly.'
      );
    }
  } else {
    // Honest unavailable state when the server cannot be reached (technical detail goes to the console only)
    console.warn('Campaign load failed:', result.error || 'Server endpoint unreachable');
    if (campaignNotice) {
      campaignNotice.style.display = 'block';
      campaignNotice.textContent = 'We could not load the latest giveaway details. Please refresh in a moment.';
    }
    showTimingUnavailable('The closing time will appear here shortly.');
  }
}

/**
 * Live 48-Hour Countdown Display (stopping at 0)
 */
function startCountdown(endTimeIsoString) {
  const endTime = new Date(endTimeIsoString).getTime();
  const daysEl = document.getElementById('cdDays');
  const hoursEl = document.getElementById('cdHours');
  const minutesEl = document.getElementById('cdMinutes');
  const secondsEl = document.getElementById('cdSeconds');
  const noticeEl = document.getElementById('countdownNotice');

  function update() {
    const now = Date.now();
    const distance = endTime - now;

    if (distance <= 0) {
      clearInterval(countdownTimerId);
      if (daysEl) daysEl.textContent = '00';
      if (hoursEl) hoursEl.textContent = '00';
      if (minutesEl) minutesEl.textContent = '00';
      if (secondsEl) secondsEl.textContent = '00';
      if (noticeEl) {
        noticeEl.textContent = 'The giveaway has closed. Thank you for taking part. The winner will be drawn shortly.';
      }
      const submitBtn = document.getElementById('giveawaySubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Giveaway closed';
      }
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
  }

  update();
  countdownTimerId = setInterval(update, 1000);
}

function showTimingUnavailable(msg) {
  const noticeEl = document.getElementById('countdownNotice');
  if (noticeEl) {
    noticeEl.textContent = msg;
  }
}

/**
 * Form interaction, form start tracking, and client-side validation
 */
function initFormInteractions() {
  const form = document.getElementById('giveawayForm');
  if (!form) return;

  const parentNameInput = document.getElementById('parentName');
  const phoneInput = document.getElementById('whatsappPhone');
  const parentNameError = document.getElementById('parentNameError');
  const phoneError = document.getElementById('phoneError');
  const ageRangeError = document.getElementById('ageRangeError');
  const interestsError = document.getElementById('interestsError');
  const generalAlert = document.getElementById('formGeneralAlert');
  const submitBtn = document.getElementById('giveawaySubmitBtn');

  // Track Form Start event upon first user interaction
  function handleFormStart() {
    if (!formStartTracked && currentSourceCode) {
      formStartTracked = true;
      const startKey = `binth_start_${currentSourceCode}`;
      if (!sessionStorage.getItem(startKey)) {
        sessionStorage.setItem(startKey, 'true');
        Api.recordFormStart(currentSourceCode).catch(() => {});
      }
    }
  }

  form.addEventListener('focusin', handleFormStart, { once: true });
  form.addEventListener('click', handleFormStart, { once: true });

  // Clear errors on input
  if (parentNameInput) {
    parentNameInput.addEventListener('input', () => {
      Validation.clearFieldError(parentNameInput, parentNameError);
    });
  }

  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      Validation.clearFieldError(phoneInput, phoneError);
    });
  }

  // Clear age radio error on select
  const ageRadios = form.querySelectorAll('input[name="ageRange"]');
  ageRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (ageRangeError) {
        ageRangeError.textContent = '';
        ageRangeError.classList.remove('visible');
      }
    });
  });

  // Clear interest checkbox error on select
  const interestChecks = form.querySelectorAll('input[name="clothingInterests"]');
  interestChecks.forEach(check => {
    check.addEventListener('change', () => {
      if (interestsError) {
        interestsError.textContent = '';
        interestsError.classList.remove('visible');
      }
    });
  });

  // Handle Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (generalAlert) {
      generalAlert.style.display = 'none';
      generalAlert.className = 'alert';
    }

    let hasErrors = false;

    // 1. Parent Name Validation
    const nameVal = Validation.validateParentName(parentNameInput ? parentNameInput.value : '');
    if (!nameVal.valid) {
      Validation.showFieldError(parentNameInput, parentNameError, nameVal.message);
      hasErrors = true;
    }

    // 2. WhatsApp Number Validation
    const phoneVal = Validation.validateWhatsAppPhone(phoneInput ? phoneInput.value : '');
    if (!phoneVal.valid) {
      Validation.showFieldError(phoneInput, phoneError, phoneVal.message);
      hasErrors = true;
    }

    // 3. Age Range Selection Validation
    const selectedAge = form.querySelector('input[name="ageRange"]:checked');
    const ageVal = Validation.validateAgeRange(selectedAge ? selectedAge.value : null);
    if (!ageVal.valid) {
      if (ageRangeError) {
        ageRangeError.textContent = ageVal.message;
        ageRangeError.classList.add('visible');
      }
      hasErrors = true;
    }

    // 4. Clothing Interests Selection Validation
    const selectedInterests = Array.from(
      form.querySelectorAll('input[name="clothingInterests"]:checked')
    ).map(cb => cb.value);

    const interestsVal = Validation.validateClothingInterests(selectedInterests);
    if (!interestsVal.valid) {
      if (interestsError) {
        interestsError.textContent = interestsVal.message;
        interestsError.classList.add('visible');
      }
      hasErrors = true;
    }

    if (hasErrors) {
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // Read optional marketing consent
    const consentCb = document.getElementById('marketingConsent');
    const hasMarketingConsent = consentCb ? consentCb.checked : false;

    // Build entry payload with preserved hidden source attribution
    const payload = {
      parentName: nameVal.sanitized,
      whatsappPhone: phoneVal.sanitized,
      ageRange: ageVal.value,
      clothingInterests: interestsVal.values,
      marketingConsent: hasMarketingConsent,
      sourceCode: currentSourceCode || null,
      submittedAt: new Date().toISOString()
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Sending your entry&hellip;';
    }

    // Send to live server endpoint
    const response = await Api.submitEntry(payload);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enter the giveaway';
    }

    if (response.ok) {
      const entryCode = (response.data && response.data.entryCode) || 'ENT-' + Date.now().toString(36).toUpperCase();
      
      // Persist entry summary for dedicated success page
      const maskedPhone = payload.whatsappPhone ? payload.whatsappPhone.slice(0, 4) + '******' : '';
      try {
        sessionStorage.setItem('binth_last_entry', JSON.stringify({
          entryCode: entryCode,
          parentName: payload.parentName,
          phoneMasked: maskedPhone,
          ageRange: payload.ageRange,
          submittedAt: new Date().toLocaleString()
        }));
      } catch (e) {}

      // Redirect to dedicated success confirmation page
      window.location.href = `success.html?entry=${encodeURIComponent(entryCode)}`;
    } else {
      console.warn('Entry submission failed:', response.error || 'Server error');
      if (generalAlert) {
        generalAlert.style.display = 'flex';
        generalAlert.className = 'alert alert-danger';
        generalAlert.innerHTML = `
          <div>
            We could not save your entry just now. ${escapeHtml(response.error || 'Please try again in a moment.')}
          </div>
        `;
        generalAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

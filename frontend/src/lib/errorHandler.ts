// Global error handler to catch and recover from React rendering errors
// This helps prevent black screens and unrecoverable states

/**
 * Initialize global error handlers to catch unhandled exceptions
 * and provide recovery mechanisms
 */
export function initializeGlobalErrorHandlers() {
  // Track error count to prevent infinite loops
  let errorCount = 0;
  const ERROR_THRESHOLD = 3;
  const ERROR_RESET_INTERVAL = 10000; // 10 seconds
  
  // Reset error count periodically
  setInterval(() => {
    if (errorCount > 0) {
      console.log(`Resetting error count from ${errorCount} to 0`);
      errorCount = 0;
    }
  }, ERROR_RESET_INTERVAL);
  
  // Handler for uncaught errors
  const handleGlobalError = (event: ErrorEvent | PromiseRejectionEvent) => {
    // Extract error details
    const error = 'reason' in event ? event.reason : event.error;
    const message = error?.message || 'Unknown error';
    const stack = error?.stack || '';
    
    // Log error details
    console.error('Global error caught:', {
      message,
      stack,
      type: error?.name || 'Error'
    });
    
    // Prevent default browser error handling for ErrorEvent
    if ('preventDefault' in event) {
      event.preventDefault();
    }
    
    // Increment error count
    errorCount++;
    
    // Log to console for debugging
    console.log(`Error count: ${errorCount}/${ERROR_THRESHOLD}`);
    
    // Add visual indicator for users
    showErrorIndicator(message);
    
    // Force reload after multiple errors
    if (errorCount >= ERROR_THRESHOLD) {
      console.log('Error threshold reached, reloading page in 3 seconds');
      
      // Show reload message
      showFatalErrorMessage();
      
      // Reload after delay
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  };
  
  // Add global error handlers
  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handleGlobalError);
  
  // Also check for frozen UI
  initializeFrozenUIDetection();
  
  // Return cleanup function
  return () => {
    window.removeEventListener('error', handleGlobalError);
    window.removeEventListener('unhandledrejection', handleGlobalError as any);
  };
}

/**
 * Detect frozen UI by monitoring render cycles
 */
function initializeFrozenUIDetection() {
  // Last time UI was updated
  let lastUpdateTime = Date.now();
  
  // Update timestamp periodically to indicate UI is responsive
  const updateInterval = setInterval(() => {
    lastUpdateTime = Date.now();
    localStorage.setItem('lastUiUpdate', lastUpdateTime.toString());
  }, 2000);
  
  // Check if UI is frozen
  const checkInterval = setInterval(() => {
    const now = Date.now();
    const diff = now - lastUpdateTime;
    
    // If UI hasn't updated in 15 seconds, consider it frozen
    if (diff > 15000) {
      console.log(`UI appears frozen (${diff}ms since last update), attempting recovery`);
      showFrozenUIMessage();
      
      // Force reload after 5 more seconds if still frozen
      setTimeout(() => {
        const newDiff = Date.now() - lastUpdateTime;
        if (newDiff > 20000) {
          console.log('UI still frozen, forcing reload');
          window.location.reload();
        }
      }, 5000);
    }
  }, 5000);
  
  // Return cleanup function
  return () => {
    clearInterval(updateInterval);
    clearInterval(checkInterval);
  };
}

/**
 * Show error indicator to the user
 */
function showErrorIndicator(message: string) {
  try {
    // Create or update error indicator
    let indicator = document.getElementById('error-indicator');
    
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'error-indicator';
      indicator.style.position = 'fixed';
      indicator.style.bottom = '10px';
      indicator.style.right = '10px';
      indicator.style.backgroundColor = 'rgba(220, 38, 38, 0.9)';
      indicator.style.color = 'white';
      indicator.style.padding = '8px 12px';
      indicator.style.borderRadius = '4px';
      indicator.style.fontSize = '12px';
      indicator.style.zIndex = '9999';
      indicator.style.maxWidth = '300px';
      indicator.style.wordBreak = 'break-word';
      document.body.appendChild(indicator);
    }
    
    indicator.textContent = `Error detected: ${message}`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 5000);
  } catch (e) {
    // Ignore errors in the error handler
    console.error('Error showing error indicator:', e);
  }
}

/**
 * Show fatal error message
 */
function showFatalErrorMessage() {
  try {
    // Create modal-like overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10000';
    
    const message = document.createElement('div');
    message.style.backgroundColor = 'white';
    message.style.padding = '20px';
    message.style.borderRadius = '8px';
    message.style.maxWidth = '400px';
    message.style.textAlign = 'center';
    
    message.innerHTML = `
      <h2 style="margin-top: 0; color: #dc2626;">Application Error</h2>
      <p>Multiple errors detected. The page will reload automatically in a few seconds.</p>
      <button id="reload-now-btn" style="background-color: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
        Reload Now
      </button>
    `;
    
    overlay.appendChild(message);
    document.body.appendChild(overlay);
    
    // Add click handler for reload button
    document.getElementById('reload-now-btn')?.addEventListener('click', () => {
      window.location.reload();
    });
  } catch (e) {
    console.error('Error showing fatal error message:', e);
  }
}

/**
 * Show frozen UI message
 */
function showFrozenUIMessage() {
  try {
    // Create message element
    const message = document.createElement('div');
    message.style.position = 'fixed';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    message.style.color = 'white';
    message.style.padding = '20px';
    message.style.borderRadius = '8px';
    message.style.zIndex = '10000';
    message.style.textAlign = 'center';
    
    message.innerHTML = `
      <h3 style="margin-top: 0;">UI Not Responding</h3>
      <p>The application appears to be frozen. Click the button below to reload.</p>
      <button id="frozen-reload-btn" style="background-color: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
        Reload Page
      </button>
    `;
    
    document.body.appendChild(message);
    
    // Add click handler for reload button
    document.getElementById('frozen-reload-btn')?.addEventListener('click', () => {
      window.location.reload();
    });
  } catch (e) {
    console.error('Error showing frozen UI message:', e);
  }
} 
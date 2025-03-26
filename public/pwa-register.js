// Register the service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(registration => {
        console.log('PWA: Service Worker registered successfully:', registration.scope);
      })
      .catch(error => {
        console.error('PWA: Service Worker registration failed:', error);
      });
  });
}

// PWA installation prompt handling
let deferredPrompt;
const installButton = document.getElementById('pwa-install-button');

window.addEventListener('beforeinstallprompt', (event) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  event.preventDefault();
  
  // Stash the event so it can be triggered later
  deferredPrompt = event;
  
  // Update UI to notify the user they can add to home screen
  if (installButton) {
    installButton.style.display = 'block';
  }
});

// Installation button click handler (to be connected to a button in the UI)
function installPWA() {
  if (!deferredPrompt) {
    return;
  }
  
  // Show the install prompt
  deferredPrompt.prompt();
  
  // Wait for the user to respond to the prompt
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('PWA: User accepted the install prompt');
    } else {
      console.log('PWA: User dismissed the install prompt');
    }
    
    // Clear the saved prompt since it can't be used again
    deferredPrompt = null;
    
    // Hide the install button
    if (installButton) {
      installButton.style.display = 'none';
    }
  });
}

// When the PWA is installed, hide the install button
window.addEventListener('appinstalled', () => {
  console.log('PWA: Application installed');
  
  // Hide the install button
  if (installButton) {
    installButton.style.display = 'none';
  }
  
  // Clear the saved prompt
  deferredPrompt = null;
});

// Handle offline status changes
function updateOnlineStatus() {
  const offlineIndicator = document.getElementById('offline-indicator');
  if (!offlineIndicator) return;
  
  if (navigator.onLine) {
    offlineIndicator.style.display = 'none';
    document.body.classList.remove('is-offline');
  } else {
    offlineIndicator.style.display = 'block';
    document.body.classList.add('is-offline');
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Initial check when the page loads
document.addEventListener('DOMContentLoaded', updateOnlineStatus);

// Export functions for use in components
window.pwa = {
  installPWA
};
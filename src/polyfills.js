// Polyfill for Object.hasOwn
if (!Object.hasOwn) {
  Object.hasOwn = function(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  }
}

// Fix for WebAssembly in Electron
window.addEventListener('DOMContentLoaded', () => {
  // Add any other polyfills needed here
})

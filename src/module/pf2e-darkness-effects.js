import { registerSettings } from './settings.js';

// Initialize module
Hooks.once('init', async () => {
  console.log('pf2e-darkness-effects | Initializing pf2e-darkness-effects');
  registerSettings();
});

#!/usr/bin/env node
import { loadPreferences, savePreferences, resetPreferences } from '../src/local/preferences.mjs';
const [command = 'show', arg] = process.argv.slice(2);
try {
  let result;
  if (command === 'show') result = await loadPreferences();
  else if (command === 'reset') result = await resetPreferences();
  else if (command === 'set') {
    const [key, value] = (arg || '').split('=');
    if (!key || !value) throw new Error('Use: npm run preferences -- set visualStyle=handdrawn');
    result = await savePreferences({ [key]: value });
  } else throw new Error('Use: show | set key=value | reset');
  console.log(JSON.stringify({ stored: 'local-only', preferences: result }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }

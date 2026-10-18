#!/usr/bin/env node
import { getAccessibilityConsent, setAccessibilityConsent } from '../src/native/preferences.mjs';
const action=process.argv[2]||'status';
if (action==='status') console.log((await getAccessibilityConsent())?'enabled':'disabled');
else if (action==='on'||action==='off') {
  await setAccessibilityConsent(action==='on');
  console.log(`Local UI inspection ${action==='on'?'enabled':'disabled'}. OS permission remains separate.`);
} else { console.error('Usage: node scripts/accessibility.mjs status|on|off'); process.exitCode=2; }

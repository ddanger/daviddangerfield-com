#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

// npm run update:resume prints the resume with Playwright's pinned headless
// Chromium; npm install doesn't download browsers, so this does.
function installResumeBrowser() {
  console.log('Installing the headless Chromium that npm run update:resume prints with...')
  const result = spawnSync('npx', ['playwright-core', 'install', 'chromium-headless-shell'], {
    stdio: 'inherit',
  })
  if (result.error || result.status !== 0) {
    console.error('Error: failed to install Playwright headless Chromium.')
    process.exit(1)
  }
}

installResumeBrowser()
console.log('Setup complete.')

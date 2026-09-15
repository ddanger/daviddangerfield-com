#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { checkCommand, hasDrawtextFilter, HOMEBREW_FFMPEG_FULL_BIN } from './lib/ffmpeg.mjs'

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function run(bin, args, opts = {}) {
  const result = spawnSync(bin, args, {
    stdio: 'inherit',
    env: process.env,
    ...opts,
  })

  if (result.error || result.status !== 0) {
    return false
  }

  return true
}

function ensureFfmpegFullOnMac() {
  if (process.platform !== 'darwin') {
    console.log('Skipping Homebrew ffmpeg-full setup (non-macOS platform).')
    return
  }

  const brewOk = run('brew', ['--version'])
  if (!brewOk) {
    fail(
      'Homebrew is required on macOS to install ffmpeg-full. Install Homebrew and rerun npm run setup:init.',
    )
  }

  const ffmpegCandidates = ['ffmpeg', HOMEBREW_FFMPEG_FULL_BIN]

  for (const bin of ffmpegCandidates) {
    const versionCheck = checkCommand(bin, ['-version'])
    if (versionCheck.error || versionCheck.status !== 0) {
      continue
    }

    if (hasDrawtextFilter(bin)) {
      console.log(`FFmpeg drawtext support detected via ${bin}.`)
      return
    }
  }

  console.log('Installing ffmpeg-full via Homebrew (required for drawtext)...')
  const installOk = run('brew', ['install', 'ffmpeg-full'])
  if (!installOk) {
    fail('Failed to install ffmpeg-full with Homebrew.')
  }

  if (!hasDrawtextFilter(HOMEBREW_FFMPEG_FULL_BIN)) {
    fail(
      'ffmpeg-full installed but drawtext filter is still unavailable. Check Homebrew installation.',
    )
  }

  console.log('ffmpeg-full installed and drawtext support verified.')
}

function main() {
  console.log('Running initial setup checks...')
  ensureFfmpegFullOnMac()
  console.log('Initial setup checks complete. Running npm install next...')
}

main()

// Generates the /resume/ link-preview image from the resume PDF. Run it through
// `npm run update:resume`, which also bumps the resume version.

import { access, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { checkCommand, hasDrawtextFilter, HOMEBREW_FFMPEG_FULL_BIN } from './lib/ffmpeg.mjs'

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = join(SCRIPTS_DIR, '..')
const FAVICON_PATH = 'favicon-48x48.png'

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = {
    input: '',
    output: 'images/social/resume-share.png',
    title: 'David Dangerfield Resume',
    fontBold: '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
    fontRegular: '/System/Library/Fonts/Supplemental/Arial.ttf',
    ffmpegBin: '',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]

    if (token === '--input') {
      args.input = argv[i + 1] || ''
      i += 1
      continue
    }

    if (token === '--output') {
      args.output = argv[i + 1] || args.output
      i += 1
      continue
    }

    if (token === '--title') {
      args.title = argv[i + 1] || args.title
      i += 1
      continue
    }

    if (token === '--font-bold') {
      args.fontBold = argv[i + 1] || args.fontBold
      i += 1
      continue
    }

    if (token === '--font-regular') {
      args.fontRegular = argv[i + 1] || args.fontRegular
      i += 1
      continue
    }

    if (token === '--ffmpeg-bin') {
      args.ffmpegBin = argv[i + 1] || args.ffmpegBin
      i += 1
      continue
    }

    if (token === '--help' || token === '-h') {
      console.log(
        `\nUsage: node scripts/generate-resume-share.mjs --input <path> [options]\n\nOptions:\n  --output <path>        Output image path (default: images/social/resume-share.png)\n  --title <text>         Main banner text (default: David Dangerfield Resume)\n  --font-bold <path>     Font file for title\n  --font-regular <path>  Font file for (PDF) label\n  --ffmpeg-bin <path>    Override ffmpeg binary path\n  -h, --help             Show help\n`,
      )
      process.exit(0)
    }

    fail(`Unknown argument: ${token}`)
  }

  return args
}

function toAbsolute(workspaceRelativeOrAbsolutePath) {
  if (!workspaceRelativeOrAbsolutePath) return ''
  if (workspaceRelativeOrAbsolutePath.startsWith('/')) {
    return workspaceRelativeOrAbsolutePath
  }
  return resolve(ROOT_DIR, workspaceRelativeOrAbsolutePath)
}

function escapeDrawText(value) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(':', '\\:')
    .replaceAll("'", "\\'")
    .replaceAll(',', '\\,')
}

async function ensureReadable(pathToFile, label) {
  try {
    await access(pathToFile, constants.R_OK)
  } catch {
    fail(`${label} not readable: ${pathToFile}`)
  }
}

function resolveFfmpegBin(preferredBin = '') {
  const candidates = [
    preferredBin,
    process.env.FFMPEG_BIN || '',
    'ffmpeg',
    process.platform === 'darwin' ? HOMEBREW_FFMPEG_FULL_BIN : '',
  ]

  const seen = new Set()
  const foundWithoutDrawtext = []

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) {
      continue
    }
    seen.add(candidate)

    const versionCheck = checkCommand(candidate, ['-version'])
    if (versionCheck.error || versionCheck.status !== 0) {
      continue
    }

    if (hasDrawtextFilter(candidate)) {
      return candidate
    }

    foundWithoutDrawtext.push(candidate)
  }

  if (foundWithoutDrawtext.length > 0) {
    fail(
      `ffmpeg was found but does not include the drawtext filter (${foundWithoutDrawtext.join(', ')}). Install Homebrew ffmpeg-full and ensure /opt/homebrew/opt/ffmpeg-full/bin is in PATH, or pass --ffmpeg-bin /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg.`,
    )
  }

  fail('ffmpeg is required but was not found on PATH. Install ffmpeg-full with Homebrew.')
}

function ensureSipsInstalled() {
  const check = spawnSync('sips', ['--help'], { encoding: 'utf8' })
  if (check.error || check.status !== 0) {
    fail('sips is required for PDF input but was not found on PATH.')
  }
}

async function prepareInputSource(inputAbs) {
  const extension = extname(inputAbs).toLowerCase()

  if (extension !== '.pdf') {
    return { sourcePath: inputAbs, tempDir: '' }
  }

  ensureSipsInstalled()

  const tempDir = await mkdtemp(join(tmpdir(), 'resume-share-'))
  const sourcePath = join(tempDir, 'resume-source.png')
  const conversion = spawnSync('sips', ['-s', 'format', 'png', inputAbs, '--out', sourcePath], {
    stdio: 'inherit',
  })

  if (conversion.error || conversion.status !== 0) {
    fail('Failed to extract PNG from PDF input via sips.')
  }

  return { sourcePath, tempDir }
}

function runFfmpeg({
  ffmpegBin,
  inputAbs,
  outputAbs,
  title,
  fontBoldAbs,
  fontRegularAbs,
  faviconAbs,
}) {
  const titleEscaped = escapeDrawText(title)

  const sceneFilter =
    [
      'color=c=0xFFFAF2:s=1200x630',
      'format=rgba',
      "geq=r='clip(255+(21-255)*0.14*max(0,1-sqrt((X-180)*(X-180)+(Y-126)*(Y-126))/480)+(198-255)*0.12*max(0,1-sqrt((X-960)*(X-960)+(Y-63)*(Y-63))/540),0,255)':g='clip(250+(94-250)*0.14*max(0,1-sqrt((X-180)*(X-180)+(Y-126)*(Y-126))/480)+(93-250)*0.12*max(0,1-sqrt((X-960)*(X-960)+(Y-63)*(Y-63))/540),0,255)':b='clip(242+(99-242)*0.14*max(0,1-sqrt((X-180)*(X-180)+(Y-126)*(Y-126))/480)+(46-242)*0.12*max(0,1-sqrt((X-960)*(X-960)+(Y-63)*(Y-63))/540),0,255)':a='255'",
      'format=rgba',
      'colorchannelmixer=aa=1',
      'drawbox=x=290:y=164:w=620:h=468:color=0x111111@0.06:t=fill',
      'drawbox=x=286:y=154:w=628:h=470:color=0xFFFAF2@0.92:t=fill',
      'drawbox=x=286:y=154:w=628:h=470:color=0xD9D1C3@0.78:t=2',
    ].join(',') + '[scene]'

  const documentFilter =
    [
      '[0:v]scale=604:782:flags=lanczos',
      'crop=604:446:0:0',
      'gblur=sigma=4',
      'format=rgba',
      'colorchannelmixer=aa=0.9',
    ].join(',') + '[doc]'

  const bannerFilter = [
    "[2:v]format=rgba,geq=r='21+18*Y/147':g='94+27*Y/147':b='99+11*Y/147':a='255'[banner]",
  ].join(',')

  const textFilter =
    [
      '[with_banner]drawbox=x=0:y=140:w=iw:h=7:color=0xC65D2E@0.98:t=fill',
      'drawbox=x=iw-76:y=13:w=60:h=60:color=0xFFFAF2@0.18:t=fill',
      `drawtext=fontfile='${fontBoldAbs}':text='${titleEscaped}':fontcolor=0xFFFAF2:fontsize=60:x=80:y=45`,
      `drawtext=fontfile='${fontBoldAbs}':text='PDF':fontcolor=0xF2C14E:fontsize=42:x=955:y=60`,
    ].join(',') + '[base]'

  const logoFilter = '[1:v]scale=46:46:flags=lanczos,format=rgba[logo]'
  const composeFilter = '[scene][doc]overlay=x=(main_w-overlay_w)/2:y=166[with_doc]'
  const bannerComposeFilter = '[with_doc][banner]overlay=x=0:y=0[with_banner]'
  const overlayFilter = '[base][logo]overlay=x=main_w-69:y=20:format=auto[out]'
  const filterComplex = `${sceneFilter};${documentFilter};${bannerFilter};${composeFilter};${bannerComposeFilter};${textFilter};${logoFilter};${overlayFilter}`

  const result = spawnSync(
    ffmpegBin,
    [
      '-y',
      '-i',
      inputAbs,
      '-i',
      faviconAbs,
      '-f',
      'lavfi',
      '-i',
      'color=c=black:s=1200x148',
      '-filter_complex',
      filterComplex,
      '-map',
      '[out]',
      '-frames:v',
      '1',
      '-update',
      '1',
      outputAbs,
    ],
    { stdio: 'inherit' },
  )

  if (result.error || result.status !== 0) {
    fail('ffmpeg failed to generate the image.')
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.input) {
    fail('Missing required argument: --input')
  }

  const inputAbs = toAbsolute(args.input)
  const outputAbs = toAbsolute(args.output)
  const fontBoldAbs = toAbsolute(args.fontBold)
  const fontRegularAbs = toAbsolute(args.fontRegular)
  const faviconAbs = toAbsolute(FAVICON_PATH)
  const ffmpegBin = resolveFfmpegBin(args.ffmpegBin)

  await ensureReadable(inputAbs, 'Input image')
  await ensureReadable(fontBoldAbs, 'Bold font')
  await ensureReadable(fontRegularAbs, 'Regular font')
  await ensureReadable(faviconAbs, 'Favicon image')
  await mkdir(dirname(outputAbs), { recursive: true })

  const prepared = await prepareInputSource(inputAbs)

  runFfmpeg({
    ffmpegBin,
    inputAbs: prepared.sourcePath,
    outputAbs,
    title: args.title,
    fontBoldAbs,
    fontRegularAbs,
    faviconAbs,
  })

  if (prepared.tempDir) {
    await rm(prepared.tempDir, { recursive: true, force: true })
  }

  console.log(`\nGenerated: ${outputAbs}`)
}

main().catch((err) => {
  fail(err.message)
})

#!/usr/bin/env node
// Prints every file build.mjs writes, one per line. Used by
// generated-output-sync.yml so its commit guard reads the same list
// verify-generated.mjs checks, instead of carrying its own copy.
import { listGeneratedFiles } from './lib/generated-files.mjs'

const files = await listGeneratedFiles()
console.log(files.join('\n'))

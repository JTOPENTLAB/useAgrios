#!/usr/bin/env node
// Extracts every inline <script>...</script> block from the given HTML
// file(s) and runs `node --check` on each one. This is exactly the check
// that would have caught the "SyntaxError: Unexpected string literal"
// regression that broke every button on the site (unescaped quotes inside
// a string in buildOppCards() around index.html:1588) before it reached
// production.
//
// Usage: node scripts/check-inline-js.js index.html manage.html

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/check-inline-js.js <file.html> [more.html ...]');
  process.exit(2);
}

let hadError = false;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const scriptRe = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match;
  let index = 0;
  let sawInline = false;

  while ((match = scriptRe.exec(html)) !== null) {
    const openTag = match[0].slice(0, match[0].indexOf('>') + 1);
    // Skip <script src="..."> (external scripts, nothing to check locally)
    if (/\bsrc\s*=/.test(openTag)) continue;
    const code = match[1];
    if (!code.trim()) continue;
    sawInline = true;
    index++;

    const tmpFile = path.join(os.tmpdir(), `${path.basename(file)}.inline-${index}.js`);
    fs.writeFileSync(tmpFile, code);
    try {
      execFileSync(process.execPath, ['--check', tmpFile], { stdio: 'pipe' });
      console.log(`OK   ${file} (inline <script> #${index}, ${code.length} chars)`);
    } catch (e) {
      hadError = true;
      console.error(`FAIL ${file} (inline <script> #${index}):`);
      console.error(e.stderr ? e.stderr.toString() : e.message);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  }

  if (!sawInline) {
    console.log(`(no inline <script> blocks found in ${file})`);
  }
}

if (hadError) {
  console.error('\nSyntax check FAILED — do not deploy.');
  process.exit(1);
} else {
  console.log('\nAll inline scripts parse cleanly.');
}

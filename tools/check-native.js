#!/usr/bin/env node
/* Fails when the installed production dependency tree contains anything
   that needs a compiler or downloads a binary: gyp files, install scripts,
   prebuilt .node addons or optionalDependencies (ROADMAP D-1 / task 3).
   Run after `npm ci --omit=dev` or on a full install (devDependencies are
   skipped by walking the lockfile's dev flags). */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const problems = [];

for (const [pkgPath, entry] of Object.entries(lock.packages)) {
    if (!pkgPath || entry.dev) {
        continue;
    }

    const name = pkgPath.replace(/^.*node_modules\//, '');
    if (entry.hasInstallScript) {
        problems.push(`${name}@${entry.version}: has an install script`);
    }

    if (entry.optional) {
        problems.push(`${name}@${entry.version}: optional dependency (usually a native fallback)`);
    }

    const dir = path.join(root, pkgPath);
    if (fs.existsSync(dir)) {
        if (fs.existsSync(path.join(dir, 'binding.gyp'))) {
            problems.push(`${name}@${entry.version}: ships binding.gyp`);
        }

        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        if (pkg.gypfile || pkg.binary) {
            problems.push(`${name}@${entry.version}: package.json declares gypfile/binary`);
        }

        const scripts = pkg.scripts || {};
        for (const key of ['preinstall', 'install', 'postinstall']) {
            if (scripts[key]) {
                problems.push(`${name}@${entry.version}: ${key} script "${scripts[key]}"`);
            }
        }

        const stack = [dir];
        while (stack.length > 0) {
            const current = stack.pop();
            for (const dirent of fs.readdirSync(current, {withFileTypes: true})) {
                if (dirent.name === 'node_modules') {
                    continue;
                }

                const full = path.join(current, dirent.name);
                if (dirent.isDirectory()) {
                    stack.push(full);
                } else if (dirent.name.endsWith('.node')) {
                    problems.push(`${name}@${entry.version}: ships ${path.relative(dir, full)}`);
                }
            }
        }
    }
}

const count = Object.values(lock.packages).filter((entry, i) => i > 0 && !entry.dev).length;
if (problems.length > 0) {
    console.error('native/binary dependencies found (ROADMAP D-1):');
    for (const problem of problems) {
        console.error('  - ' + problem);
    }

    process.exit(1);
}

console.log(`ok: ${count} production packages, none native`);

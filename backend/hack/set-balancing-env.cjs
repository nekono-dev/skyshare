#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function loadBalancing() {
  const launchEnv = process.env.LAUNCH_ENV;
  const candidates = [];
  if (launchEnv) candidates.push(`balancing.${launchEnv}.json`);
  candidates.push('balancing.json');

  for (const name of candidates) {
    const p = path.resolve(process.cwd(), name);
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8');
        JSON.parse(content);
        return content;
      } catch (e) {
        console.warn(`[set-balancing-env.cjs] failed to parse ${p}: ${e && e.message}`);
      }
    }
  }
  return null;
}

const balancing = loadBalancing();
if (balancing) {
  console.info('[set-balancing-env.cjs] DB_ENDPOINT_RULE loaded from balancing file');
} else {
  console.info('[set-balancing-env.cjs] no balancing file found, leaving DB_ENDPOINT_RULE as-is');
}


const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node set-balancing-env.cjs [--write-env <file>] -- <command>');
  // allow no-op: exit success if nothing to do
}

let cmdArgs = args;
if (args[0] === '--') cmdArgs = args.slice(1);

// If invoked as: --write-env <file>, perform write and exit
if (cmdArgs[0] === '--write-env' && cmdArgs[1]) {
  const envFileCandidate = cmdArgs[1];
  if (!balancing) {
    console.info('[set-balancing-env.cjs] no balancing file found; nothing to write');
    process.exit(0);
  }
  const envPath = path.resolve(process.cwd(), envFileCandidate);
  try {
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }
    const sanitized = balancing.replace(/\s+/g, '');
    const line = `DB_ENDPOINT_RULE='${sanitized.replace(/'/g, "\\'")}'`;

    if (/^DB_ENDPOINT_RULE=/m.test(content)) {
      content = content.replace(/^DB_ENDPOINT_RULE=.*$/m, line);
    } else {
      if (content.length && !content.endsWith('\n')) content += '\n';
      content += line + '\n';
    }

    fs.writeFileSync(envPath, content, 'utf8');
    console.info(`[set-balancing-env.cjs] wrote DB_ENDPOINT_RULE to ${envPath}`);
    process.exit(0);
  } catch (e) {
    console.warn(`[set-balancing-env.cjs] failed to write env file ${envFileCandidate}: ${e && e.message}`);
    process.exit(1);
  }
}

// If balancing exists, and command includes `-e <envfile>` (dotenv usage),
// update that env file's DB_ENDPOINT_RULE before spawning the child.
if (balancing) {
  // find -e <file> in cmdArgs
  for (let i = 0; i < cmdArgs.length; i++) {
    if ((cmdArgs[i] === '-e' || cmdArgs[i] === '--env') && cmdArgs[i + 1]) {
      const envFileCandidate = cmdArgs[i + 1];
      const envPath = path.resolve(process.cwd(), envFileCandidate);
      try {
        let content = '';
        if (fs.existsSync(envPath)) {
          content = fs.readFileSync(envPath, 'utf8');
        }
        const sanitized = balancing.replace(/\s+/g, '');
        const line = `DB_ENDPOINT_RULE='${sanitized.replace(/'/g, "\\'")}'`;

        if (/^DB_ENDPOINT_RULE=/m.test(content)) {
          content = content.replace(/^DB_ENDPOINT_RULE=.*$/m, line);
        } else {
          if (content.length && !content.endsWith('\n')) content += '\n';
          content += line + '\n';
        }

        fs.writeFileSync(envPath, content, 'utf8');
        console.info(`[set-balancing-env.cjs] wrote DB_ENDPOINT_RULE to ${envPath}`);
      } catch (e) {
        console.warn(`[set-balancing-env.cjs] failed to write env file ${envFileCandidate}: ${e && e.message}`);
      }
      break;
    }
  }

  // also set in current process env for immediate child inheritance
  process.env.DB_ENDPOINT_RULE = balancing;
}

const cmd = cmdArgs.join(' ');
const child = spawn(cmd, { stdio: 'inherit', shell: true, env: { ...process.env } });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code === null ? 0 : code);
});

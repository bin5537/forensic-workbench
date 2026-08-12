// Cross-platform Electron launcher.
// Some environments (sandboxes, certain shells) export ELECTRON_RUN_AS_NODE=1,
// which makes the Electron binary behave as plain Node — then require('electron')
// returns a path string and `app` is undefined. Electron checks for the variable's
// *presence*, so it must be deleted (not merely emptied) before spawning.
const { spawn } = require('child_process')

delete process.env.ELECTRON_RUN_AS_NODE

// When this script runs under Node, require('electron') resolves to the binary path.
const electronPath = require('electron')

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: process.env
})

child.on('close', (code) => process.exit(code == null ? 0 : code))
child.on('error', (err) => {
  console.error('Failed to launch Electron:', err)
  process.exit(1)
})

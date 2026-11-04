'use strict';
// Only adapts the CLI's existing OS credential namespace; never exports a credential.
const os = require('node:os'), hostname = os.hostname;
os.hostname = () => hostname().replace(/[^\x20-\x7e]/g, '_');
require('node:module').syncBuiltinESMExports();
if (process.env.CBOT_CREDENTIAL_ACCOUNT) {
  try {
    const { createRequire } = require('node:module');
    const keytar = createRequire(process.env.CBOT_CLI_PATH)('@github/keytar');
    const get = keytar.getPassword.bind(keytar);
    keytar.getPassword = (service, account) => get(service, service === 'baw' && account === 'agentSessionId' ? process.env.CBOT_CREDENTIAL_ACCOUNT : account);
    // A dashboard process must not clear or replace a saved credential.
    keytar.setPassword = keytar.deletePassword = async () => { throw Error('Dashboard is read-only'); };
  } catch { /* CLI handles unavailable credential stores itself. */ }
}

// Run locally, never in the browser. Passwords are read without terminal echo.
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {createAdminLock} from '../lib/admin.js';
const generated=process.argv.includes('--generate');
const noteArg=process.argv.indexOf('--note');
const notePath=noteArg>=0?process.argv[noteArg+1]:null;
async function hiddenInput(label){
  process.stdout.write(label);process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((resolve,reject)=>{
    let value='';
    function done(){process.stdin.removeListener('data',handle);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(value);}
    function handle(buffer){for(const char of buffer.toString()){if(char==='\r'||char==='\n'){done();return;}if(char==='\u0003'){process.stdin.setRawMode(false);process.exit(130);}if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else value+=char;}}
    process.stdin.on('data',handle);process.stdin.once('error',reject);
  });
}
let password;
if(generated){if(!notePath)throw Error('--generate requires --note with a path outside the repository.');password='LC-'+randomBytes(18).toString('base64url');}
else if(process.stdin.isTTY){password=await hiddenInput('New administrator password (at least 16 characters): ');if(password!==await hiddenInput('Confirm password: '))throw Error('Passwords do not match.');}
else{password=(await readFile(0,'utf8')).replace(/\r?\n$/,'');}
if(notePath){
  const {resolve,relative}=await import('node:path');
  const rel=relative(resolve('.'),resolve(notePath));if(!rel.startsWith('..'))throw Error('Save the private access note outside the public repository.');
}
const lock=await createAdminLock(password);
// Save the private note before changing the public lock so it cannot be lost.
if(notePath)await writeFile(notePath,`School Navigator — Administrator Access\n\nWebsite: https://induwaralasindu.github.io/school-map/\n\nPassword: ${password}\n\nHow to open the editor\n1. Tap the small padlock beside the GitHub credit at the bottom of the page.\n   Or open https://induwaralasindu.github.io/school-map/#admin\n2. Enter the password above, then choose Unlock editor.\n3. Make your edits. Private drafts save on this device.\n4. Export campus.json and replace data/campus.json in your GitHub repository to publish.\n5. Choose Lock editor when you finish. Refresh also locks it.\n\nThe password is never sent to a server. It unlocks the editor controls and encrypted local drafts. GitHub repository permissions protect publishing. The map data and source code remain public because this is a GitHub Pages website. A client-side gate is not a server authorization system.\n\nKeep this note private. Do not commit it to GitHub.\n\nChanging the password\nExport any private drafts first. In a local checkout, run node tools/configure-admin.mjs, enter a new password twice, and commit data/admin-lock.json. Old encrypted drafts need the previous password/configuration; export them before rotating.\n`,{mode:0o600,flag:'wx'});
await writeFile(new URL('../data/admin-lock.json',import.meta.url),JSON.stringify(lock,null,2)+'\n');
process.stdout.write('Administrator access configured. Only the encrypted lock belongs in the public repository.\n');

import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=['app.js','service-worker.js',...readdirSync('lib').filter(f=>f.endsWith('.js')).map(f=>'lib/'+f),...readdirSync('tools').filter(f=>f.endsWith('.mjs')).map(f=>'tools/'+f)];
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
process.stdout.write(`Syntax checked ${files.length} application and maintenance files.\n`);

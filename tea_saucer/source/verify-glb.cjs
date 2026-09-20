const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const validator = require(path.resolve(root, '../../.tea-preview-tools/node_modules/gltf-validator'));
validator.validateBytes(new Uint8Array(fs.readFileSync(path.join(root, 'exclusive-tea.glb'))), {uri:'exclusive-tea.glb', maxIssues:1000}).then(report => {
  fs.writeFileSync(path.join(root, 'gltf-validation.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({errors:report.issues.numErrors,warnings:report.issues.numWarnings,infos:report.issues.numInfos,messages:report.issues.messages},null,2));
  if(report.issues.numErrors)process.exitCode=1;
});

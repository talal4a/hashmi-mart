const fs = require('fs');
const path = require('path');
const pkgPath = path.join(__dirname, '..', 'node_modules', 'metro-core', 'package.json');
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.exports['./src/*']) {
    pkg.exports['./src/*'] = './src/*';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log('Fixed metro-core exports');
  }
} catch (e) {}

// Serve a local QA manifest pointing at the real Home components. Production
// index.js, authentication and package.json remain untouched.
// Start Metro normally, then: node tests/cart/serve-native.cjs
const http = require('node:http');

http.createServer(async (request, response) => {
  try {
    const upstream = await fetch('http://127.0.0.1:8081/', {
      headers: {
        accept: 'application/expo+json',
        'expo-platform': request.headers['expo-platform'] || 'ios',
      },
    });
    const manifest = await upstream.json();
    manifest.launchAsset.url = manifest.launchAsset.url.replace('/index.bundle', '/tests/cart/native-entry.bundle');
    response.writeHead(200, {
      'content-type': 'application/expo+json',
      'expo-protocol-version': '0',
      'expo-sfv-version': '0',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify(manifest));
  } catch (error) {
    response.writeHead(502);
    response.end('Start Metro on port 8081 before the cart QA preview.');
  }
}).listen(8083, '127.0.0.1', () => {
  console.log('Cart native QA: enter http://127.0.0.1:8083 in the development client.');
});

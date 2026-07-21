import { access } from 'node:fs/promises';

const required = [
  'public/index.html',
  'public/css/app.css',
  'public/js/app.js',
  'netlify/functions/resolve-feeds.mjs'
];

await Promise.all(required.map((file) => access(new URL(`../${file}`, import.meta.url))));
console.log('Static files and Netlify Function are present. No build output is required.');

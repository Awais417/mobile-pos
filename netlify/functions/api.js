// Netlify Function — wraps the compiled NestJS app as a serverless handler
const { handler } = require('../../apps/api/dist/serverless');

exports.handler = handler;

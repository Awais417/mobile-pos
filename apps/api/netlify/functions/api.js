// Netlify Function — wraps the compiled NestJS app as a serverless handler
const { handler } = require('../../dist/serverless');

exports.handler = handler;

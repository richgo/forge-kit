import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url));
const server = createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
});

server.listen(0, '127.0.0.1', () => console.log(server.address().port));

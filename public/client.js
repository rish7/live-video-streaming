const ws = new WebSocket('ws://localhost:8080');
ws.addEventListener('open', () => {
  const data = { message: 'Hello from the client!' }
  const json = JSON.stringify(data);
  setInterval((json) => {
    //ws.send(json);
  }, 3000, json);
});
ws.addEventListener('message', event => {
  console.log(event.data);
});
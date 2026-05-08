import { v4 as uuidv4 } from 'uuid';

async function testWhatIf() {
  const body = {
    jsonrpc: '2.0', id: 'what-if-test', method: 'message/send',
    params: {
      message: {
        messageId: uuidv4(), role: 'user',
        parts: [{ kind: 'text', text: 'What if we use Ribociclib instead of Palbociclib?' }],
      },
    },
  };

  const start = Date.now();
  const resp = await fetch('http://localhost:8003/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'contextmd-key-001' },
    body: JSON.stringify(body),
  });

  const data = await resp.json() as any;
  const elapsed = Date.now() - start;
  
  console.log(`Response time: ${elapsed}ms`);
  console.log(data?.result?.parts?.[0]?.text || data);
}

testWhatIf().catch(console.error);

// 政見語音指令測試用的假語音合成服務（node:http，只匯出函式，載入時沒有副作用）。
// 記下每個請求，回固定位元組「FAKE-MP3:<文字>」當 mp3，x-used-quota 回字數加 1。
// statuses 依序決定前幾個請求的狀態碼（之後都回 200），用來模擬暫時失敗；quotaHeader 為 false 時不回點數標頭；
// audio 給了位元組時改回這段位元組（例如真的 mp3），測真 ffmpeg 轉碼用。
import { createServer } from 'node:http';

export async function startFakeSpeechService({ statuses = [], quotaHeader = true, audio = null } = {}) {
  const requests = [];
  let active = 0;
  let maxActive = 0;
  const server = createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8').on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const json = JSON.parse(body);
      requests.push({ headers: req.headers, body: json });
      const status = statuses.shift() ?? 200;
      setTimeout(() => {
        active -= 1;
        if (status !== 200) {
          res.writeHead(status).end('暫時失敗');
          return;
        }
        const text = json.input.voai_script_text;
        const headers = { 'content-type': 'audio/mpeg' };
        if (quotaHeader) headers['x-used-quota'] = String([...text].length + 1);
        res.writeHead(200, headers).end(audio ?? Buffer.from(`FAKE-MP3:${text}`));
      }, 30);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/TTS/generate-voice`,
    requests,
    maxActive: () => maxActive,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

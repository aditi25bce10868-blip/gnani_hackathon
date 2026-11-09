import { transcribeDetailed } from '../serverVoice';

const cfg = { baseUrl: 'https://x.test', appToken: 't' };
const reply = (body: unknown) => jest.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe('transcribeDetailed', () => {
  it('returns the text and the language Gnani says it heard', async () => {
    const f = reply({ text: 'नमस्ते', detected: 'hi-IN' });
    expect(await transcribeDetailed(cfg, 'AAAA', 'hi', f, { mix: ['en'] })).toEqual({ text: 'नमस्ते', detected: 'hi-IN' });
    const sent = JSON.parse(((f as unknown as jest.Mock).mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(sent).toEqual({ audio_base64: 'AAAA', language: 'hi', mix: ['en'] });
  });
  it('has no detected language when the server sent none (Whisper, Romanised)', async () => {
    expect(await transcribeDetailed(cfg, 'AAAA', 'hi', reply({ text: 'hello' }))).toEqual({ text: 'hello', detected: undefined });
  });
});

import { handle, type Env } from './handler';

export default {
  fetch: (req: Request, env: Env): Promise<Response> => handle(req, env, (url, init) => fetch(url, init)),
};

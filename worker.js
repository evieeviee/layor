import { onRequest } from './functions/api/[[path]].js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const rest = url.pathname.replace(/^\/api\/?/, '');

      const path = rest
        ? rest.split('/').filter(Boolean)
        : [];

      return onRequest({
        request,
        env,
        params: {
          path
        },
        waitUntil: ctx.waitUntil.bind(ctx)
      });
    }

    return env.ASSETS.fetch(request);
  }
};

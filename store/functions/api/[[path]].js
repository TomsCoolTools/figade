// Cloudflare Pages Function: every /api/* request goes to the Worker handler.
import { handle } from '../../worker/handler.js';

export const onRequest = (context) => handle(context.request, context.env);

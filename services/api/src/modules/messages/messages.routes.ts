import type { FastifyInstance } from "fastify";
import {
  createDirectConversationRequestSchema,
  directConversationMessagesQuerySchema,
  directUserSearchQuerySchema,
  sendDirectMessageRequestSchema,
} from "./messages.schemas.js";
import {
  createOrGetDirectConversation,
  getDirectConversationMessages,
  listDirectConversations,
  markDirectConversationRead,
  searchDirectUsers,
  sendDirectMessage,
} from "./messages.service.js";
import { requireActiveUser } from "../../common/auth.js";
import { successResponse } from "../../common/http.js";
import { parseWithSchema } from "../../common/validation.js";

export async function registerMessageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/messages/users", async (request) => {
    const actor = await requireActiveUser(request);
    const query = parseWithSchema(directUserSearchQuerySchema, request.query);
    const result = await searchDirectUsers(actor, query);
    return successResponse(result);
  });

  app.get("/messages/conversations", async (request) => {
    const actor = await requireActiveUser(request);
    const conversations = await listDirectConversations(actor);
    return successResponse(conversations);
  });

  app.post("/messages/conversations", async (request, reply) => {
    const actor = await requireActiveUser(request);
    const body = parseWithSchema(createDirectConversationRequestSchema, request.body);
    const result = await createOrGetDirectConversation(actor, body);
    reply.status(201).send(successResponse(result));
  });

  app.get("/messages/conversations/:id/messages", async (request) => {
    const actor = await requireActiveUser(request);
    const query = parseWithSchema(directConversationMessagesQuerySchema, request.query);
    const params = request.params as { id: string };
    const result = await getDirectConversationMessages(actor, params.id, query);
    return successResponse(result);
  });

  app.post("/messages/conversations/:id/messages", async (request, reply) => {
    const actor = await requireActiveUser(request);
    const body = parseWithSchema(sendDirectMessageRequestSchema, request.body);
    const params = request.params as { id: string };
    const result = await sendDirectMessage(actor, params.id, body);
    reply.status(201).send(successResponse(result));
  });

  app.post("/messages/conversations/:id/read", async (request) => {
    const actor = await requireActiveUser(request);
    const params = request.params as { id: string };
    const result = await markDirectConversationRead(actor, params.id);
    return successResponse(result);
  });
}

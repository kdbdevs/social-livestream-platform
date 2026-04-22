import type { FastifyInstance } from "fastify";
import {
  broadcastConfigQuerySchema,
  broadcastPreflightSchema,
  createRoomSchema,
  forceEndRoomSchema,
  liveRoomsQuerySchema,
  roomChatHistoryQuerySchema,
  roomsQuerySchema,
  watchHistoryQuerySchema,
  savedRoomsQuerySchema,
  updateRoomSchema,
} from "./rooms.schemas.js";
import {
  createRoom,
  endRoom,
  forceEndRoom,
  getBroadcastConfig,
  getRoomChatHistory,
  getLiveSummary,
  getRoomById,
  getRoomSaveState,
  getSavedRooms,
  getWatchHistory,
  listLiveRooms,
  listMyRooms,
  preflightBroadcast,
  publishRoom,
  recordRoomView,
  saveRoom,
  removeRoom,
  unsaveRoom,
  updateRoom,
} from "./rooms.service.js";
import { authenticateRequest, requireActiveUser, requireRoles } from "../../common/auth.js";
import { successResponse } from "../../common/http.js";
import { parseWithSchema } from "../../common/validation.js";

export async function registerRoomRoutes(app: FastifyInstance): Promise<void> {
  app.post("/rooms", async (request, reply) => {
    const actor = await requireActiveUser(request);
    const body = parseWithSchema(createRoomSchema, request.body);
    const room = await createRoom(actor, body);
    reply.status(201).send(successResponse({ room }));
  });

  app.get("/rooms/my", async (request) => {
    const actor = await requireActiveUser(request);
    const query = parseWithSchema(roomsQuerySchema, request.query);
    const result = await listMyRooms(actor.userId, query);
    return successResponse({ rooms: result.rooms }, { nextCursor: result.nextCursor });
  });

  app.get("/rooms/live", async (request) => {
    const query = parseWithSchema(liveRoomsQuerySchema, request.query);
    const result = await listLiveRooms(query);
    return successResponse({ rooms: result.rooms }, { nextCursor: result.nextCursor });
  });

  app.get("/rooms/:id", async (request) => {
    let actor: Awaited<ReturnType<typeof authenticateRequest>> | undefined;

    try {
      actor = await authenticateRequest(request);
    } catch {
      actor = undefined;
    }

    const room = await getRoomById((request.params as { id: string }).id, actor);
    return successResponse({ room });
  });

  app.get("/rooms/:id/chat", async (request) => {
    const query = parseWithSchema(roomChatHistoryQuerySchema, request.query);
    const params = request.params as { id: string };
    const messages = await getRoomChatHistory(params.id, query);
    return successResponse({ messages });
  });

  app.post("/rooms/:id/view", async (request) => {
    const actor = await requireActiveUser(request);
    const result = await recordRoomView(actor, (request.params as { id: string }).id);
    return successResponse(result);
  });

  app.get("/rooms/history", async (request) => {
    const actor = await requireActiveUser(request);
    const query = parseWithSchema(watchHistoryQuerySchema, request.query);
    const result = await getWatchHistory(actor, query);
    return successResponse(result);
  });

  app.get("/rooms/:id/save", async (request) => {
    const actor = await requireActiveUser(request);
    const result = await getRoomSaveState(actor, (request.params as { id: string }).id);
    return successResponse(result);
  });

  app.post("/rooms/:id/save", async (request) => {
    const actor = await requireActiveUser(request);
    const result = await saveRoom(actor, (request.params as { id: string }).id);
    return successResponse(result);
  });

  app.delete("/rooms/:id/save", async (request) => {
    const actor = await requireActiveUser(request);
    const result = await unsaveRoom(actor, (request.params as { id: string }).id);
    return successResponse(result);
  });

  app.get("/rooms/saved", async (request) => {
    const actor = await requireActiveUser(request);
    const query = parseWithSchema(savedRoomsQuerySchema, request.query);
    const result = await getSavedRooms(actor, query);
    return successResponse(result);
  });

  app.patch("/rooms/:id", async (request) => {
    const actor = await requireActiveUser(request);
    const body = parseWithSchema(updateRoomSchema, request.body);
    const room = await updateRoom(actor, (request.params as { id: string }).id, body);
    return successResponse({ room });
  });

  app.post("/rooms/:id/publish", async (request) => {
    const actor = await requireActiveUser(request);
    const room = await publishRoom(actor, (request.params as { id: string }).id);
    return successResponse({ roomId: room.id, status: room.status });
  });

  app.post("/rooms/:id/end", async (request) => {
    const actor = await requireActiveUser(request);
    const room = await endRoom(actor, (request.params as { id: string }).id);
    return successResponse({ roomId: room.id, status: room.status });
  });

  app.delete("/rooms/:id", async (request) => {
    const actor = await requireActiveUser(request);
    const result = await removeRoom(actor, (request.params as { id: string }).id);
    return successResponse({
      roomId: result.room.id,
      status: result.room.status,
      outcome: result.outcome,
    });
  });

  app.post("/admin/rooms/:id/force-end", async (request) => {
    const admin = await requireRoles(request, ["ADMIN"]);
    const body = parseWithSchema(forceEndRoomSchema, request.body);
    const room = await forceEndRoom(admin, (request.params as { id: string }).id, body.reason);
    return successResponse({ roomId: room.id, status: room.status });
  });

  app.get("/host/broadcast/config", async (request) => {
    const actor = await requireActiveUser(request);
    const query = parseWithSchema(broadcastConfigQuerySchema, request.query);
    const result = await getBroadcastConfig(actor, query.roomId);
    return successResponse(result);
  });

  app.post("/host/broadcast/preflight", async (request) => {
    const actor = await requireActiveUser(request);
    const body = parseWithSchema(broadcastPreflightSchema, request.body);
    const result = await preflightBroadcast(actor, body);
    return successResponse(result);
  });

  app.get("/hosts/me/live-summary/:roomId", async (request) => {
    const actor = await requireActiveUser(request);
    const params = request.params as { roomId: string };
    const summary = await getLiveSummary(actor, params.roomId);
    return successResponse(summary);
  });
}

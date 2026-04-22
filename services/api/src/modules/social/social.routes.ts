import type { FastifyInstance } from "fastify";
import { requireActiveUser } from "../../common/auth.js";
import { successResponse } from "../../common/http.js";
import { getUserFollowState, followUser, listFollowedUsers, unfollowUser } from "./social.service.js";

function getTargetUserId(params: { userId?: string; hostId?: string }): string {
  return params.userId ?? params.hostId ?? "";
}

export async function registerSocialRoutes(app: FastifyInstance): Promise<void> {
  app.get("/users/me/following", async (request) => {
    const actor = await requireActiveUser(request);
    const users = await listFollowedUsers(actor);
    return successResponse(users);
  });

  app.get("/users/:userId/follow", async (request) => {
    const actor = await requireActiveUser(request);
    const state = await getUserFollowState(actor, getTargetUserId(request.params as { userId: string }));
    return successResponse(state);
  });

  app.post("/users/:userId/follow", async (request) => {
    const actor = await requireActiveUser(request);
    const state = await followUser(actor, getTargetUserId(request.params as { userId: string }));
    return successResponse(state);
  });

  app.delete("/users/:userId/follow", async (request) => {
    const actor = await requireActiveUser(request);
    const state = await unfollowUser(actor, getTargetUserId(request.params as { userId: string }));
    return successResponse(state);
  });

  app.get("/hosts/:hostId/follow", async (request) => {
    const actor = await requireActiveUser(request);
    const state = await getUserFollowState(actor, getTargetUserId(request.params as { hostId: string }));
    return successResponse(state);
  });

  app.post("/hosts/:hostId/follow", async (request) => {
    const actor = await requireActiveUser(request);
    const state = await followUser(actor, getTargetUserId(request.params as { hostId: string }));
    return successResponse(state);
  });

  app.delete("/hosts/:hostId/follow", async (request) => {
    const actor = await requireActiveUser(request);
    const state = await unfollowUser(actor, getTargetUserId(request.params as { hostId: string }));
    return successResponse(state);
  });
}

import type { FastifyInstance } from "fastify";
import {
  changePasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  updateNotificationPreferencesRequestSchema,
  updateProfileRequestSchema,
} from "./auth.schemas.js";
import {
  changePassword,
  getAccountSettings,
  getCurrentUser,
  login,
  logout,
  register,
  updateNotificationPreferences,
  updateProfile,
} from "./auth.service.js";
import { authenticateRequest, requireActiveUser } from "../../common/auth.js";
import { successResponse } from "../../common/http.js";
import { parseWithSchema } from "../../common/validation.js";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", async (request, reply) => {
    const body = parseWithSchema(registerRequestSchema, request.body);
    const result = await register(body);
    reply.status(201).send(successResponse(result));
  });

  app.post("/auth/login", async (request) => {
    const body = parseWithSchema(loginRequestSchema, request.body);
    const result = await login(body);
    return successResponse(result);
  });

  app.post("/auth/logout", async (request) => {
    const actor = await requireActiveUser(request);
    await logout(actor.userId);
    return successResponse({ loggedOut: true });
  });

  app.get("/auth/me", async (request) => {
    const actor = await authenticateRequest(request);
    const user = await getCurrentUser(actor.userId);
    return successResponse({ user });
  });

  app.get("/account/settings", async (request) => {
    const actor = await requireActiveUser(request);
    const settings = await getAccountSettings(actor.userId);
    return successResponse(settings);
  });

  app.patch("/account/profile", async (request) => {
    const actor = await requireActiveUser(request);
    const body = parseWithSchema(updateProfileRequestSchema, request.body);
    const profile = await updateProfile(actor.userId, body);
    return successResponse({ profile });
  });

  app.patch("/account/notifications", async (request) => {
    const actor = await requireActiveUser(request);
    const body = parseWithSchema(updateNotificationPreferencesRequestSchema, request.body);
    const notifications = await updateNotificationPreferences(actor.userId, body);
    return successResponse({ notifications });
  });

  app.post("/account/password", async (request) => {
    const actor = await requireActiveUser(request);
    const body = parseWithSchema(changePasswordRequestSchema, request.body);
    const result = await changePassword(actor.userId, body);
    return successResponse(result);
  });
}

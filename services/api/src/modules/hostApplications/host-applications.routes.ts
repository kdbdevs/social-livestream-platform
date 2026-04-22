import type { FastifyInstance } from "fastify";
import {
  createHostApplicationSchema,
  listHostApplicationsQuerySchema,
  reviewHostApplicationSchema,
} from "./host-applications.schemas.js";
import {
  approveHostApplication,
  getMyHostApplication,
  listHostApplications,
  rejectHostApplication,
  submitHostApplication,
} from "./host-applications.service.js";
import { requireActiveUser, requireRoles } from "../../common/auth.js";
import { successResponse } from "../../common/http.js";
import { parseWithSchema } from "../../common/validation.js";

export async function registerHostApplicationRoutes(app: FastifyInstance): Promise<void> {
  app.post("/host-applications", async (request, reply) => {
    const actor = await requireActiveUser(request);
    const body = parseWithSchema(createHostApplicationSchema, request.body);
    const application = await submitHostApplication(actor, body);
    reply.status(201).send(
      successResponse({
        id: application.id,
        userId: application.userId,
        status: application.status,
        createdAt: application.createdAt,
      }),
    );
  });

  app.get("/host-applications/me", async (request) => {
    const actor = await requireActiveUser(request);
    const application = await getMyHostApplication(actor.userId);
    return successResponse({ application });
  });

  app.get("/admin/host-applications", async (request) => {
    await requireRoles(request, ["ADMIN"]);
    const query = parseWithSchema(listHostApplicationsQuerySchema, request.query);
    const result = await listHostApplications(query);
    return successResponse(
      {
        applications: result.applications,
      },
      { nextCursor: result.nextCursor },
    );
  });

  app.post("/admin/host-applications/:id/approve", async (request) => {
    const admin = await requireRoles(request, ["ADMIN"]);
    const params = request.params as { id: string };
    const body = parseWithSchema(reviewHostApplicationSchema, request.body ?? {});
    const application = await approveHostApplication(admin, params.id, body.notes);
    return successResponse({ application });
  });

  app.post("/admin/host-applications/:id/reject", async (request) => {
    const admin = await requireRoles(request, ["ADMIN"]);
    const params = request.params as { id: string };
    const body = parseWithSchema(reviewHostApplicationSchema, request.body ?? {});
    const application = await rejectHostApplication(admin, params.id, body.notes);
    return successResponse({ application });
  });
}

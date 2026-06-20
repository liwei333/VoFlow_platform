import { LocalModelService, LocalModelServiceType } from "@prisma/client";
import {
  buildLocalModelServiceConfigs,
  LocalModelEnv,
  LocalModelServiceConfig,
  LOCAL_MODEL_SERVICE_DEFINITIONS,
} from "@/lib/local-model/config";
import { checkLocalModelService } from "@/lib/local-model/health";
import { prisma } from "@/lib/db";

interface LocalModelServiceRepository {
  upsertLocalModelService(service: LocalModelServiceConfig): Promise<unknown>;
}

const prismaLocalModelServiceRepository: LocalModelServiceRepository = {
  upsertLocalModelService(service) {
    return prisma.localModelService.upsert({
      where: { serviceType: service.type as LocalModelServiceType },
      update: {
        name: service.name,
        baseUrl: service.baseUrl,
        modelName: service.modelName,
        status: service.status,
        lastError: service.lastError ?? undefined,
      },
      create: {
        serviceType: service.type as LocalModelServiceType,
        name: service.name,
        baseUrl: service.baseUrl,
        modelName: service.modelName,
        status: service.status,
        lastError: service.lastError ?? undefined,
      },
    });
  },
};

export async function syncLocalModelServicesFromEnv(
  env: LocalModelEnv = process.env,
  repository: LocalModelServiceRepository = prismaLocalModelServiceRepository
): Promise<unknown[]> {
  const services = buildLocalModelServiceConfigs(env);
  return Promise.all(services.map((service) => repository.upsertLocalModelService(service)));
}

const LOCAL_MODEL_SERVICE_ORDER = LOCAL_MODEL_SERVICE_DEFINITIONS.map((service) => service.type);

function sortLocalModelServices<T extends { serviceType: LocalModelServiceType }>(services: T[]): T[] {
  return [...services].sort(
    (a, b) =>
      LOCAL_MODEL_SERVICE_ORDER.indexOf(a.serviceType) -
      LOCAL_MODEL_SERVICE_ORDER.indexOf(b.serviceType)
  );
}

function toHealthConfig(service: LocalModelService): LocalModelServiceConfig {
  return {
    type: service.serviceType,
    name: service.name,
    baseUrl: service.baseUrl ?? undefined,
    modelName: service.modelName ?? undefined,
    status: service.status,
    lastError:
      service.lastError && typeof service.lastError === "object"
        ? service.lastError as LocalModelServiceConfig["lastError"]
        : undefined,
  };
}

function buildLastError(result: { errorCode?: string; errorMessage?: string }) {
  if (!result.errorCode && !result.errorMessage) return undefined;
  return {
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  };
}

export async function listLocalModelServices() {
  const services = await prisma.localModelService.findMany();
  return sortLocalModelServices(services);
}

export async function checkAndUpdateLocalModelService(serviceType: LocalModelServiceType) {
  const service = await prisma.localModelService.findUnique({
    where: { serviceType },
  });

  if (!service) return null;

  const result = await checkLocalModelService(toHealthConfig(service));
  return prisma.localModelService.update({
    where: { serviceType },
    data: {
      status: result.status,
      latencyMs: result.latencyMs,
      checkedAt: result.checkedAt,
      lastError: buildLastError(result) ?? undefined,
    },
  });
}

export async function checkAndUpdateAllLocalModelServices() {
  const services = await listLocalModelServices();
  const checked = await Promise.all(
    services.map((service) => checkAndUpdateLocalModelService(service.serviceType))
  );
  return checked.filter((service): service is LocalModelService => service !== null);
}

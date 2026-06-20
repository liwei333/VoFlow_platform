import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildLocalModelServiceConfigs } from "../src/lib/local-model/config";

const prisma = new PrismaClient();

async function main() {
  // Create dev user
  const passwordHash = await bcrypt.hash("dev123456", 10);

  const user = await prisma.user.upsert({
    where: { email: "dev@voflow.local" },
    update: {},
    create: {
      email: "dev@voflow.local",
      passwordHash,
      name: "开发用户",
      status: "active",
    },
  });

  // Create personal team for dev user
  const team = await prisma.team.upsert({
    where: { id: `team-${user.id}` },
    update: {},
    create: {
      id: `team-${user.id}`,
      name: "个人团队",
      ownerId: user.id,
    },
  });

  // Add user as team owner
  await prisma.teamMember.upsert({
    where: {
      teamId_userId: {
        teamId: team.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      teamId: team.id,
      userId: user.id,
      role: "owner",
    },
  });

  // Create disabled user for testing
  const disabledPasswordHash = await bcrypt.hash("disabled123", 10);
  await prisma.user.upsert({
    where: { email: "disabled@voflow.local" },
    update: {},
    create: {
      email: "disabled@voflow.local",
      passwordHash: disabledPasswordHash,
      name: "禁用用户",
      status: "disabled",
    },
  });

  const localModelServices = buildLocalModelServiceConfigs(process.env);
  for (const service of localModelServices) {
    await prisma.localModelService.upsert({
      where: { serviceType: service.type },
      update: {
        name: service.name,
        baseUrl: service.baseUrl,
        modelName: service.modelName,
        status: service.status,
        lastError: service.lastError,
      },
      create: {
        serviceType: service.type,
        name: service.name,
        baseUrl: service.baseUrl,
        modelName: service.modelName,
        status: service.status,
        lastError: service.lastError,
      },
    });
  }

  console.log("Seed completed:");
  console.log("- Dev user: dev@voflow.local / dev123456");
  console.log("- Disabled user: disabled@voflow.local / disabled123");
  console.log("- Local model services:", localModelServices.map((service) => service.type).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { Prisma, PrismaClient } from "@prisma/client";
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
        lastError: toPrismaJson(service.lastError),
      },
      create: {
        serviceType: service.type,
        name: service.name,
        baseUrl: service.baseUrl,
        modelName: service.modelName,
        status: service.status,
        lastError: toPrismaJson(service.lastError),
      },
    });
  }

  const presetVoices = [
    {
      id: "preset-voice-clear-female",
      name: "清亮女声",
      provider: "mock",
      modelId: "preset-clear-female",
      sampleUrl: "/samples/voices/clear-female.mp3",
      gender: "female",
      style: "clear",
      language: "zh-CN",
    },
    {
      id: "preset-voice-warm-male",
      name: "温和男声",
      provider: "mock",
      modelId: "preset-warm-male",
      sampleUrl: "/samples/voices/warm-male.mp3",
      gender: "male",
      style: "warm",
      language: "zh-CN",
    },
    {
      id: "preset-voice-energetic-female",
      name: "活力女声",
      provider: "mock",
      modelId: "preset-energetic-female",
      sampleUrl: "/samples/voices/energetic-female.mp3",
      gender: "female",
      style: "energetic",
      language: "zh-CN",
    },
  ];

  for (const voice of presetVoices) {
    await prisma.voice.upsert({
      where: { id: voice.id },
      update: {
        name: voice.name,
        provider: voice.provider,
        modelId: voice.modelId,
        sampleUrl: voice.sampleUrl,
        gender: voice.gender,
        style: voice.style,
        language: voice.language,
        status: "active",
        licenseStatus: "approved",
      },
      create: {
        ...voice,
        teamId: null,
        ownerId: null,
        voiceType: "preset",
        status: "active",
        licenseStatus: "approved",
      },
    });
  }

  console.log("Seed completed:");
  console.log("- Dev user: dev@voflow.local / dev123456");
  console.log("- Disabled user: disabled@voflow.local / disabled123");
  console.log("- Local model services:", localModelServices.map((service) => service.type).join(", "));
  console.log("- Preset voices:", presetVoices.map((voice) => voice.name).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

function toPrismaJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

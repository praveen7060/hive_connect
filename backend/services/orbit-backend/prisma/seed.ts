import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type JsonRecord = Record<string, unknown>;

async function upsertByName<T extends { id: string }>(
  finder: () => Promise<T | null>,
  create: () => Promise<T>,
  update: (id: string) => Promise<T>
) {
  const existing = await finder();
  if (!existing) {
    return create();
  }
  return update(existing.id);
}

async function main() {
  const tuyaVendor = await upsertByName(
    () => prisma.vendor.findFirst({ where: { name: "Tuya India" } }),
    () =>
      prisma.vendor.create({
        data: {
          name: "Tuya India",
          description: "Tuya cloud API vendor for India region.",
          type: "Third Party",
          industry: "IOT",
          protocol: "API",
          apiVersion: "v1.0",
          baseUrl: "https://openapi.tuyain.com",
          uid: "test_uid_001",
          status: "active",
          notes: "Seeded Tuya API vendor for frontend testing.",
          authType: "OAUTH2",
          clientId: "tuya_client_id",
          clientSecret: "tuya_client_secret",
          authorizationUrl: "https://openapi.tuyain.com",
          tokenUrl: "/v1.0/token?grant_type=1",
        },
      }),
    (id) =>
      prisma.vendor.update({
        where: { id },
        data: {
          description: "Tuya cloud API vendor for India region.",
          type: "Third Party",
          industry: "IOT",
          protocol: "API",
          apiVersion: "v1.0",
          baseUrl: "https://openapi.tuyain.com",
          uid: "test_uid_001",
          status: "active",
          notes: "Seeded Tuya API vendor for frontend testing.",
          authType: "OAUTH2",
          clientId: "tuya_client_id",
          clientSecret: "tuya_client_secret",
          authorizationUrl: "https://openapi.tuyain.com",
          tokenUrl: "/v1.0/token?grant_type=1",
        },
      })
  );

  const elevateVendor = await upsertByName(
    () => prisma.vendor.findFirst({ where: { name: "Elevate Systems" } }),
    () =>
      prisma.vendor.create({
        data: {
          name: "Elevate Systems",
          description: "MQTT-backed vendor profile for internal device testing.",
          type: "Primary",
          industry: "IOT",
          protocol: "MQTT",
          mqttEndpoint: "mqtt.elevate.local",
          status: "active",
          notes: "Seeded MQTT vendor for device control testing.",
          authType: "Credentials",
          tokenType: "Bearer",
          apiToken: "elevate-test-token",
        },
      }),
    (id) =>
      prisma.vendor.update({
        where: { id },
        data: {
          description: "MQTT-backed vendor profile for internal device testing.",
          type: "Primary",
          industry: "IOT",
          protocol: "MQTT",
          mqttEndpoint: "mqtt.elevate.local",
          status: "active",
          notes: "Seeded MQTT vendor for device control testing.",
          authType: "Credentials",
          tokenType: "Bearer",
          apiToken: "elevate-test-token",
        },
      })
  );

  const parameters = [
    { name: "device_id", vendors: tuyaVendor.name, variableType: "STRING", pinType: "path" },
    { name: "uid", vendors: tuyaVendor.name, variableType: "STRING", pinType: "path" },
    { name: "code", vendors: tuyaVendor.name, variableType: "STRING", pinType: "payload" },
    { name: "value", vendors: tuyaVendor.name, variableType: "BOOLEAN", pinType: "payload" },
    { name: "switch_1", vendors: tuyaVendor.name, variableType: "BOOLEAN", pinType: "control" },
    { name: "channel", vendors: elevateVendor.name, variableType: "STRING", pinType: "payload" },
    { name: "switchNo", vendors: elevateVendor.name, variableType: "STRING", pinType: "payload" },
  ];

  for (const parameter of parameters) {
    await upsertByName(
      () => prisma.parameter.findFirst({ where: { name: parameter.name, vendors: parameter.vendors } }),
      () => prisma.parameter.create({ data: parameter }),
      (id) => prisma.parameter.update({ where: { id }, data: parameter })
    );
  }

  const tuyaItemType = await upsertByName(
    () => prisma.itemType.findFirst({ where: { name: "Tuya Switch" } }),
    () =>
      prisma.itemType.create({
        data: {
          name: "Tuya Switch",
          description: "WiFi smart switch family.",
          synonyms: "smart_switch,wifi_switch",
          vendorName: tuyaVendor.name,
        },
      }),
    (id) =>
      prisma.itemType.update({
        where: { id },
        data: {
          description: "WiFi smart switch family.",
          synonyms: "smart_switch,wifi_switch",
          vendorName: tuyaVendor.name,
        },
      })
  );

  const elevateItemType = await upsertByName(
    () => prisma.itemType.findFirst({ where: { name: "Elevate Dongle Controller" } }),
    () =>
      prisma.itemType.create({
        data: {
          name: "Elevate Dongle Controller",
          description: "MQTT dongle switch controller.",
          synonyms: "dongle_controller,switch_controller",
          vendorName: elevateVendor.name,
        },
      }),
    (id) =>
      prisma.itemType.update({
        where: { id },
        data: {
          description: "MQTT dongle switch controller.",
          synonyms: "dongle_controller,switch_controller",
          vendorName: elevateVendor.name,
        },
      })
  );

  const tuyaCommunication = await upsertByName(
    () => prisma.communication.findFirst({ where: { name: "TUYA_REST_API" } }),
    () =>
      prisma.communication.create({
        data: {
          name: "TUYA_REST_API",
          groupName: "Tuya",
          itemType: tuyaItemType.name,
          protocol: "API",
          version: "1.0",
          messageFormat: "JSON",
          communicationMethod: "REST",
          centric: "PAYLOAD",
          messageStructure: JSON.stringify(
            {
              baseUrl: "https://openapi.tuyain.com",
              transport: "https",
              authStrategy: "tuya_hmac",
            },
            null,
            2
          ),
          confirmationMessageStructure: JSON.stringify({ success: true }, null, 2),
          icon: "cloud",
          format: "JSON",
          transport: "HTTPS",
          metadata: JSON.stringify({ vendor: tuyaVendor.name, uid: "test_uid_001" }, null, 2),
        },
      }),
    (id) =>
      prisma.communication.update({
        where: { id },
        data: {
          groupName: "Tuya",
          itemType: tuyaItemType.name,
          protocol: "API",
          version: "1.0",
          messageFormat: "JSON",
          communicationMethod: "REST",
          centric: "PAYLOAD",
          messageStructure: JSON.stringify(
            {
              baseUrl: "https://openapi.tuyain.com",
              transport: "https",
              authStrategy: "tuya_hmac",
            },
            null,
            2
          ),
          confirmationMessageStructure: JSON.stringify({ success: true }, null, 2),
          icon: "cloud",
          format: "JSON",
          transport: "HTTPS",
          metadata: JSON.stringify({ vendor: tuyaVendor.name, uid: "test_uid_001" }, null, 2),
        },
      })
  );

  const elevateCommunication = await upsertByName(
    () => prisma.communication.findFirst({ where: { name: "ELEVATE_MQTT" } }),
    () =>
      prisma.communication.create({
        data: {
          name: "ELEVATE_MQTT",
          groupName: "Elevate",
          itemType: elevateItemType.name,
          protocol: "MQTT",
          version: "1.0",
          messageFormat: "JSON",
          communicationMethod: "PUBLISH",
          centric: "TOPIC",
          messageStructure: JSON.stringify(
            {
              topic: "mqtt/device/{{thingName}}/control",
            },
            null,
            2
          ),
          confirmationMessageStructure: JSON.stringify({ status: "ok" }, null, 2),
          icon: "radio",
          format: "JSON",
          transport: "MQTT",
          metadata: JSON.stringify({ vendor: elevateVendor.name }, null, 2),
        },
      }),
    (id) =>
      prisma.communication.update({
        where: { id },
        data: {
          groupName: "Elevate",
          itemType: elevateItemType.name,
          protocol: "MQTT",
          version: "1.0",
          messageFormat: "JSON",
          communicationMethod: "PUBLISH",
          centric: "TOPIC",
          messageStructure: JSON.stringify(
            {
              topic: "mqtt/device/{{thingName}}/control",
            },
            null,
            2
          ),
          confirmationMessageStructure: JSON.stringify({ status: "ok" }, null, 2),
          icon: "radio",
          format: "JSON",
          transport: "MQTT",
          metadata: JSON.stringify({ vendor: elevateVendor.name }, null, 2),
        },
      })
  );

  const messages: Array<{
    name: string;
    itemType: string;
    communicationPolicy: string;
    topic: string;
    messageType?: string;
    commandType?: string;
    policyType?: string;
    communicationMethod?: string;
    topicUnique?: boolean;
    isPayloadCentric?: boolean;
    requestPayloadFormat?: string;
    responsePayloadFormat?: string;
    payloadFormat?: string;
    confirmationPayloadFormat?: string;
    notes?: string;
  }> = [
    {
      name: "Get Access Token",
      itemType: tuyaItemType.name,
      communicationPolicy: tuyaCommunication.name,
      topic: "/v1.0/token?grant_type=1",
      messageType: "QUERY",
      commandType: "GET",
      policyType: "QUERY",
      communicationMethod: "REST",
      responsePayloadFormat: JSON.stringify({ result: { access_token: "${access_token}" } }, null, 2),
      confirmationPayloadFormat: JSON.stringify({ result: { access_token: "${access_token}" } }, null, 2),
      notes: "Fetch Tuya access token",
    },
    {
      name: "List Devices",
      itemType: tuyaItemType.name,
      communicationPolicy: tuyaCommunication.name,
      topic: "/v1.0/users/{{uid}}/devices",
      messageType: "QUERY",
      commandType: "GET",
      policyType: "QUERY",
      communicationMethod: "REST",
      topicUnique: true,
      notes: "List Tuya devices for UID",
    },
    {
      name: "Get Device Status",
      itemType: tuyaItemType.name,
      communicationPolicy: tuyaCommunication.name,
      topic: "/v1.0/iot-03/devices/{{device_id}}/status",
      messageType: "STATUS",
      commandType: "GET",
      policyType: "QUERY",
      communicationMethod: "REST",
      topicUnique: true,
      notes: "Fetch current Tuya device status",
    },
    {
      name: "Turn On",
      itemType: tuyaItemType.name,
      communicationPolicy: tuyaCommunication.name,
      topic: "/v1.0/iot-03/devices/{{device_id}}/commands",
      messageType: "CONTROL",
      commandType: "POST",
      policyType: "EXECUTE",
      communicationMethod: "REST",
      topicUnique: true,
      isPayloadCentric: true,
      requestPayloadFormat: JSON.stringify(
        {
          commands: [
            {
              code: "switch_1",
              value: true,
            },
          ],
        },
        null,
        2
      ),
      payloadFormat: JSON.stringify(
        {
          commands: [
            {
              code: "switch_1",
              value: true,
            },
          ],
        },
        null,
        2
      ),
      notes: "Turn Tuya switch on",
    },
    {
      name: "Turn Off",
      itemType: tuyaItemType.name,
      communicationPolicy: tuyaCommunication.name,
      topic: "/v1.0/iot-03/devices/{{device_id}}/commands",
      messageType: "CONTROL",
      commandType: "POST",
      policyType: "EXECUTE",
      communicationMethod: "REST",
      topicUnique: true,
      isPayloadCentric: true,
      requestPayloadFormat: JSON.stringify(
        {
          commands: [
            {
              code: "switch_1",
              value: false,
            },
          ],
        },
        null,
        2
      ),
      payloadFormat: JSON.stringify(
        {
          commands: [
            {
              code: "switch_1",
              value: false,
            },
          ],
        },
        null,
        2
      ),
      notes: "Turn Tuya switch off",
    },
    {
      name: "Set Command",
      itemType: tuyaItemType.name,
      communicationPolicy: tuyaCommunication.name,
      topic: "/v1.0/iot-03/devices/{{device_id}}/commands",
      messageType: "CONTROL",
      commandType: "POST",
      policyType: "EXECUTE",
      communicationMethod: "REST",
      topicUnique: true,
      isPayloadCentric: true,
      requestPayloadFormat: JSON.stringify(
        {
          commands: [
            {
              code: "{{params.code}}",
              value: "{{params.value}}",
            },
          ],
        },
        null,
        2
      ),
      payloadFormat: JSON.stringify(
        {
          commands: [
            {
              code: "{{params.code}}",
              value: "{{params.value}}",
            },
          ],
        },
        null,
        2
      ),
      notes: "Parameterized Tuya command",
    },
    {
      name: "MQTT Turn On",
      itemType: elevateItemType.name,
      communicationPolicy: elevateCommunication.name,
      topic: "mqtt/device/{{thingName}}/control",
      messageType: "CONTROL",
      commandType: "PUBLISH",
      policyType: "EXECUTE",
      communicationMethod: "PUBLISH",
      topicUnique: true,
      isPayloadCentric: true,
      requestPayloadFormat: JSON.stringify(
        {
          deviceid: "{{connectAdminDeviceId}}",
          channel: "{{params.channel}}",
          switch_no: "{{params.switchNo}}",
          status: "on",
        },
        null,
        2
      ),
      payloadFormat: JSON.stringify(
        {
          deviceid: "{{connectAdminDeviceId}}",
          channel: "{{params.channel}}",
          switch_no: "{{params.switchNo}}",
          status: "on",
        },
        null,
        2
      ),
      notes: "MQTT on command",
    },
    {
      name: "MQTT Turn Off",
      itemType: elevateItemType.name,
      communicationPolicy: elevateCommunication.name,
      topic: "mqtt/device/{{thingName}}/control",
      messageType: "CONTROL",
      commandType: "PUBLISH",
      policyType: "EXECUTE",
      communicationMethod: "PUBLISH",
      topicUnique: true,
      isPayloadCentric: true,
      requestPayloadFormat: JSON.stringify(
        {
          deviceid: "{{connectAdminDeviceId}}",
          channel: "{{params.channel}}",
          switch_no: "{{params.switchNo}}",
          status: "off",
        },
        null,
        2
      ),
      payloadFormat: JSON.stringify(
        {
          deviceid: "{{connectAdminDeviceId}}",
          channel: "{{params.channel}}",
          switch_no: "{{params.switchNo}}",
          status: "off",
        },
        null,
        2
      ),
      notes: "MQTT off command",
    },
  ];

  for (const message of messages) {
    await upsertByName(
      () =>
        prisma.message.findFirst({
          where: {
            name: message.name,
            itemType: message.itemType,
            communicationPolicy: message.communicationPolicy,
          },
        }),
      () => prisma.message.create({ data: message }),
      (id) => prisma.message.update({ where: { id }, data: message })
    );
  }

  const tuyaItem = await upsertByName(
    () => prisma.item.findFirst({ where: { itemCode: "TUYA_SWITCH_01" } }),
    () =>
      prisma.item.create({
        data: {
          name: "Tuya Smart Switch Item",
          itemCode: "TUYA_SWITCH_01",
          description: "Reusable Tuya switch catalog item.",
          metadata: JSON.stringify({ family: "tuya_switch", region: "india" }, null, 2),
          itemPollingConfig: JSON.stringify({ pollEverySeconds: 60 }, null, 2),
          vendor: tuyaVendor.name,
          itemType: tuyaItemType.name,
          communicationPolicy: tuyaCommunication.name,
          icon: "Switch",
          tags: "tuya,switch,api",
          componentCount: 1,
          secureItem: true,
        },
      }),
    (id) =>
      prisma.item.update({
        where: { id },
        data: {
          description: "Reusable Tuya switch catalog item.",
          metadata: JSON.stringify({ family: "tuya_switch", region: "india" }, null, 2),
          itemPollingConfig: JSON.stringify({ pollEverySeconds: 60 }, null, 2),
          vendor: tuyaVendor.name,
          itemType: tuyaItemType.name,
          communicationPolicy: tuyaCommunication.name,
          icon: "Switch",
          tags: "tuya,switch,api",
          componentCount: 1,
          secureItem: true,
        },
      })
  );

  const elevateItem = await upsertByName(
    () => prisma.item.findFirst({ where: { itemCode: "ELEVATE_SWITCH_01" } }),
    () =>
      prisma.item.create({
        data: {
          name: "Elevate Switch Controller Item",
          itemCode: "ELEVATE_SWITCH_01",
          description: "Reusable MQTT switch controller catalog item.",
          metadata: JSON.stringify({ family: "dongle_controller" }, null, 2),
          itemPollingConfig: JSON.stringify({ pollEverySeconds: 30 }, null, 2),
          vendor: elevateVendor.name,
          itemType: elevateItemType.name,
          communicationPolicy: elevateCommunication.name,
          icon: "Device",
          tags: "mqtt,switch,elevate",
          componentCount: 4,
          secureItem: true,
        },
      }),
    (id) =>
      prisma.item.update({
        where: { id },
        data: {
          description: "Reusable MQTT switch controller catalog item.",
          metadata: JSON.stringify({ family: "dongle_controller" }, null, 2),
          itemPollingConfig: JSON.stringify({ pollEverySeconds: 30 }, null, 2),
          vendor: elevateVendor.name,
          itemType: elevateItemType.name,
          communicationPolicy: elevateCommunication.name,
          icon: "Device",
          tags: "mqtt,switch,elevate",
          componentCount: 4,
          secureItem: true,
        },
      })
  );

  const tuyaDeviceMetadata: JsonRecord = {
    catalog: {
      vendorName: tuyaVendor.name,
      itemType: tuyaItemType.name,
      itemName: tuyaItem.name,
      itemCode: tuyaItem.itemCode,
      communicationPolicy: tuyaCommunication.name,
    },
    runtime: {
      thingId: "tuya-demo-thing-001",
      lastSyncedAt: new Date().toISOString(),
      lastTelemetryAt: new Date().toISOString(),
      lastTelemetry: {
        power: "on",
        switch_1: true,
      },
      lastProtocolState: {
        status: "online",
        receivedAt: new Date().toISOString(),
      },
      healthScore: 96,
    },
  };

  await prisma.device.upsert({
    where: { serialNumber: "TUYA_DEMO_001" },
    update: {
      name: "Tuya Demo Device",
      foreignId: "tuya-demo-device-001",
      connectionType: "API",
      project: "TUYA_LAB",
      status: "active",
      onboardingVersion: 1,
      metadata: JSON.stringify(tuyaDeviceMetadata, null, 2),
    },
    create: {
      name: "Tuya Demo Device",
      foreignId: "tuya-demo-device-001",
      serialNumber: "TUYA_DEMO_001",
      connectionType: "API",
      project: "TUYA_LAB",
      status: "active",
      onboardingVersion: 1,
      metadata: JSON.stringify(tuyaDeviceMetadata, null, 2),
    },
  });

  const elevateDeviceMetadata: JsonRecord = {
    catalog: {
      vendorName: elevateVendor.name,
      itemType: elevateItemType.name,
      itemName: elevateItem.name,
      itemCode: elevateItem.itemCode,
      communicationPolicy: elevateCommunication.name,
    },
    runtime: {
      thingId: "elevate-demo-thing-001",
      lastSyncedAt: new Date().toISOString(),
      lastTelemetryAt: new Date().toISOString(),
      lastTelemetryTopic: "mqtt/device/elevate-demo-thing-001/update",
      lastTelemetry: {
        channel: "1",
        switch_no: "S2",
        status: "on",
      },
      lastProtocolState: {
        status: "online",
        firmwareVersion: "1.0.0",
        receivedAt: new Date().toISOString(),
      },
      healthScore: 98,
    },
  };

  await prisma.device.upsert({
    where: { serialNumber: "ELEVATE_DEMO_001" },
    update: {
      name: "Elevate Demo Device",
      foreignId: "elevate-demo-device-001",
      connectionType: "MQTT",
      project: "ELEVATE_LAB",
      status: "active",
      onboardingVersion: 1,
      metadata: JSON.stringify(elevateDeviceMetadata, null, 2),
    },
    create: {
      name: "Elevate Demo Device",
      foreignId: "elevate-demo-device-001",
      serialNumber: "ELEVATE_DEMO_001",
      connectionType: "MQTT",
      project: "ELEVATE_LAB",
      status: "active",
      onboardingVersion: 1,
      metadata: JSON.stringify(elevateDeviceMetadata, null, 2),
    },
  });

  await prisma.consoleApplication.upsert({
    where: { appKey: "orb_mobile_app_key" },
    update: {
      name: "Orb Mobile",
      domain: "orbiot.mobile",
      applicationCode: "ORB_MOBILE",
      platform: "mobile",
      applicationType: "Mobile",
      bundleVersion: "1.0.0",
      authType: "Token",
      status: "active",
      project: "MOBILE_LAB",
      metadata: JSON.stringify(
        {
          seeded: true,
          linkedInstallations: [],
        },
        null,
        2
      ),
    },
    create: {
      name: "Orb Mobile",
      domain: "orbiot.mobile",
      applicationCode: "ORB_MOBILE",
      platform: "mobile",
      applicationType: "Mobile",
      bundleVersion: "1.0.0",
      authType: "Token",
      appKey: "orb_mobile_app_key",
      status: "active",
      project: "MOBILE_LAB",
      metadata: JSON.stringify(
        {
          seeded: true,
          linkedInstallations: [],
        },
        null,
        2
      ),
    },
  });

  console.log("Orbit seed complete.");
  console.log("Seeded vendors: Tuya India, Elevate Systems");
  console.log("Seeded item types: Tuya Switch, Elevate Dongle Controller");
  console.log("Seeded communication policies: TUYA_REST_API, ELEVATE_MQTT");
  console.log("Seeded devices: TUYA_DEMO_001, ELEVATE_DEMO_001");
  console.log("Seeded app: Orb Mobile (appKey: orb_mobile_app_key)");
}

main()
  .catch((error) => {
    console.error("Orbit seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

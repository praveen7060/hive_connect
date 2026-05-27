import { prisma } from "../../config/prisma";

type ElevateFamilyKey = "IOTIQ4SC" | "IOTIQDC2" | "IOTIQSM" | "IOTIQ_GENERIC";

type ElevateParameterSeed = {
  name: string;
  variableType: string;
  pinType?: string;
  pinCount?: number;
  isConstant?: boolean;
};

type ElevateFamilyTemplate = {
  familyKey: ElevateFamilyKey;
  itemTypeName: string;
  itemTypeDescription: string;
  itemName: string;
  itemCode: string;
  communicationPolicy: string;
  communicationDescription: string;
  communicationVersion: string;
  componentCount: number;
  channels?: string;
  parameters: ElevateParameterSeed[];
  commandMessages: Array<{
    name: string;
    messageType: string;
    commandType: string;
    policyType: string;
    communicationMethod: string;
    topic: string;
    requestPayloadFormat: string;
    responsePayloadFormat?: string;
    topicUnique?: boolean;
    isPayloadCentric?: boolean;
  }>;
  telemetryMessages: Array<{
    name: string;
    messageType: string;
    commandType?: string;
    policyType: string;
    communicationMethod: string;
    topic: string;
    requestPayloadFormat?: string;
    responsePayloadFormat?: string;
    topicUnique?: boolean;
    isPayloadCentric?: boolean;
  }>;
  catalog: Record<string, unknown>;
};

export type ElevateDiscoveryInput = {
  serialNumber: string;
  channels?: string;
  firmwareVersion?: string;
  thingId?: string;
};

const ELEVATE_VENDOR_NAME = "ELEVATE";
const MQTT_TOPIC_TEMPLATE = "$aws/things/+/update";

const ELEVATE_FAMILY_TEMPLATES: Record<ElevateFamilyKey, ElevateFamilyTemplate> = {
  IOTIQ4SC: {
    familyKey: "IOTIQ4SC",
    itemTypeName: "Smart Switch Controller",
    itemTypeDescription: "Multi-channel wall switch controller discovered from ELEVATE telemetry.",
    itemName: "ELEVATE 4 Switch Controller",
    itemCode: "ELEVATE-IOTIQ4SC",
    communicationPolicy: "ELEVATE_MQTT_SWITCH_4CH",
    communicationDescription: "MQTT control and telemetry policy for ELEVATE IOTIQ 4 switch controllers.",
    communicationVersion: "0.02",
    componentCount: 4,
    channels: "4S0F",
    parameters: [
      { name: "switch_no", variableType: "string", pinType: "relay", pinCount: 4 },
      { name: "status", variableType: "string", pinType: "relay", pinCount: 4 },
      { name: "firmware_version", variableType: "string", isConstant: true },
      { name: "climate", variableType: "string" },
      { name: "energy", variableType: "string" },
      { name: "fault", variableType: "string" },
    ],
    commandMessages: [
      {
        name: "Turn On",
        messageType: "UPDATE",
        commandType: "turn_on",
        policyType: "EXECUTE",
        communicationMethod: "PUBLISH",
        topic: "mqtt/device/{{thingName}}/control",
        requestPayloadFormat: JSON.stringify({
          deviceid: "{{connectAdminDeviceId}}",
          switch_no: "{{params.switchNo}}",
          status: "on",
        }, null, 2),
        topicUnique: true,
      },
      {
        name: "Turn Off",
        messageType: "UPDATE",
        commandType: "turn_off",
        policyType: "EXECUTE",
        communicationMethod: "PUBLISH",
        topic: "mqtt/device/{{thingName}}/control",
        requestPayloadFormat: JSON.stringify({
          deviceid: "{{connectAdminDeviceId}}",
          switch_no: "{{params.switchNo}}",
          status: "off",
        }, null, 2),
        topicUnique: true,
      },
      {
        name: "Settings",
        messageType: "CONFIGURATION",
        commandType: "SUBSCRIBE",
        policyType: "EXECUTE",
        communicationMethod: "SUBSCRIBE",
        topic: "mqtt/device/{{thingName}}/setting",
        requestPayloadFormat: JSON.stringify({
          deviceid: "{{connectAdminDeviceId}}",
          switch_no: "{{params.switchNo}}",
          on_time: "{{params.onTime}}",
          off_time: "{{params.offTime}}",
          childlock: "{{params.childlock}}",
        }, null, 2),
        topicUnique: true,
      },
      {
        name: "Alive Request",
        messageType: "AUTHENTICATE",
        commandType: "SUBSCRIBE",
        policyType: "EXECUTE",
        communicationMethod: "SUBSCRIBE",
        topic: "mqtt/device/{{thingName}}/alive",
        requestPayloadFormat: JSON.stringify({
          deviceid: "{{connectAdminDeviceId}}",
        }, null, 2),
        topicUnique: true,
      },
      {
        name: "OTA Initialize",
        messageType: "STATUS",
        commandType: "SUBSCRIBE",
        policyType: "EXECUTE",
        communicationMethod: "SUBSCRIBE",
        topic: "mqtt/device/{{thingName}}/ota/intialize",
        requestPayloadFormat: JSON.stringify({
          deviceid: "{{connectAdminDeviceId}}",
          url: "{{params.url}}",
          ota_version: "{{params.otaVersion}}",
        }, null, 2),
        topicUnique: true,
      },
    ],
    telemetryMessages: [
      {
        name: "Switch Telemetry",
        messageType: "UPDATE",
        policyType: "EXECUTE",
        communicationMethod: "PUBLISH",
        topic: MQTT_TOPIC_TEMPLATE,
        requestPayloadFormat: JSON.stringify({
          expected: ["deviceid", "switch_no", "status", "firmware_version"],
        }, null, 2),
        topicUnique: false,
      },
      {
        name: "Alive Reply",
        messageType: "CONNECTION",
        policyType: "QUERY",
        communicationMethod: "PUBLISH",
        topic: "$aws/things/+/alive_reply",
        requestPayloadFormat: JSON.stringify({
          expected: ["deviceid", "ssid", "ipaddress", "macaddress", "firmware_version"],
        }, null, 2),
      },
      {
        name: "OTA Validate",
        messageType: "STATUS",
        policyType: "EXECUTE",
        communicationMethod: "PUBLISH",
        topic: "$aws/things/+/ota/validate",
        requestPayloadFormat: JSON.stringify({
          expected: ["deviceid", "transactionId", "secrets", "firmware_version", "reply"],
        }, null, 2),
      },
    ],
    catalog: {
      deviceType: "vendor.elevate.switch_4ch",
      transport: "MQTT",
      adapterKey: "mqtt-aws-iot",
      executionMode: "request-response",
      attributes: {
        vendor: ELEVATE_VENDOR_NAME,
        family: "switch_4ch",
      },
      capabilities: [
        "provision_device",
        "turn_on",
        "turn_off",
        "subscribe_topics",
        "fetch_documents"
      ],
      commands: {
        turn_on: {
          subTopic: "control",
          payloadTemplate: {
            deviceid: "{{connectAdminDeviceId}}",
            switch_no: "{{params.switchNo}}",
            status: "on",
          },
        },
        turn_off: {
          subTopic: "control",
          payloadTemplate: {
            deviceid: "{{connectAdminDeviceId}}",
            switch_no: "{{params.switchNo}}",
            status: "off",
          },
        },
      },
    },
  },
  IOTIQDC2: {
    familyKey: "IOTIQDC2",
    itemTypeName: "Dongle Switch Controller",
    itemTypeDescription: "Expandable dongle-based switch controller discovered from ELEVATE telemetry.",
    itemName: "ELEVATE Dongle Controller",
    itemCode: "ELEVATE-IOTIQDC2",
    communicationPolicy: "ELEVATE_MQTT_DONGLE",
    communicationDescription: "MQTT control and telemetry policy for ELEVATE IOTIQ dongle controllers.",
    communicationVersion: "0.02",
    componentCount: 6,
    channels: "6S0F",
    parameters: [
      { name: "channel", variableType: "string", pinType: "channel", pinCount: 1 },
      { name: "switch_no", variableType: "string", pinType: "relay", pinCount: 6 },
      { name: "status", variableType: "string", pinType: "relay", pinCount: 6 },
      { name: "firmware_version", variableType: "string", isConstant: true },
      { name: "channels", variableType: "string", isConstant: true },
      { name: "fault", variableType: "string" },
    ],
    commandMessages: [
      {
        name: "Turn On",
        messageType: "UPDATE",
        commandType: "turn_on",
        policyType: "EXECUTE",
        communicationMethod: "PUBLISH",
        topic: "mqtt/device/{{thingName}}/control",
        requestPayloadFormat: JSON.stringify({
          deviceid: "{{connectAdminDeviceId}}",
          channel: "{{params.channel}}",
          switch_no: "{{params.switchNo}}",
          status: "on",
        }, null, 2),
        topicUnique: true,
      },
      {
        name: "Turn Off",
        messageType: "UPDATE",
        commandType: "turn_off",
        policyType: "EXECUTE",
        communicationMethod: "PUBLISH",
        topic: "mqtt/device/{{thingName}}/control",
        requestPayloadFormat: JSON.stringify({
          deviceid: "{{connectAdminDeviceId}}",
          channel: "{{params.channel}}",
          switch_no: "{{params.switchNo}}",
          status: "off",
        }, null, 2),
        topicUnique: true,
      },
      {
        name: "Settings",
        messageType: "CONFIGURATION",
        commandType: "SUBSCRIBE",
        policyType: "EXECUTE",
        communicationMethod: "SUBSCRIBE",
        topic: "mqtt/device/{{thingName}}/setting",
        requestPayloadFormat: JSON.stringify({
          deviceid: "{{connectAdminDeviceId}}",
          channel: "{{params.channel}}",
          switch_no: "{{params.switchNo}}",
          childlock: "{{params.childlock}}",
        }, null, 2),
        topicUnique: true,
      },
      {
        name: "Reset",
        messageType: "UPDATE",
        commandType: "SUBSCRIBE",
        policyType: "EXECUTE",
        communicationMethod: "SUBSCRIBE",
        topic: "mqtt/device/{{thingName}}/reset",
        requestPayloadFormat: JSON.stringify({
          deviceid: "{{connectAdminDeviceId}}",
          mode: "{{params.mode}}",
          secret: "{{params.secret}}",
        }, null, 2),
        topicUnique: true,
      },
      {
        name: "Alive Request",
        messageType: "AUTHENTICATE",
        commandType: "SUBSCRIBE",
        policyType: "EXECUTE",
        communicationMethod: "SUBSCRIBE",
        topic: "mqtt/device/{{thingName}}/alive",
        requestPayloadFormat: JSON.stringify({
          deviceid: "{{connectAdminDeviceId}}",
        }, null, 2),
        topicUnique: true,
      },
      {
        name: "OTA Initialize",
        messageType: "STATUS",
        commandType: "SUBSCRIBE",
        policyType: "EXECUTE",
        communicationMethod: "SUBSCRIBE",
        topic: "mqtt/device/{{thingName}}/ota/intialize",
        requestPayloadFormat: JSON.stringify({
          deviceid: "{{connectAdminDeviceId}}",
          url: "{{params.url}}",
          ota_version: "{{params.otaVersion}}",
        }, null, 2),
        topicUnique: true,
      },
    ],
    telemetryMessages: [
      {
        name: "Dongle Telemetry",
        messageType: "UPDATE",
        policyType: "EXECUTE",
        communicationMethod: "PUBLISH",
        topic: MQTT_TOPIC_TEMPLATE,
        requestPayloadFormat: JSON.stringify({
          expected: ["deviceid", "channel", "switch_no", "status", "firmware_version"],
        }, null, 2),
      },
      {
        name: "Alive Reply",
        messageType: "CONNECTION",
        policyType: "QUERY",
        communicationMethod: "PUBLISH",
        topic: "$aws/things/+/alive_reply",
        requestPayloadFormat: JSON.stringify({
          expected: ["deviceid", "ssid", "ipaddress", "macaddress", "firmware_version"],
        }, null, 2),
      },
      {
        name: "OTA Validate",
        messageType: "STATUS",
        policyType: "EXECUTE",
        communicationMethod: "PUBLISH",
        topic: "$aws/things/+/ota/validate",
        requestPayloadFormat: JSON.stringify({
          expected: ["deviceid", "transactionId", "secrets", "firmware_version", "reply"],
        }, null, 2),
      },
    ],
    catalog: {
      deviceType: "vendor.elevate.dongle_controller",
      transport: "MQTT",
      adapterKey: "mqtt-aws-iot",
      executionMode: "request-response",
      attributes: {
        vendor: ELEVATE_VENDOR_NAME,
        family: "dongle_controller",
      },
      capabilities: [
        "provision_device",
        "turn_on",
        "turn_off",
        "subscribe_topics",
        "fetch_documents"
      ],
      commands: {
        turn_on: {
          subTopic: "control",
          payloadTemplate: {
            deviceid: "{{connectAdminDeviceId}}",
            channel: "{{params.channel}}",
            switch_no: "{{params.switchNo}}",
            status: "on",
          },
        },
        turn_off: {
          subTopic: "control",
          payloadTemplate: {
            deviceid: "{{connectAdminDeviceId}}",
            channel: "{{params.channel}}",
            switch_no: "{{params.switchNo}}",
            status: "off",
          },
        },
      },
    },
  },
  IOTIQSM: {
    familyKey: "IOTIQSM",
    itemTypeName: "Smart Meter",
    itemTypeDescription: "ELEVATE smart meter discovered from telemetry.",
    itemName: "ELEVATE Smart Meter",
    itemCode: "ELEVATE-IOTIQSM",
    communicationPolicy: "ELEVATE_MQTT_SMART_METER",
    communicationDescription: "MQTT telemetry policy for ELEVATE smart meter devices.",
    communicationVersion: "0.01",
    componentCount: 1,
    parameters: [
      { name: "meter", variableType: "string" },
      { name: "status", variableType: "string" },
      { name: "fault", variableType: "string" },
      { name: "temperature", variableType: "number" },
      { name: "voltage", variableType: "number" },
      { name: "current", variableType: "number" },
      { name: "power", variableType: "number" },
      { name: "energy", variableType: "number" },
      { name: "firmware_version", variableType: "string", isConstant: true },
    ],
    commandMessages: [],
    telemetryMessages: [
      {
        name: "Smart Meter Telemetry",
        messageType: "STATUS",
        policyType: "QUERY",
        communicationMethod: "PUBLISH",
        topic: MQTT_TOPIC_TEMPLATE,
        requestPayloadFormat: JSON.stringify({
          expected: ["deviceid", "meter", "status", "fault"],
        }, null, 2),
      },
    ],
    catalog: {
      deviceType: "vendor.elevate.smart_meter",
      transport: "MQTT",
      adapterKey: "mqtt-aws-iot",
      executionMode: "stream",
      attributes: {
        vendor: ELEVATE_VENDOR_NAME,
        family: "smart_meter",
      },
      capabilities: [
        "provision_device",
        "subscribe_topics",
        "fetch_documents"
      ],
    },
  },
  IOTIQ_GENERIC: {
    familyKey: "IOTIQ_GENERIC",
    itemTypeName: "Generic IoT Device",
    itemTypeDescription: "Fallback ELEVATE device family discovered from telemetry.",
    itemName: "ELEVATE Generic IoT Device",
    itemCode: "ELEVATE-IOTIQ",
    communicationPolicy: "ELEVATE_MQTT_GENERIC",
    communicationDescription: "Fallback MQTT policy for ELEVATE-discovered devices.",
    communicationVersion: "0.01",
    componentCount: 1,
    parameters: [
      { name: "deviceid", variableType: "string", isConstant: true },
      { name: "status", variableType: "string" },
      { name: "firmware_version", variableType: "string", isConstant: true },
    ],
    commandMessages: [],
    telemetryMessages: [
      {
        name: "Generic Telemetry",
        messageType: "STATUS",
        policyType: "QUERY",
        communicationMethod: "PUBLISH",
        topic: MQTT_TOPIC_TEMPLATE,
        requestPayloadFormat: JSON.stringify({
          expected: ["deviceid", "status", "firmware_version"],
        }, null, 2),
      },
    ],
    catalog: {
      deviceType: "vendor.elevate.generic",
      transport: "MQTT",
      adapterKey: "mqtt-aws-iot",
      executionMode: "stream",
      attributes: {
        vendor: ELEVATE_VENDOR_NAME,
        family: "generic",
      },
      capabilities: [
        "provision_device",
        "subscribe_topics",
        "fetch_documents"
      ],
    },
  },
};

function getElevateFamilyKey(serialNumber: string): ElevateFamilyKey {
  const normalized = serialNumber.trim().toUpperCase();
  if (normalized.startsWith("IOTIQ4SC_")) return "IOTIQ4SC";
  if (normalized.startsWith("IOTIQDC2_")) return "IOTIQDC2";
  if (normalized.startsWith("IOTIQSM_")) return "IOTIQSM";
  return "IOTIQ_GENERIC";
}

export function resolveElevateTemplate(input: ElevateDiscoveryInput) {
  const familyKey = getElevateFamilyKey(input.serialNumber);
  const base = ELEVATE_FAMILY_TEMPLATES[familyKey];
  const channels = input.channels?.trim() || base.channels;

  return {
    ...base,
    channels,
    catalog: {
      ...base.catalog,
      channels,
    },
  };
}

async function ensureVendor() {
  const existing = await prisma.vendor.findFirst({
    where: { name: ELEVATE_VENDOR_NAME },
  });

  if (existing) return existing;

  return prisma.vendor.create({
    data: {
      name: ELEVATE_VENDOR_NAME,
      description: "Auto-seeded vendor profile for ELEVATE IOTIQ devices discovered from MQTT.",
      type: "device_vendor",
      industry: "iot",
      authType: "certificate",
    },
  });
}

async function ensureItemType(template: ElevateFamilyTemplate) {
  const existing = await prisma.itemType.findFirst({
    where: { name: template.itemTypeName },
  });

  if (existing) return existing;

  return prisma.itemType.create({
    data: {
      name: template.itemTypeName,
      description: template.itemTypeDescription,
      vendorName: ELEVATE_VENDOR_NAME,
      synonyms: `${template.familyKey},${template.itemCode}`,
    },
  });
}

async function ensureCommunication(template: ElevateFamilyTemplate) {
  const existing = await prisma.communication.findFirst({
    where: { name: template.communicationPolicy },
  });

  if (existing) return existing;

  return prisma.communication.create({
    data: {
      name: template.communicationPolicy,
      groupName: ELEVATE_VENDOR_NAME,
      itemType: template.itemTypeName,
      protocol: "MQTT",
      version: template.communicationVersion,
      messageFormat: "JSON",
      communicationMethod: "MQTT",
      centric: "TOPIC",
      icon: "radio",
      needFirmware: true,
      needConfirmation: false,
      format: "JSON",
      transport: "MQTT",
      messageStructure: JSON.stringify({
        catalog: template.catalog,
      }),
      confirmationMessageStructure: JSON.stringify({}),
      metadata: JSON.stringify({
        firmwareControlled: true,
        description: template.communicationDescription,
      }),
      image: undefined,
    },
  });
}

async function ensureParameters(template: ElevateFamilyTemplate) {
  for (const parameter of template.parameters) {
    const existing = await prisma.parameter.findFirst({
      where: {
        name: parameter.name,
        vendors: ELEVATE_VENDOR_NAME,
      },
    });

    if (existing) continue;

    await prisma.parameter.create({
      data: {
        name: parameter.name,
        vendors: ELEVATE_VENDOR_NAME,
        variableType: parameter.variableType,
        pinType: parameter.pinType,
        pinCount: parameter.pinCount ?? 0,
        isConstant: parameter.isConstant ?? false,
      },
    });
  }
}

async function ensureItem(template: ElevateFamilyTemplate) {
  const existing = await prisma.item.findFirst({
    where: { itemCode: template.itemCode },
  });

  const metadata = JSON.stringify(
    {
      catalog: {
        vendorName: ELEVATE_VENDOR_NAME,
        itemType: template.itemTypeName,
        itemName: template.itemName,
        itemCode: template.itemCode,
        communicationPolicy: template.communicationPolicy,
        ...template.catalog,
      },
    },
    null,
    2
  );

  if (existing) {
    return prisma.item.update({
      where: { id: existing.id },
      data: {
        name: template.itemName,
        vendor: ELEVATE_VENDOR_NAME,
        itemType: template.itemTypeName,
        communicationPolicy: template.communicationPolicy,
        componentCount: template.componentCount,
        metadata,
      },
    });
  }

  return prisma.item.create({
    data: {
      name: template.itemName,
      itemCode: template.itemCode,
      description: `${template.itemName} auto-seeded from device discovery.`,
      vendor: ELEVATE_VENDOR_NAME,
      itemType: template.itemTypeName,
      communicationPolicy: template.communicationPolicy,
      componentCount: template.componentCount,
      secureItem: true,
      metadata,
    },
  });
}

async function ensureMessages(template: ElevateFamilyTemplate) {
  const definitions = [
    ...template.commandMessages.map((message) => ({
      ...message,
      loggedMessage: false,
      qos: 1,
    })),
    ...template.telemetryMessages.map((message) => ({
      ...message,
      loggedMessage: true,
      qos: 1,
    })),
  ];

  for (const definition of definitions) {
    const existing = await prisma.message.findFirst({
      where: {
        itemType: template.itemTypeName,
        communicationPolicy: template.communicationPolicy,
        topic: definition.topic,
        ...(definition.commandType ? { commandType: definition.commandType } : {}),
        ...(definition.messageType ? { messageType: definition.messageType } : {}),
      },
    });

    if (existing) continue;

    await prisma.message.create({
      data: {
        name: definition.name,
        itemType: template.itemTypeName,
        communicationPolicy: template.communicationPolicy,
        topic: definition.topic,
        messageType: definition.messageType,
        commandType: definition.commandType,
        policyType: definition.policyType,
        communicationMethod: definition.communicationMethod,
        topicUnique: definition.topicUnique ?? false,
        isPayloadCentric: definition.isPayloadCentric ?? false,
        retainMessages: false,
        loggedMessage: definition.loggedMessage,
        qos: definition.qos,
        requestPayloadFormat: definition.requestPayloadFormat,
        responsePayloadFormat: definition.responsePayloadFormat,
        payloadFormat: definition.requestPayloadFormat,
      },
    });
  }
}

export async function ensureElevateCatalog(input: ElevateDiscoveryInput) {
  const template = resolveElevateTemplate(input);

  await ensureVendor();
  await ensureItemType(template);
  await ensureCommunication(template);
  await ensureParameters(template);
  const item = await ensureItem(template);
  await ensureMessages(template);

  return {
    template,
    vendorName: ELEVATE_VENDOR_NAME,
    item,
  };
}

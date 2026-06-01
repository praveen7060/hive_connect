import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../../middleware/error.middleware";
import {
  buildEnrollmentQrMetadata,
  prepareEnrollmentQrMetadata,
} from "./enrollmentQrMetadata.service";
import type { CatalogProfile } from "../iot-orchestration/catalog-resolver";

function makeProfile(overrides: Partial<CatalogProfile> & Record<string, unknown> = {} as Partial<CatalogProfile>): CatalogProfile {
  const base = {
    device: {
      id: "device-1",
      name: "Elevate Device",
      serialNumber: "ELEVATE_001",
      connectionType: "MQTT",
      project: "LAB",
      status: "active",
      metadata: JSON.stringify({
        catalog: {
          itemType: "Dongle Switch Controller",
          communicationPolicy: "ELEVATE_MQTT_DONGLE",
        },
      }),
      foreignId: "thing-1",
    },
    vendor: null,
    item: {
      id: "item-1",
      name: "Elevate Item",
      itemCode: "ELEVATE-IOTIQDC2",
      itemType: "Dongle Switch Controller",
      metadata: JSON.stringify({ family: "dongle_controller" }),
      componentCount: 2,
    },
    communication: {
      id: "comm-1",
      name: "ELEVATE_MQTT_DONGLE",
    },
    messages: [],
    commands: [
      {
        key: "turn_on",
        message: {
          id: "msg-on",
          name: "Turn On",
          commandType: "turn_on",
          policyType: "EXECUTE",
          messageType: "UPDATE",
          communicationMethod: "PUBLISH",
        },
        topicTemplate: "mqtt/device/{{thingName}}/control",
        subTopic: "control",
        payloadTemplate: {
          deviceid: "{{connectAdminDeviceId}}",
          channel: "{{params.channel}}",
          switch_no: "{{params.switchNo}}",
          status: "on",
        },
        confirmationPayloadTemplate: {},
        metadata: {},
      },
      {
        key: "turn_off",
        message: {
          id: "msg-off",
          name: "Turn Off",
          commandType: "turn_off",
          policyType: "EXECUTE",
          messageType: "UPDATE",
          communicationMethod: "PUBLISH",
        },
        topicTemplate: "mqtt/device/{{thingName}}/control",
        subTopic: "control",
        payloadTemplate: {
          deviceid: "{{connectAdminDeviceId}}",
          channel: "{{params.channel}}",
          switch_no: "{{params.switchNo}}",
          status: "off",
        },
        confirmationPayloadTemplate: {},
        metadata: {},
      },
    ],
    rawMetadata: {},
    catalogMetadata: {
      itemType: "Dongle Switch Controller",
      communicationPolicy: "ELEVATE_MQTT_DONGLE",
    },
    iotMetadata: {},
    thingId: "thing-1",
    thingName: "thing-1",
    connectAdminDeviceId: "ELEVATE_001",
    provisioning: {
      deviceId: "ELEVATE_001",
      deviceType: "vendor.elevate.dongle_controller",
      thingName: "thing-1",
      attributes: {},
      channels: "2S0F",
    },
    protocol: {
      transport: "MQTT",
      adapterKey: "mqtt-aws-iot",
      direction: "bidirectional",
      executionMode: "request-response",
      inboundTopics: [],
      metadata: {},
    },
  } as unknown as CatalogProfile;

  return {
    ...base,
    ...overrides,
    device: { ...base.device, ...(overrides.device ?? {}) },
    item: overrides.item === null ? null : { ...base.item, ...(overrides.item ?? {}) },
    communication: overrides.communication === null ? null : { ...base.communication, ...(overrides.communication ?? {}) },
    provisioning: { ...base.provisioning, ...(overrides.provisioning ?? {}) },
    protocol: { ...base.protocol, ...(overrides.protocol ?? {}) },
    catalogMetadata: { ...base.catalogMetadata, ...(overrides.catalogMetadata ?? {}) },
  } as CatalogProfile;
}

test("buildEnrollmentQrMetadata resolves valid item type components and actions", () => {
  const profile = makeProfile();
  const metadata = buildEnrollmentQrMetadata({
    profile,
    parameterMappings: [
      { name: "channel", pinType: "channel", pinCount: 1 },
      { name: "switch_no", pinType: "relay", pinCount: 2 },
    ],
    certificateReferences: [{ source: "asset", certificateId: "cert-1", thingId: "thing-1" }],
    qrVersion: 1,
    generatedAt: "2026-05-29T00:00:00.000Z",
    claimStatus: "pending",
    s3QrPath: "s3://bucket/path.svg",
  });

  assert.equal(metadata.itemType, "Dongle Switch Controller");
  assert.equal(metadata.components.length, 2);
  assert.equal(metadata.components[0].actions.length, 2);
  assert.equal(metadata.components[0].actions[0].mqttTopic, "mqtt/device/thing-1/control");
});

test("buildEnrollmentQrMetadata supports multiple component types from explicit metadata", () => {
  const profile = makeProfile({
    item: {
      ...makeProfile().item!,
      metadata: JSON.stringify({
        components: [
          { componentType: "relay", count: 2, name: "Relay" },
          { componentType: "meter", count: 1, name: "Meter", params: { meter: "M1" } },
        ],
      }),
    },
  });

  const metadata = buildEnrollmentQrMetadata({
    profile,
    parameterMappings: [{ name: "switch_no", pinType: "relay", pinCount: 2 }],
    certificateReferences: [],
    qrVersion: 1,
    generatedAt: "2026-05-29T00:00:00.000Z",
    claimStatus: "pending",
    s3QrPath: null,
  });

  assert.equal(metadata.components.length, 3);
  assert.equal(metadata.components[2].componentType, "meter");
});

test("buildEnrollmentQrMetadata removes duplicate actions per component", () => {
  const profile = makeProfile({
    commands: [
      ...makeProfile().commands,
      {
        ...makeProfile().commands[0],
        message: {
          ...makeProfile().commands[0].message,
        },
      },
    ],
  });

  const metadata = buildEnrollmentQrMetadata({
    profile,
    parameterMappings: [{ name: "switch_no", pinType: "relay", pinCount: 2 }],
    certificateReferences: [],
    qrVersion: 1,
    generatedAt: "2026-05-29T00:00:00.000Z",
    claimStatus: "pending",
    s3QrPath: null,
  });

  assert.equal(metadata.components[0].actions.length, 2);
});

test("buildEnrollmentQrMetadata allows empty action list when no policy mapping exists", () => {
  const profile = makeProfile({ commands: [] });
  const metadata = buildEnrollmentQrMetadata({
    profile,
    parameterMappings: [{ name: "switch_no", pinType: "relay", pinCount: 2 }],
    certificateReferences: [],
    qrVersion: 1,
    generatedAt: "2026-05-29T00:00:00.000Z",
    claimStatus: "pending",
    s3QrPath: null,
  });

  assert.equal(metadata.configuredActions.total, 0);
  assert.equal(metadata.components[0].actions.length, 0);
});

test("buildEnrollmentQrMetadata fails when component type mapping is missing", () => {
  const profile = makeProfile({
    item: {
      ...makeProfile().item!,
      componentCount: 1,
      metadata: JSON.stringify({}),
    },
    commands: [
      {
        ...makeProfile().commands[0],
        payloadTemplate: {
          deviceid: "{{connectAdminDeviceId}}",
        },
      },
    ],
  });

  assert.throws(
    () =>
      buildEnrollmentQrMetadata({
        profile,
        parameterMappings: [],
        certificateReferences: [],
        qrVersion: 1,
        generatedAt: "2026-05-29T00:00:00.000Z",
        claimStatus: "pending",
        s3QrPath: null,
      }),
    (error: unknown) =>
      error instanceof ApiError &&
      error.message.includes("Component type mapping is missing")
  );
});

test("prepareEnrollmentQrMetadata orchestrates the full QR metadata flow", async () => {
  const profile = makeProfile();
  const events: string[] = [];

  const metadata = await prepareEnrollmentQrMetadata(
    "device-1",
    {
      qrVersion: 2,
      generatedAt: "2026-05-29T00:00:00.000Z",
      claimStatus: "pending",
      s3QrPath: "s3://bucket/qr.svg",
    },
    {
      loadCatalogProfile: async () => profile,
      loadParameterPinMappings: async () => [{ name: "switch_no", pinType: "relay", pinCount: 2 }],
      loadCertificateReferences: async () => [{ source: "asset", certificateId: "cert-2", thingId: "thing-1" }],
      logger: (event) => events.push(event),
    }
  );

  assert.equal(metadata.qrVersion, 2);
  assert.equal(metadata.s3QrPath, "s3://bucket/qr.svg");
  assert.ok(events.includes("qr_metadata_resolution_started"));
  assert.ok(events.includes("qr_metadata_resolution_succeeded"));
});

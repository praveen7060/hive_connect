import { ApiError } from "../../middleware/error.middleware";
import { httpVendorAdapter } from "./adapters/httpVendor.adapter";
import { mqttAwsIotAdapter } from "./adapters/mqttAwsIot.adapter";
import type { ProtocolAdapter, RuntimeExecutionContext } from "./types";

const adapters: ProtocolAdapter[] = [
  mqttAwsIotAdapter,
  httpVendorAdapter,
];

function normalize(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export const adapterRegistry = {
  list() {
    return adapters;
  },

  resolve(context: RuntimeExecutionContext): ProtocolAdapter {
    const preferred = normalize(context.adapterKey);
    const transport = normalize(context.transport);

    const exact = adapters.find((adapter) => normalize(adapter.key) === preferred);
    if (exact) return exact;

    const byTransport = adapters.find((adapter) =>
      adapter.transports.map(normalize).includes(transport)
    );
    if (byTransport) return byTransport;

    throw new ApiError(
      400,
      `No protocol adapter is registered for adapterKey='${context.adapterKey}' transport='${context.transport}'`
    );
  },
};

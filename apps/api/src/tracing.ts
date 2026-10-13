/**
 * OpenTelemetry SDK Init (S2.1 / S2.2)
 * Initializes tracing with OTLP exporter for Jaeger/Tempo.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export function initTracing(serviceName: string, endpoint?: string): void {
  const exporter = new OTLPTraceExporter({
    url: endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4317/v1/traces',
  });

  const sdk = new NodeSDK({
    traceExporter: exporter,
    serviceName,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  console.log(`[OTel] Tracing initialized for ${serviceName} → ${exporter.url || endpoint || 'default'}`);

  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('[OTel] Tracing SDK shut down gracefully'))
      .catch((err: unknown) => console.error('[OTel] Shutdown error:', err))
      .finally(() => process.exit(0));
  });
}

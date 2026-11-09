import { loadAgentDelivery } from './agent-capability.mjs';

export const { acceptSource, approveArchitectureChanges, callCopilot, produceRevision, readAgentEvents,
  verifyAgentAudit } = await loadAgentDelivery('agent-production.mjs');

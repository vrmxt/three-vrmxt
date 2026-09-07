export const STENCIL_REF_BAND_START = 32;
export const STENCIL_REF_MAX = 255;

const SKIP = [0, 1, 51, 255];

type Lease = { start: number; span: number };

const leases = new Map<number, Lease>();

export function acquireStencilRefBand(instanceId: number, span: number): number {
  if (span < 1) {
    releaseStencilRefBand(instanceId);
    return 0;
  }

  releaseStencilRefBand(instanceId);

  for (let start = STENCIL_REF_BAND_START; start <= STENCIL_REF_MAX - span + 1; start++) {
    if (!rangeOk(start, span)) {
      continue;
    }
    leases.set(instanceId, { start, span });
    return start;
  }

  return 0;
}

export function releaseStencilRefBand(instanceId: number): void {
  leases.delete(instanceId);
}

export function resetStencilRefBands(): void {
  leases.clear();
}

export function gpuStencilRef(localRef: number, gpuBase: number): number {
  if (gpuBase < STENCIL_REF_BAND_START || localRef < 1) {
    return 0;
  }
  const next = localRef + gpuBase - 1;
  if (next > STENCIL_REF_MAX || SKIP.includes(next)) {
    return 0;
  }
  return next;
}

function rangeOk(start: number, span: number): boolean {
  const end = start + span - 1;
  if (end > STENCIL_REF_MAX) {
    return false;
  }

  for (let r = start; r <= end; r++) {
    if (SKIP.includes(r)) {
      return false;
    }
  }

  for (const lease of leases.values()) {
    const leaseEnd = lease.start + lease.span - 1;
    if (start <= leaseEnd && lease.start <= end) {
      return false;
    }
  }

  return true;
}

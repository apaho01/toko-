/**
 * UltraPC Component Compatibility Engine
 * Validates hardware rules for PC configurator builds
 */

function validateCompatibility(parts) {
  // parts is an object with keys: cpu, motherboard, ram, gpu, cooling, psu, case, storage
  const warnings = [];
  const errors = [];
  let totalTdp = 100; // base system (fans, chipset, storage, lighting)

  const cpu = parts.cpu;
  const mb = parts.motherboard;
  const ram = parts.ram;
  const gpu = parts.gpu;
  const cooler = parts.cooling;
  const psu = parts.psu;
  const chass = parts.case;

  // 1. CPU & Motherboard Socket Compatibility
  if (cpu && mb) {
    const cpuSpecs = typeof cpu.specs_json === 'string' ? JSON.parse(cpu.specs_json) : cpu.specs_json;
    const mbSpecs = typeof mb.specs_json === 'string' ? JSON.parse(mb.specs_json) : mb.specs_json;

    if (cpuSpecs.socket && mbSpecs.socket && cpuSpecs.socket !== mbSpecs.socket) {
      errors.push(`Socket Mismatch: Selected CPU (${cpu.name}) uses socket ${cpuSpecs.socket}, but motherboard (${mb.name}) has socket ${mbSpecs.socket}.`);
    }
  }

  // 2. RAM & Motherboard Compatibility
  if (ram && mb) {
    const ramSpecs = typeof ram.specs_json === 'string' ? JSON.parse(ram.specs_json) : ram.specs_json;
    const mbSpecs = typeof mb.specs_json === 'string' ? JSON.parse(mb.specs_json) : mb.specs_json;

    if (ramSpecs.generation && mbSpecs.ram_gen && ramSpecs.generation !== mbSpecs.ram_gen) {
      errors.push(`Memory Standard Conflict: Motherboard requires ${mbSpecs.ram_gen}, but chosen RAM is ${ramSpecs.generation}.`);
    }
  }

  // 3. CPU Cooler Socket Compatibility
  if (cooler && cpu) {
    const coolerSpecs = typeof cooler.specs_json === 'string' ? JSON.parse(cooler.specs_json) : cooler.specs_json;
    const cpuSpecs = typeof cpu.specs_json === 'string' ? JSON.parse(cpu.specs_json) : cpu.specs_json;

    if (coolerSpecs.socket && cpuSpecs.socket) {
      const supportedSockets = coolerSpecs.socket.split(',').map(s => s.trim());
      if (!supportedSockets.includes(cpuSpecs.socket)) {
        errors.push(`Cooler Mounting Incompatibility: The ${cooler.name} does not natively support CPU socket ${cpuSpecs.socket}.`);
      }
    }
  }

  // 4. Power Supply (PSU) Capacity Check
  if (cpu) {
    const cpuSpecs = typeof cpu.specs_json === 'string' ? JSON.parse(cpu.specs_json) : cpu.specs_json;
    totalTdp += (cpuSpecs.tdp || 150);
  }
  if (gpu) {
    const gpuSpecs = typeof gpu.specs_json === 'string' ? JSON.parse(gpu.specs_json) : gpu.specs_json;
    totalTdp += (gpuSpecs.tdp || 300);
  }

  if (psu) {
    const psuSpecs = typeof psu.specs_json === 'string' ? JSON.parse(psu.specs_json) : psu.specs_json;
    const ratedWattage = psuSpecs.wattage || 850;
    const recommendedWattage = Math.round(totalTdp * 1.35); // 35% safety headroom for transient spikes

    if (ratedWattage < totalTdp) {
      errors.push(`Insufficient Power: Estimated system load under transient peak is ${totalTdp}W, which exceeds the PSU rated output (${ratedWattage}W).`);
    } else if (ratedWattage < recommendedWattage) {
      warnings.push(`Tight Power Headroom: System peak power is estimated at ${totalTdp}W. Recommended capacity is at least ${recommendedWattage}W to handle transient graphics spikes comfortably.`);
    }
  }

  // 5. GPU Clearance in Case
  if (gpu && chass) {
    const gpuSpecs = typeof gpu.specs_json === 'string' ? JSON.parse(gpu.specs_json) : gpu.specs_json;
    const caseSpecs = typeof chass.specs_json === 'string' ? JSON.parse(chass.specs_json) : chass.specs_json;

    if (gpuSpecs.length_mm && caseSpecs.gpu_max_length_mm) {
      if (gpuSpecs.length_mm > caseSpecs.gpu_max_length_mm) {
        errors.push(`Chassis Clearance Error: Selected GPU length (${gpuSpecs.length_mm}mm) exceeds the maximum chassis clearance (${caseSpecs.gpu_max_length_mm}mm).`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    estimatedTdpWatts: totalTdp,
    recommendedPsuWatts: Math.round(totalTdp * 1.35)
  };
}

module.exports = {
  validateCompatibility
};

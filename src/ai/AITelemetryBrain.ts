import * as THREE from 'three';

export interface TelemetryEntry {
  timestamp: number;
  position: [number, number, number];
  velocity: [number, number, number];
  hp: number;
  status: 'alive' | 'dead';
}

export class AITelemetryBrain {
  private static instance: AITelemetryBrain;
  
  public dangerZones: THREE.Vector3[] = [];
  public traversalNodes: THREE.Vector3[] = [];
  public jumpNodes: THREE.Vector3[] = [];
  
  // Dynamic memory (hive mind map of recent heavy damage locations)
  public dynamicDangerZones: { position: THREE.Vector3, timestamp: number }[] = [];
  
  private isLoaded = false;

  private constructor() {}

  public static getInstance(): AITelemetryBrain {
    if (!AITelemetryBrain.instance) {
      AITelemetryBrain.instance = new AITelemetryBrain();
    }
    return AITelemetryBrain.instance;
  }

  public async loadTelemetry() {
    if (this.isLoaded) return;
    try {
      const response = await fetch('/hook-champions/ai-telemetry.json');
      if (!response.ok) return;
      
      const data: TelemetryEntry[] = await response.json();
      
      this.processData(data);
      this.isLoaded = true;
    } catch (err) {
      console.warn("No telemetry data found. AI will use default behavior.");
    }
  }

  private processData(data: TelemetryEntry[]) {
    // We only need a subset to optimize 
    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      const pos = new THREE.Vector3(entry.position[0], entry.position[1], entry.position[2]);
      
      // If player died or had very low HP, it's a danger zone
      if (entry.status === 'dead' || entry.hp <= 10) {
        this.dangerZones.push(pos);
      } else {
        // Track as safe traversal if survived
        if (i % 5 === 0) { // sparse sampling to avoid massive arrays
          this.traversalNodes.push(pos);
        }
      }

      // If Y velocity was high, a jump occurred here
      if (entry.velocity && entry.velocity[1] > 4) {
        this.jumpNodes.push(pos);
      }
    }
  }

  // Returns a steering impulse vector to avoid danger
  public getSafetySteering(currentPos: THREE.Vector3): THREE.Vector3 {
    const steering = new THREE.Vector3(0, 0, 0);
    if (!this.isLoaded || (this.dangerZones.length === 0 && this.dynamicDangerZones.length === 0)) return steering;

    const now = performance.now() / 1000;
    
    // Clean up old dynamic danger zones (decay over 15 seconds)
    this.dynamicDangerZones = this.dynamicDangerZones.filter(d => now - d.timestamp < 15);

    // Static danger zones
    for (const danger of this.dangerZones) {
      const dist = currentPos.distanceTo(danger);
      if (dist < 15) {
        const repulsion = currentPos.clone().sub(danger).normalize();
        repulsion.multiplyScalar(15 - dist);
        repulsion.y = 0;
        steering.add(repulsion);
      }
    }
    
    // Dynamic danger zones (higher repulsive force because they are fresh active threats)
    for (const danger of this.dynamicDangerZones) {
      const dist = currentPos.distanceTo(danger.position);
      if (dist < 20) { // Slightly larger radius for active combat areas
        const age = now - danger.timestamp;
        const decayFactor = Math.max(0, 1.0 - (age / 15.0)); // Fades out over 15s
        const repulsion = currentPos.clone().sub(danger.position).normalize();
        repulsion.multiplyScalar((20 - dist) * 1.5 * decayFactor); // Stronger multiplier
        repulsion.y = 0;
        steering.add(repulsion);
      }
    }
    
    return steering.clampLength(0, 25); // Cap the repulsion
  }

  // Report a fresh danger zone (used when taking massive damage or dying)
  public reportDanger(position: THREE.Vector3) {
    this.dynamicDangerZones.push({ position: position.clone(), timestamp: performance.now() / 1000 });
  }

  // Returns a soft steering impulse vector to attract towards safe recorded paths
  public getAttractionSteering(currentPos: THREE.Vector3): THREE.Vector3 {
    const steering = new THREE.Vector3(0, 0, 0);
    if (!this.isLoaded || this.traversalNodes.length === 0) return steering;

    let closestNode: THREE.Vector3 | null = null;
    let closestDist = Infinity;

    // Find the closest traversal node
    for (const node of this.traversalNodes) {
      const dist = currentPos.distanceToSquared(node);
      // We don't want to just be glued to the absolute closest if we are already there
      // We want to pull towards paths that are nearby but not directly under our feet
      if (dist < closestDist && dist > 4) { 
        closestDist = dist;
        closestNode = node;
      }
    }

    if (closestNode && closestDist < 400) { // Within 20 meters
      const attraction = closestNode.clone().sub(currentPos).normalize();
      // Soft attraction, leaving room for Wander and game physics (avoiding walls)
      // The further we are, the more we want to go there
      attraction.multiplyScalar(Math.min(10, Math.sqrt(closestDist) * 0.5));
      // We don't apply Y attraction directly so we remain bounded to gravity/physics
      attraction.y = 0; 
      steering.add(attraction);
    }
    
    return steering.clampLength(0, 5); // Keep the attraction subtle so physics/wander still drive
  }

  // Returns whether the bot should jump based on telemetry
  public shouldJumpNow(currentPos: THREE.Vector3): boolean {
    if (!this.isLoaded || this.jumpNodes.length === 0) return false;

    // If within 3 meters of a recorded jump node, execute jump
    for (const jump of this.jumpNodes) {
      if (currentPos.distanceTo(jump) < 3) {
        return true;
      }
    }
    return false;
  }
}

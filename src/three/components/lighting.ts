import * as THREE from 'three';

/** Identical game lighting in all three consumers; studio reflections are optional. */
export function createGameLighting(scene: THREE.Scene): { setIntensity(value: number): void; dispose(): void } {
  const hemisphere = new THREE.HemisphereLight(0x8bdcff, 0x05070b, 1.5);
  const cyan = new THREE.PointLight(0x35e7ff, 70, 45, 2); cyan.position.set(-6, 10, 5);
  const pink = new THREE.PointLight(0xff3bc8, 55, 36, 2); pink.position.set(6, 7, -8);
  const key = new THREE.DirectionalLight(0xd9f8ff, 2.3); key.position.set(-8, 18, 10); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -15; key.shadow.camera.right = 15;
  key.shadow.camera.top = 18; key.shadow.camera.bottom = -45;
  const lights = [hemisphere, cyan, pink, key]; const values = lights.map(light => light.intensity); scene.add(...lights);
  return { setIntensity(value) { lights.forEach((light, index) => { light.intensity = values[index] * value; }); },
    dispose() { lights.forEach(light => { light.removeFromParent(); light.dispose(); }); } };
}

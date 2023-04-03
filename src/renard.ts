import { Scene, Color3, Mesh, Vector3, PointLight, Texture, Color4, ParticleSystem, AnimationGroup, PBRMetallicRoughnessMaterial } from "@babylonjs/core";

export class Renard {
    public _scene: Scene;

    public mesh: Mesh;
    public isLit: boolean = false;
    private _lightmtl: PBRMetallicRoughnessMaterial;
    private _light: PointLight;

    private _spinAnim: AnimationGroup;

    //Particle System
    private _stars: ParticleSystem;

    constructor(lightmtl: PBRMetallicRoughnessMaterial, mesh: Mesh, scene: Scene, position: Vector3, animationGroups: AnimationGroup) {
        this._scene = scene;
        this._lightmtl = lightmtl;

        this._loadRenard(mesh, position);

        //set animations
        this._spinAnim = animationGroups;
    }

    private _loadRenard(mesh: Mesh, position: Vector3): void {
        this.mesh = mesh;
        this.mesh.scaling = new Vector3(.8, .8, .8);
        this.mesh.setAbsolutePosition(position);
        this.mesh.isPickable = false;
    }

  
}
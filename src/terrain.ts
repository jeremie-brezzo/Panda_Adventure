import { Scene, Mesh, Vector3, Color3, TransformNode, SceneLoader, ParticleSystem, Color4, Texture, PBRMetallicRoughnessMaterial, VertexBuffer, AnimationGroup, Sound, ExecuteCodeAction, ActionManager, Tags } from "@babylonjs/core";
import { Renard } from "./renard";
import { Player } from "./panda";
import { Hud } from "./ui";

export class Environment {
    private _scene: Scene;

    //Meshes
    private _renardListe: Array<Renard>; 
    private _lightmtl: PBRMetallicRoughnessMaterial; 

    constructor(scene: Scene) {
        this._scene = scene;
        this._renardListe = [];

 
    }
    //What we do once the environment assets have been imported
    //handles setting the necessary flags for collision and trigger meshes,
     public async load() {
       
        const assets = await this._loadAsset();

        console.log(assets);
        //affiche tout les assets
        console.log(assets.allMeshes);

        //Loop through all environment meshes that were imported
        assets.allMeshes.forEach(m => {
            m.checkCollisions = true;

           
            //collision meshes
            if (m.name.includes("collision")) {
                m.isVisible = false;
                m.isPickable = true;
            }
            //trigger meshes
            if (m.name.includes("Trigger")) {
                m.isVisible = false;
                m.isPickable = false;
                m.checkCollisions = false;
            }
        });

        assets.renard.isVisible = false; //original mesh is not visible
        const renardHolder = new TransformNode("renardHolder", this._scene);
        for (let i = 0; i < 22; i++) {
            //Mesh Cloning
            let renardInstance = assets.renard.clone("renard" + i); 
            renardInstance.isVisible = true;
            renardInstance.setParent(renardHolder);

            //Animation cloning
            let animGroupClone = new AnimationGroup("renardAnimGroup " + i);
            animGroupClone.addTargetedAnimation(assets.animationGroups.targetedAnimations[0].animation, renardInstance);

            let newRenard = new Renard(this._lightmtl, renardInstance, this._scene, assets.env.getChildTransformNodes(false).find(m => m.name === "lantern " + i).getAbsolutePosition(), animGroupClone);
            this._renardListe.push(newRenard);
        }
        //dispose of original mesh and animation group that were cloned
        assets.renard.dispose();
        assets.animationGroups.dispose();
     }


    //Load all necessary meshes for the environment
    public async _loadAsset() {
        //loads game environment
        const result = await SceneLoader.ImportMeshAsync(null, "./models/", "untitled.glb", this._scene);

        let env = result.meshes[0];
        let allMeshes = env.getChildMeshes();

        const res = await SceneLoader.ImportMeshAsync("", "./models/", "renard.glb", this._scene);

        let renard = res.meshes[0].getChildren()[0];
        renard.parent = null;
        res.meshes[0].dispose();

        //--ANIMATION--
        const importedAnims = res.animationGroups;
        let animation = [];
        animation.push(importedAnims[0].targetedAnimations[0].animation);
        importedAnims[0].dispose();
        //create a new animation group and target the mesh to its animation
        let animGroup = new AnimationGroup("renardAnimGroup");
        animGroup.addTargetedAnimation(animation[0], res.meshes[1]);

        return {
            env: env,
            allMeshes: allMeshes,
            renard: renard as Mesh,
            animationGroups: animGroup
        }
    }

    public checkRenard(player: Player,ui: Hud) {
    
        this._renardListe.forEach(renard => {
            player.mesh.actionManager.registerAction(
                new ExecuteCodeAction(
                    {
                        trigger: ActionManager.OnIntersectionEnterTrigger,
                        parameter: renard.mesh
                    },
                    () => {
                        
                            player.renard_founded += 1;
           
                            console.log("collision");
                             ui.createFindRenard();
                      
                            player.lightSfx.play();
                        
                  
                    }
                )
            );
        });
    }


}


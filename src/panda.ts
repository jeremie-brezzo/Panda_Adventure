import { Scene, Vector3, Ray, TransformNode, Mesh, Color3, Color4, UniversalCamera, Quaternion, AnimationGroup, ExecuteCodeAction, ActionManager, ParticleSystem, Texture, SphereParticleEmitter, Sound, Observable, ShadowGenerator } from "@babylonjs/core";
import { PlayerInput } from "./inputController";

export class Player extends TransformNode {
    public camera: UniversalCamera;
    
    public scene: Scene;
    private _input: PlayerInput;

    //Player
    public mesh: Mesh; //outer collisionbox of player

    //Camera
    private _camRoot: TransformNode;
    private heightcam: TransformNode;

    //animations
    private _run: AnimationGroup;
    private _idle: AnimationGroup;
    private _jump: AnimationGroup;
    private _land: AnimationGroup;
    private _dash: AnimationGroup;

    // animation trackers
    private _currentAnim: AnimationGroup = null;
    private _prevAnim: AnimationGroup;
    private _isFalling: boolean = false;
    private _jumped: boolean = false;

    //const values
    private static readonly PLAYER_SPEED: number = 0.45;
    private static readonly JUMP_FORCE: number = 0.80;
    private static readonly GRAVITY: number = -2.8;
    private static readonly DASH_FACTOR: number = 1.5;
    private static readonly DASH_TIME: number = 10; //how many frames the dash lasts
    private static readonly DOWN_TILT: Vector3 = new Vector3(0.8290313946973066, 0, 0);
    private static readonly ORIGINAL_TILT: Vector3 = new Vector3(0.3934119456780721, 0, 0);
    public dashTime: number = 0;

    //player movement vars
    private _deltaTime: number = 0;
    private _h: number;
    private _v: number;

    private _moveDirection: Vector3 = new Vector3();
    private _inputAmt: number;

    //dashing
    private _dashPressed: boolean;
    private _canDash: boolean = true;

    //gravity, ground detection, jumping
    private _gravity: Vector3 = new Vector3();
    private _lastGroundPos: Vector3 = Vector3.Zero(); // keep track of the last grounded position
    private _grounded: boolean;
    private _jumpCount: number = 1;

    //player variables
    public renard_founded: number = 1; 
    public total_renard: number;
    public win: boolean = false; //whether the game is won



    //moving platforms
    public _raisePlatform: boolean;

    //sfx
    public lightSfx: Sound;
    private _walkingSfx: Sound;
    private _jumpingSfx: Sound;
    private _dashingSfx: Sound;

    //observables
    public onRun = new Observable();


    constructor(assets, scene: Scene, shadowGenerator: ShadowGenerator, input?: PlayerInput) {
        super("player", scene);
        this.scene = scene;

        //set up sounds
        this._loadSounds(this.scene);
        //camera
        this._setupPlayerCamera();
        this.mesh = assets.mesh;
        this.mesh.parent = this;

        this._idle = assets.animationGroups[1];
        this._jump = assets.animationGroups[2];
        this._land = assets.animationGroups[3];
        this._run = assets.animationGroups[4];
        this._dash = assets.animationGroups[5];

        //--COLLISIONS--
        this.mesh.actionManager = new ActionManager(this.scene);

        
        //--SOUNDS--
        //observable for when to play the walking sfx
        this.onRun.add((play) => {
            if (play && !this._walkingSfx.isPlaying) {
                this._walkingSfx.play();
            } else if (!play && this._walkingSfx.isPlaying) {
                this._walkingSfx.stop();
                this._walkingSfx.isPlaying = false; // make sure that walkingsfx.stop is called only once
            }
        })

        this._setUpAnimations();
        shadowGenerator.addShadowCaster(assets.mesh);

        this._input = input;
    }

    private _updateFromControls(): void {
        this._deltaTime = this.scene.getEngine().getDeltaTime() / 1000.0;

        this._moveDirection = Vector3.Zero();
        this._h = this._input.horizontal; //right, x
        this._v = this._input.vertical; //fwd, z

     

        //--DASHING--
        //limit dash to once per ground/platform touch
        //can only dash when in the air
        if (this._input.dashing && !this._dashPressed && this._canDash && !this._grounded) {
            this._canDash = false;
            this._dashPressed = true;
    
            //sfx and animations
            this._currentAnim = this._dash;
            this._dashingSfx.play();

        }

        let dashFactor = 1;
        //if you're dashing, scale movement
        if (this._dashPressed) {
            if (this.dashTime > Player.DASH_TIME) {
                this.dashTime = 0;
                this._dashPressed = false;
            } else {
                dashFactor = Player.DASH_FACTOR;
            }
            this.dashTime++;
        }

        //--MOVEMENTS BASED ON CAMERA (as it rotates)--
        let fwd = this._camRoot.forward;
        let right = this._camRoot.right;
        let correctedVertical = fwd.scaleInPlace(this._v);
        let correctedHorizontal = right.scaleInPlace(this._h);

        //movement based off of camera's view
        let move = correctedHorizontal.addInPlace(correctedVertical);

        //clear y so that the character doesnt fly up, normalize for next step, taking into account whether we've DASHED or not
        this._moveDirection = new Vector3((move).normalize().x * dashFactor, 0, (move).normalize().z * dashFactor);

        //clamp the input value so that diagonal movement isn't twice as fast
        let inputMag = Math.abs(this._h) + Math.abs(this._v);
        if (inputMag < 0) {
            this._inputAmt = 0;
        } else if (inputMag > 1) {
            this._inputAmt = 1;
        } else {
            this._inputAmt = inputMag;
        }
        //final movement that takes into consideration the inputs
        this._moveDirection = this._moveDirection.scaleInPlace(this._inputAmt * Player.PLAYER_SPEED);

        //check if there is movement to determine if rotation is needed
        let input = new Vector3(this._input.horizontalAxis, 0, this._input.verticalAxis); //along which axis is the direction
        if (input.length() == 0) {//if there's no input detected, prevent rotation and keep player in same rotation
            return;
        }

        //rotation based on input & the camera angle
        let angle = Math.atan2(this._input.horizontalAxis, this._input.verticalAxis);
        angle += this._camRoot.rotation.y;
        let targ = Quaternion.FromEulerAngles(0, angle, 0);
        this.mesh.rotationQuaternion = Quaternion.Slerp(this.mesh.rotationQuaternion, targ, 10 * this._deltaTime);
    }

    private _setUpAnimations(): void {

        this.scene.stopAllAnimations();
        this._run.loopAnimation = true;
        this._idle.loopAnimation = true;

        //initialize current and previous
        this._currentAnim = this._idle;
        this._prevAnim = this._land;
    }

    private _animatePlayer(): void {
        if (!this._dashPressed && !this._isFalling && !this._jumped 
            && (this._input.inputMap["ArrowUp"] 
            || this._input.inputMap["ArrowDown"] 
            || this._input.inputMap["ArrowLeft"] 
            || this._input.inputMap["ArrowRight"] )) {

            this._currentAnim = this._run;
            this.onRun.notifyObservers(true);
        } else if (this._jumped && !this._isFalling && !this._dashPressed) {
            this._currentAnim = this._jump;
        } else if (!this._isFalling && this._grounded) {
            this._currentAnim = this._idle;
            //only notify observer if it's playing
            if(this.scene.getSoundByName("walking").isPlaying){
                this.onRun.notifyObservers(false);
            }
        } else if (this._isFalling) {
            this._currentAnim = this._land;
        }

        //Animations
        if(this._currentAnim != null && this._prevAnim !== this._currentAnim){
            this._prevAnim.stop();
            this._currentAnim.play(this._currentAnim.loopAnimation);
            this._prevAnim = this._currentAnim;
        }
    }

    //--GROUND DETECTION--
    //Send raycast to the floor to detect if there are any hits with meshes below the character
    private _floorRaycast(offsetx: number, offsetz: number, raycastlen: number): Vector3 {
        //position the raycast from bottom center of mesh
        let raycastFloorPos = new Vector3(this.mesh.position.x + offsetx, this.mesh.position.y + 0.5, this.mesh.position.z + offsetz);
        let ray = new Ray(raycastFloorPos, Vector3.Up().scale(-1), raycastlen);

        //defined which type of meshes should be pickable
        let predicate = function (mesh) {
            return mesh.isPickable && mesh.isEnabled();
        }

        let pick = this.scene.pickWithRay(ray, predicate);

        if (pick.hit) { //grounded
            return pick.pickedPoint;
        } else { //not grounded
            return Vector3.Zero();
        }
    }

    //raycast from the center of the player to check for whether player is grounded
    private _isGrounded(): boolean {
        if (this._floorRaycast(0, 0, .6).equals(Vector3.Zero())) {
            return false;
        } else {
            return true;
        }
    }

  

    private _updateGroundDetection(): void {
        this._deltaTime = this.scene.getEngine().getDeltaTime() / 1000.0;

        //if not grounded
        if (!this._isGrounded()) {
       
                this._gravity = this._gravity.addInPlace(Vector3.Up().scale(this._deltaTime * Player.GRAVITY));
                this._grounded = false;
          
        }

        //limit the speed of gravity to the negative of the jump power
        if (this._gravity.y < -Player.JUMP_FORCE) {
            this._gravity.y = -Player.JUMP_FORCE;
        }

        //cue falling animation once gravity starts pushing down
        if (this._gravity.y < 0 && this._jumped) { //todo: play a falling anim if not grounded BUT not on a slope
            this._isFalling = true;
        }

        //update our movement to account for jumping
        this.mesh.moveWithCollisions(this._moveDirection.addInPlace(this._gravity));

        if (this._isGrounded()) {
            this._gravity.y = 0;
            this._grounded = true;
            //keep track of last known ground position
            this._lastGroundPos.copyFrom(this.mesh.position);

            this._jumpCount = 1;
            //dashing reset
            this._canDash = true;
            //reset sequence(needed if we collide with the ground BEFORE actually completing the dash duration)
            this.dashTime = 0;
            this._dashPressed = false;

            //jump & falling animation flags
            this._jumped = false;
            this._isFalling = false;

        }

        //Jump detection
        if (this._input.jumpKeyDown && this._jumpCount > 0) {
            this._gravity.y = Player.JUMP_FORCE;
            this._jumpCount--;

            //jumping and falling animation flags
            this._jumped = true;
            this._isFalling = false;
            this._jumpingSfx.play();


        }

    }

    //--GAME UPDATES--
    private _beforeRenderUpdate(): void {
        this._updateFromControls();
        this._updateGroundDetection();
        this._animatePlayer();
    }

    public activatePlayerCamera(): UniversalCamera {
        this.scene.registerBeforeRender(() => {

            this._beforeRenderUpdate();
            this._updateCamera();

        })
        return this.camera;
    }

    //--CAMERA--
    private _updateCamera(): void {

        //trigger areas for rotating camera view
        if (this.mesh.intersectsMesh(this.scene.getMeshByName("cornerTrigger"))) {
            if (this._input.verticalAxis> 0) { //rotates to the right                
                this._camRoot.rotation = Vector3.Lerp(this._camRoot.rotation, new Vector3(this._camRoot.rotation.x, Math.PI / 2, this._camRoot.rotation.z), 0.4);
            } else if (this._input.verticalAxis < 0) { //rotates to the left
                this._camRoot.rotation = Vector3.Lerp(this._camRoot.rotation, new Vector3(this._camRoot.rotation.x, Math.PI, this._camRoot.rotation.z), 0.4);
            }
        }

        //update camera postion up/down movement
        let centerPlayer = this.mesh.position.y + 2;
        this._camRoot.position = Vector3.Lerp(this._camRoot.position, new Vector3(this.mesh.position.x, centerPlayer, this.mesh.position.z), 0.4);
    }

    private _setupPlayerCamera(): UniversalCamera {
        //root camera parent that handles positioning of the camera to follow the player
        this._camRoot = new TransformNode("root");
        this._camRoot.position = new Vector3(0, 0, 0); //initialized at (0,0,0)
        //to face the player from behind (180 degrees)
        this._camRoot.rotation = new Vector3(0, Math.PI, 0);

        //rotations along the x-axis (up/down tilting)
        let yTilt = new TransformNode("ytilt");
        //adjustments to camera view to point down at our player
        yTilt.rotation = Player.ORIGINAL_TILT;
        this.heightcam = yTilt;
        yTilt.parent = this._camRoot;

        //our actual camera that's pointing at our root's position
        this.camera = new UniversalCamera("cam", new Vector3(0, 0, -30), this.scene);
        this.camera.lockedTarget = this._camRoot.position;
        this.camera.fov = 0.67350045992678597;
        this.camera.parent = yTilt;

        this.scene.activeCamera = this.camera;
        return this.camera;
    }



    private _loadSounds(scene: Scene): void {

        this.lightSfx = new Sound("light", "./sounds/Rise03.mp3", scene, function () {
        });

        this._jumpingSfx = new Sound("jumping", "./sounds/187024__lloydevans09__jump2.wav", scene, function () {
        }, {
            volume: 0.25
        });

        this._dashingSfx = new Sound("dashing", "./sounds/194081__potentjello__woosh-noise-1.wav", scene, function () {
        });

        this._walkingSfx = new Sound("walking", "./sounds/Concrete 2.wav", scene, function () {
        }, {
            loop: true,
            volume: 0.20,
            playbackRate: 0.6
        });

      
    }
}
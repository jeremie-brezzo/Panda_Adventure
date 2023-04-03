import { TextBlock, StackPanel, AdvancedDynamicTexture, Image, Button, Rectangle, Control, Grid } from "@babylonjs/gui";
import { Scene, Sound, ParticleSystem, PostProcess, Effect, SceneSerializer } from "@babylonjs/core";

export class Hud {
    private _scene: Scene;

    //Game Timer
    public time: number; //keep track to signal end game REAL TIME
    private _prevTime: number = 0;
    private _clockTime: TextBlock = null; //GAME TIME
    private _startTime: number;
    private _stopTimer: boolean;

    private _renardCount: TextBlock;


    //Timer handlers
    public stopSpark: boolean;
  

    //Pause toggle
    public gamePaused: boolean;

    //Quit game
    public quit: boolean;
    public transition: boolean = false;

    //UI Elements
    public pauseBtn: Button;
    public fadeLevel: number;
    private _playerUI;
    private _pauseMenu;
    public tutorial;
    public hint;

 

    //Sounds
    public quitSfx: Sound;
    private _sfx: Sound;
    private _pause: Sound;
    private _sparkWarningSfx: Sound;
 

    constructor(scene: Scene) {

        this._scene = scene;

        const playerUI = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        this._playerUI = playerUI;
        this._playerUI.idealHeight = 720;

        const renardCount = new TextBlock();
        renardCount.name = "Renard count";
        renardCount.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_CENTER;
        renardCount.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        renardCount.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        renardCount.fontSize = "22px";
        renardCount.color = "white";
        renardCount.text = "Renard: 1 / 22";
        renardCount.top = "32px";
        renardCount.left = "-64px";
        renardCount.width = "25%";
        renardCount.fontFamily = "Viga";
        renardCount.resizeToFit = true;
        playerUI.addControl(renardCount);
        this._renardCount = renardCount;

        const stackPanel = new StackPanel();
        stackPanel.height = "100%";
        stackPanel.width = "100%";
        stackPanel.top = "14px";
        stackPanel.verticalAlignment = 0;
        playerUI.addControl(stackPanel);

        //Game timer text
        const clockTime = new TextBlock();
        clockTime.name = "clock";
        clockTime.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER;
        clockTime.fontSize = "48px";
        clockTime.color = "white";
        clockTime.text = "11:00";
        clockTime.resizeToFit = true;
        clockTime.height = "96px";
        clockTime.width = "220px";
        clockTime.fontFamily = "Viga";
       stackPanel.addControl(clockTime);
        this._clockTime = clockTime;

      

        const pauseBtn = Button.CreateImageOnlyButton("pauseBtn", "./sprites/pause2.png");
        pauseBtn.width = "48px";
        pauseBtn.height = "56px";
        pauseBtn.thickness = 0;
        pauseBtn.verticalAlignment = 0;
        pauseBtn.horizontalAlignment = 1;
        pauseBtn.top = "10px";
        playerUI.addControl(pauseBtn);
        pauseBtn.zIndex = 10;
        this.pauseBtn = pauseBtn;
        //when the button is down, make pause menu visable and add control to it
        pauseBtn.onPointerDownObservable.add(() => {
            this._pauseMenu.isVisible = true;
            playerUI.addControl(this._pauseMenu);
            this.pauseBtn.isHitTestVisible = false;

            //when game is paused, make sure that the next start time is the time it was when paused
            this.gamePaused = true;
            this._prevTime = this.time;

            //--SOUNDS--
            this._scene.getSoundByName("gameSong").pause();
            this._pause.play(); //play pause music
        });


        this._createPauseMenu();
        this._loadSounds(scene);     
    }

    public updateHud(): void {
        if (!this._stopTimer && this._startTime != null) {
            let curTime = Math.floor((new Date().getTime() - this._startTime) / 1000) + this._prevTime; // divide by 1000 to get seconds

            this.time = curTime; //keeps track of the total time elapsed in seconds
            this._clockTime.text = this.time.toString() + "s / 240 s";
        }
    }

    public updateRenardCount(numRenards: number): void {
        this._renardCount.text = "Renards: " + numRenards + " / 22";
    }
    //---- Game Timer ----
    public startTimer(): void {
        this._startTime = new Date().getTime();
        this._stopTimer = false;
    }
    public stopTimer(): void {
        this._stopTimer = true;
    }


    //---- Pause Menu Popup ----
    private _createPauseMenu(): void {
        this.gamePaused = false;

        const pauseMenu = new Rectangle();
        pauseMenu.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        pauseMenu.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        pauseMenu.height = 0.8;
        pauseMenu.width = 0.5;
        pauseMenu.thickness = 0;
        pauseMenu.isVisible = false;

       

        //stack panel for the buttons
        const stackPanel = new StackPanel();
        stackPanel.width = .83;
        pauseMenu.addControl(stackPanel);

        const resumeBtn = Button.CreateSimpleButton("resume", "RESUME");
        resumeBtn.width = 0.18;
        resumeBtn.height = "44px";
        resumeBtn.color = "white";
        resumeBtn.fontFamily = "Viga";
        resumeBtn.paddingBottom = "14px";
        resumeBtn.cornerRadius = 14;
        resumeBtn.fontSize = "12px";
        resumeBtn.textBlock.resizeToFit = true;
        resumeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        resumeBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        stackPanel.addControl(resumeBtn);

        this._pauseMenu = pauseMenu;

        //when the button is down, make menu invisable and remove control of the menu
        resumeBtn.onPointerDownObservable.add(() => {
            this._pauseMenu.isVisible = false;
            this._playerUI.removeControl(pauseMenu);
            this.pauseBtn.isHitTestVisible = true;
            
            //game unpaused, our time is now reset
            this.gamePaused = false;
            this._startTime = new Date().getTime();

            //--SOUNDS--
            this._scene.getSoundByName("gameSong").play();
            this._pause.stop();

            if(this._sparkWarningSfx.isPaused) {
                this._sparkWarningSfx.play();
            }
            this._sfx.play(); //play transition sound
        });


        const quitBtn = Button.CreateSimpleButton("quit", "QUIT");
        quitBtn.width = 0.18;
        quitBtn.height = "44px";
        quitBtn.color = "white";
        quitBtn.fontFamily = "Viga";
        quitBtn.paddingBottom = "12px";
        quitBtn.cornerRadius = 14;
        quitBtn.fontSize = "12px";
        resumeBtn.textBlock.resizeToFit = true;
        quitBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        quitBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        stackPanel.addControl(quitBtn);
        this.fadeLevel = 1.0;

        quitBtn.onPointerDownObservable.add(() => {
            const postProcess = new PostProcess("Fade", "fade", ["fadeLevel"], null, 1.0, this._scene.getCameraByName("cam"));
            postProcess.onApply = (effect) => {
                effect.setFloat("fadeLevel", this.fadeLevel);
            };
            this.transition = true;

            //--SOUNDS--
            this.quitSfx.play();
            if(this._pause.isPlaying){
                this._pause.stop();
            }
        })
    }



    public createFindRenard(): void {
     
        const title = new TextBlock("title", "Vous avez trouvé un renard!");
        title.resizeToFit = true;
        title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        title.fontFamily = "Viga";
        title.fontSize = "32px";
        title.top = "14px";
        this._playerUI.addControl(title);

        //boucle de temps de 2 secondes

        setTimeout(() => {
            this._playerUI.removeControl(title);
        }, 2000);


        console.log("collisiondgfdhgfdhgfdhgfdhgfd");
    }





    //load all sounds needed for game ui interactions
    private _loadSounds(scene: Scene): void {
        this._pause = new Sound("pauseSong", "./sounds/Snowland.wav", scene, function () {
        }, {
            volume: 0.2
        });

        this._sfx = new Sound("selection", "./sounds/vgmenuselect.wav", scene, function () {
        });

        this.quitSfx = new Sound("quit", "./sounds/Retro Event UI 13.wav", scene, function () {
        });

        this._sparkWarningSfx = new Sound("sparkWarning", "./sounds/Retro Water Drop 01.wav", scene, function () {
        }, {
            loop: true,
            volume: 0.5,
            playbackRate: 0.6
        });
    }
}
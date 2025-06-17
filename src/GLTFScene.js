import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'gsap';

export class GLTFSceneManager {
    constructor(containerId, modelPath, animationName, onLoadedCallback = null) {
       
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Контейнер с ID "${containerId}" не найден.`);
            return;
        }
        this.modelPath = modelPath;
        this.targetAnimationName = animationName;
        this.onLoadedCallback = onLoadedCallback;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.mixer = null;
        this.model = null;
        this.animations = {};
        this.activeAction = null;
        this.clock = new THREE.Clock();

        this.diceAtlasTexture = null;
        this.diceAlphaTexture = null;

        //Позиция дайсов
        this.redDice = 1;
        this.yellowDice = 1;

        this._init();
    }

    _init() {
       
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        
        this.camera.position.set(0, 1.4, 0); 
        this.camera.lookAt(0, 0, 0);
       
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        //this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        gsap.ticker.add(() => {
             const delta = this.clock.getDelta(); 
        this._animate(delta);
        });
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
       
        const loadingManager = new THREE.LoadingManager();

        loadingManager.onLoad = () => {
            console.log("Все ресурсы (модель и текстуры) успешно загружены!");

            this.createWrapper('Dice_1',this.redDice);
            this.createWrapper('Dice_2',this.yellowDice);

            if (this.onLoadedCallback) {
                this.onLoadedCallback(this, null);
            }
        };
        
        loadingManager.onError = (url) => {
            console.error(`Произошла ошибка при загрузке ресурса: ${url}`);
        };

        const gltfLoader = new GLTFLoader(loadingManager);
        gltfLoader.load(this.modelPath, (gltf) => {
            this.model = gltf.scene;
            this.model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });

            // Создаем материалы
            const yellowMaterial = new THREE.MeshStandardMaterial({ color: 0xE59F43 }); // Желтый
            const redMaterial = new THREE.MeshStandardMaterial({ color: 0xF4614F });   // Красный

            // Находим объекты по имени
            const dice1 = this.model.getObjectByName("Dice_1");
            const dice2 = this.model.getObjectByName("Dice_2");
            
            
            // Применяем желтый материал ко всем мешам внутри объекта "Dice_1"
            if (dice1) {
                dice1.traverse((child) => {
                    if (child.isMesh) {
                        child.material = redMaterial;
                    }
                });
            } else {
                console.warn('Объект "Dice_1" не найден в GLTF модели.');
            }

            // Применяем красный материал ко всем мешам внутри объекта "Dice_2"
            if (dice2) {
                dice2.traverse((child) => {
                    if (child.isMesh) {
                        child.material = yellowMaterial;
                    }
                });
            } else {
                 console.warn('Объект "Dice_2" не найден в GLTF модели.');
            }
            
            
            this.scene.add(this.model);

            
            if (gltf.animations && gltf.animations.length) {
                this.mixer = new THREE.AnimationMixer(this.model);
                gltf.animations.forEach((clip) => {
                    this.animations[clip.name] = this.mixer.clipAction(clip);
                });
                console.log("Доступные анимации:", Object.keys(this.animations));
            }
        });

        const textureLoader = new THREE.TextureLoader(loadingManager);
        
        textureLoader.load('dice-eges.jpg', (texture) => {
            this.diceAtlasTexture = texture;
            this.diceAtlasTexture.magFilter = THREE.NearestFilter;
        });

        textureLoader.load('dice-alpha.jpg', (texture) => {
            this.diceAlphaTexture = texture;
        });

        window.addEventListener('resize', this._onWindowResize.bind(this), false);
    }


    _animate(delta) {
        if (this.mixer) this.mixer.update(delta);
        this.renderer.render(this.scene, this.camera);
    }

     _clearWrappers() {
        const parentNames = ['Dice_1', 'Dice_2'];

        parentNames.forEach(name => {
            const parentObject = this.model.getObjectByName(name);
            
            if (parentObject) {
                for (let i = parentObject.children.length - 1; i >= 0; i--) {
                    const child = parentObject.children[i];
                    
                    parentObject.remove(child);

                    if (child.isGroup) {
                        child.traverse((object) => {
                            if (object.isMesh) {
                                if (object.geometry) object.geometry.dispose();
                                if (object.material) {
                                    if (object.material.map) object.material.map.dispose();
                                    if (object.material.alphaMap) object.material.alphaMap.dispose();
                                    object.material.dispose();
                                }
                            }
                        });
                    }
                }
            }
        });
        
    }
 

     createWrapper(objectNameToFollow, diceEge) {
        if (!this.model || !this.diceAtlasTexture || !this.diceAlphaTexture) {
            console.error("Модель или текстуры (основная или альфа) еще не загружены.");
            return;
        }

        const targetObject = this.model.getObjectByName(objectNameToFollow);
        if (!targetObject) {
            console.warn(`Объект для отслеживания "${objectNameToFollow}" не найден.`);
            return;
        }
        
        const wrapper = new THREE.Group();

        const u_step = 1 / 3;
        const v_step = 1 / 4;
        const uv_map = {
            1: [1*u_step, 3*v_step, 2*u_step, 4*v_step], 2: [1*u_step, 2*v_step, 2*u_step, 3*v_step],
            3: [1*u_step, 1*v_step, 2*u_step, 2*v_step], 4: [1*u_step, 0*v_step, 2*u_step, 1*v_step],
            5: [0*u_step, 2*v_step, 1*u_step, 3*v_step], 6: [2*u_step, 2*v_step, 3*u_step, 3*v_step]
        };
        
        
        const createFace = (faceNumber) => {
            const [u_min, v_min, u_max, v_max] = uv_map[faceNumber];

            const colorTexture = this.diceAtlasTexture.clone();
            colorTexture.needsUpdate = true;
            colorTexture.repeat.set(u_max - u_min, v_max - v_min);
            colorTexture.offset.set(u_min, v_min);

            const alphaTexture = this.diceAlphaTexture.clone();
            alphaTexture.needsUpdate = true;
            alphaTexture.repeat.set(u_max - u_min, v_max - v_min);
            alphaTexture.offset.set(u_min, v_min);
            
            return new THREE.MeshBasicMaterial({
                map: colorTexture,
                alphaMap: alphaTexture, 
                transparent: true,
            });
        };

        let sTMP = 0.203; // Скейл обертки

        const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(sTMP, sTMP), createFace(2));
        frontFace.position.z = sTMP / 2;
        wrapper.add(frontFace);
        
        const backFace = new THREE.Mesh(new THREE.PlaneGeometry(sTMP, sTMP), createFace(5));
        backFace.position.z = -sTMP / 2;
        backFace.rotation.y = Math.PI;
        wrapper.add(backFace);

        const topFace = new THREE.Mesh(new THREE.PlaneGeometry(sTMP, sTMP), createFace(1));
        topFace.position.y = sTMP / 2;
        topFace.rotation.x = -Math.PI / 2;
        wrapper.add(topFace);
        
        const bottomFace = new THREE.Mesh(new THREE.PlaneGeometry(sTMP, sTMP), createFace(6));
        bottomFace.position.y = -sTMP / 2;
        bottomFace.rotation.x = Math.PI / 2;
        wrapper.add(bottomFace);
        
        const rightFace = new THREE.Mesh(new THREE.PlaneGeometry(sTMP, sTMP), createFace(3));
        rightFace.position.x = sTMP / 2;
        rightFace.rotation.y = Math.PI / 2;
        wrapper.add(rightFace);
        
        const leftFace = new THREE.Mesh(new THREE.PlaneGeometry(sTMP, sTMP), createFace(4));
        leftFace.position.x = -sTMP / 2;
        leftFace.rotation.y = -Math.PI / 2;
        wrapper.add(leftFace);

        // Создаем матрицу для нашего начального вращения
        const initialRotationMatrix = new THREE.Matrix4();
        
        // Создаем Эйлеров угол из значений
        const rotationMap = getRotation(objectNameToFollow, diceEge);
        
        const euler = new THREE.Euler(rotationMap[0], rotationMap[1],rotationMap[2], 'XYZ');
        // Преобразуем Эйлеров угол в матрицу вращения
        initialRotationMatrix.makeRotationFromEuler(euler);

        wrapper.matrixAutoUpdate = false;
        wrapper.matrix.copy(initialRotationMatrix);
        targetObject.add(wrapper)
    } 

    _onWindowResize() {
        if (!this.container) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
   
    controlTargetAnimation(command, loop = true, loopMode = THREE.LoopRepeat, repetitions = Infinity) {
        const targetAction = this.animations[this.targetAnimationName];
        if (!targetAction) {
            console.warn(`Анимация "${this.targetAnimationName}" не готова или не существует.`);
            return;
        }

        switch (command) {
            case 'play':
                    this._clearWrappers();
                    this.createWrapper('Dice_1',this.redDice);
                    this.createWrapper('Dice_2',this.yellowDice);

                    targetAction.reset();
                    targetAction.setLoop(loopMode, loop ? repetitions : 1);
                    targetAction.clampWhenFinished = !loop;
                    targetAction.play()
                    this.activeAction = targetAction;
                
               
                break;
            case 'pause':
                if (targetAction.isRunning()) {
                    targetAction.paused = !targetAction.paused;
                }
                break;
            case 'stop':
                if (this.activeAction === targetAction) {
                    this.activeAction = null;
                }
                break;
            case 'reset':
                targetAction.reset();
                break;
            default:
                console.warn(`Неизвестная команда для анимации: ${command}`);
        }
    }
    // Рандомное значания для кубов
    randomizeDice() {
        this.redDice = Math.floor(Math.random() * 6) + 1;
        this.yellowDice = Math.floor(Math.random() * 6) + 1;
    }

    // Устанавливаем значания для кубов
    setDice(yellow, red) {
        this.redDice = Math.min(6, Math.max(1, red));
        this.yellowDice = Math.min(6, Math.max(1, yellow));
    }

    destroy() {
        window.removeEventListener('resize', this._onWindowResize.bind(this));
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode === this.container) {
                 this.container.removeChild(this.renderer.domElement);
            }
        }
        if (this.scene) {
            this.scene.traverse(object => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
        console.log("GLTFSceneManager destroyed");
    }
}


function getRotation(name, value) {
    const rotations = {
        Dice_1: new Map([
            [1, [0, 0, 4.71239]],
            [2, [0, 1.5708, 0]],
            [3, [0, 0, 0]],
            [4, [0, 3.14159, 0]],
            [5, [0, 4.71239, 0]],
            [6, [1.5708, 0, 1.5708]]
        ]),
        Dice_2: new Map([
            [1, [0, 0, 0]],
            [2, [-1.5708, 0, 0]],
            [3, [0, 0, 1.5708]],
            [4, [0, 0, -1.5708]],
            [5, [1.5708, 0, 0]],
            [6, [-3.14159, 0, 0]]
        ])
    };

    const dice = rotations[name];
    if (!dice) return [0, 0, 0]; 
    return dice.get(value) || [0, 0, 0]; 
}
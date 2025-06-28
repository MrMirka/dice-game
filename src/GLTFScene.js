import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'gsap';
import { DirectionalLightHelper } from 'three';

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

        this.redDiceMaterial = null;
        this.yellowDiceMaterial = null;

        

        this.diceAtlasTexture = null;
        this.diceAlphaTexture = null;

        this.debugParams = {
            environmentMapIntensity: 1.5,
            environmentRotationX: 1.14,
            environmentRotationY: 4,
            environmentRotationZ: 0,
            directionalLightIntensity: 0.15,
        };

        //Позиция дайсов
        this.redDice = 1;
        this.yellowDice = 1;

        this._init();
       
    }

    _init() {
       
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.scene.environmentRotation = new THREE.Euler(); 
        this.camera.position.set(0, 1.4, 0); 
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
         this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = this.debugParams.environmentMapIntensity;
        this.renderer.useLegacyLights = false;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
        this.container.appendChild(this.renderer.domElement);
        this._loadEnvironmentMap();

        gsap.ticker.add(() => {
             const delta = this.clock.getDelta(); 
        this._animate(delta);
        });
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        //this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        //this.scene.add(directionalLight);

        // Directional Light
        this.directionalLight = new THREE.DirectionalLight(0xffffff, this.debugParams.directionalLightIntensity);
        this.directionalLight.position.set(3.2, 11.6, 4.3);
        this.directionalLight.castShadow = true;
        this.directionalLight.shadow.mapSize.width = 1024;
        this.directionalLight.shadow.mapSize.height = 1024;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 20;
        this.scene.add(this.directionalLight);

        this.directionalLightHelper = new DirectionalLightHelper(this.directionalLight, 0.5, 0xffff00);
        this.scene.add(this.directionalLightHelper);
        this.directionalLightHelper.visible = false;
       
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
            
            this.yellowDiceMaterial = new THREE.MeshStandardMaterial({ color: 0xE59F43, roughness: 0.3 });
            this.redDiceMaterial = new THREE.MeshStandardMaterial({ color: 0xF4614F, roughness: 0.3 });

            // Находим объекты по имени
            const dice1 = this.model.getObjectByName("Dice_1");
            const dice2 = this.model.getObjectByName("Dice_2");
            
            
            // Применяем желтый материал ко всем мешам внутри объекта "Dice_1"
            if (dice1) {
                dice1.traverse((child) => {
                    if (child.isMesh) {
                        child.material = this.redDiceMaterial;
                    }
                });
            } else {
                console.warn('Объект "Dice_1" не найден в GLTF модели.');
            }

            // Применяем красный материал ко всем мешам внутри объекта "Dice_2"
            if (dice2) {
                dice2.traverse((child) => {
                    if (child.isMesh) {
                        child.material = this.yellowDiceMaterial;
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

    _loadEnvironmentMap() {
        const exrLoader = new EXRLoader();
        exrLoader.load(
            'GSG_ProStudiosMetal_Vol2_24_Env_sm.exr',
            (environmentMap) => {
                environmentMap.mapping = THREE.EquirectangularReflectionMapping;
                this.scene.environment = environmentMap;
                // Устанавливаем начальное вращение по всем осям ---
                this.scene.environmentRotation.set(
                    this.debugParams.environmentRotationX,
                    this.debugParams.environmentRotationY,
                    this.debugParams.environmentRotationZ
                );
                console.log('Карта окружения EXR загружена и применена.');
                if (this.onEnvironmentLoaded) {
                    this.onEnvironmentLoaded();
                }
            },
            undefined,
            (error) => {
                console.error('Ошибка загрузки EXR карты окружения:', error);
            }
        );
    }

    // TODO - для выставления позции через хелтер. Потом удалить
    _updateEnvironmentRotation() {
        if (this.scene.environment) {
            this.scene.environmentRotation.set(
                this.debugParams.environmentRotationX,
                this.debugParams.environmentRotationY,
                this.debugParams.environmentRotationZ
            );
        }
    }


    _animate(delta) {
        this.update()
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

            let alphaTextureGenerate = new THREE.CanvasTexture(createDotsTexture(769, 1024, 27)).clone();
				alphaTextureGenerate.needsUpdate = true;
            alphaTextureGenerate.repeat.set(u_max - u_min, v_max - v_min);
            alphaTextureGenerate.offset.set(u_min, v_min);
            
            return new THREE.MeshBasicMaterial({
                map: colorTexture,
                alphaMap: alphaTextureGenerate, 
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
        this.redDice = Math.floor(Math.random() * 6) + 15;
        this.yellowDice = Math.floor(Math.random() * 6) + 15;
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

    update() {
        // Обновление параметров на основе debugParams
        this.renderer.toneMappingExposure = this.debugParams.environmentMapIntensity;
        this.directionalLight.intensity = this.debugParams.directionalLightIntensity;
       
        // Обновляем вращение окружения по всем осям в каждом кадре ---
        if (this.scene.environment) { // Проверяем, что карта загружена
            this.scene.environmentRotation.set(
                this.debugParams.environmentRotationX,
                this.debugParams.environmentRotationY,
                this.debugParams.environmentRotationZ
            );
    
        }
         // Обновление хелпера
        if (this.directionalLightHelper.visible) {
            this.directionalLightHelper.update();
        }
    }

    setupGUI(gui) {
        const renderingFolder = gui.addFolder('Рендеринг и Окружение'); // Переименуем для ясности
        renderingFolder.add(this.debugParams, 'environmentMapIntensity')
                       .min(0).max(15).step(0.01)
                       .name('Яркость окружения (exp)');

        //Папка для вращения окружения ---
        const envRotationFolder = renderingFolder.addFolder('Вращение Окружения');
        envRotationFolder.add(this.debugParams, 'environmentRotationX')
                       .min(0).max(Math.PI * 2).step(0.01)
                       .name('Вращение X (радианы)')
                       .onChange(this._updateEnvironmentRotation.bind(this)); // Связываем onChange

        envRotationFolder.add(this.debugParams, 'environmentRotationY')
                       .min(0).max(Math.PI * 2).step(0.01)
                       .name('Вращение Y (радианы)')
                       .onChange(this._updateEnvironmentRotation.bind(this)); // Связываем onChange

        envRotationFolder.add(this.debugParams, 'environmentRotationZ')
                       .min(0).max(Math.PI * 2).step(0.01)
                       .name('Вращение Z (радианы)')
                       .onChange(this._updateEnvironmentRotation.bind(this)); // Связываем onChange

         if (!this.scene.environment) {
             this.onEnvironmentLoaded = () => {
                 console.log('GUI: Окружение загружено, контролы рендеринга активны.');
                 this._updateEnvironmentRotation(); // Применяем начальные значения вращения из GUI
             };
         } else {
            // Если карта уже была загружена до вызова setupGUI
            this._updateEnvironmentRotation();
         }
          const lightFolder = gui.addFolder('Источники света (Дополнительные)');
        lightFolder.close(); // Свернем по умолчанию



        // Directional Light GUI
        const directionalFolder = lightFolder.addFolder('Направленный свет (Directional)');
        directionalFolder.add(this.debugParams, 'directionalLightIntensity')
                         .min(0).max(5).step(0.01).name('Интенсивность');
        directionalFolder.add(this.directionalLight, 'visible').name('Включен');
        directionalFolder.addColor(this.directionalLight, 'color').name('Цвет');
        directionalFolder.add(this.directionalLightHelper, 'visible').name('Показать хелпер');

        const directionalPositionFolder = directionalFolder.addFolder('Положение источника');
        directionalPositionFolder.add(this.directionalLight.position, 'x').min(-20).max(20).step(0.1).name('X');
        directionalPositionFolder.add(this.directionalLight.position, 'y').min(-20).max(20).step(0.1).name('Y');
        directionalPositionFolder.add(this.directionalLight.position, 'z').min(-20).max(20).step(0.1).name('Z');

       
        // ==========================================================
        // ИСПРАВЛЕННЫЙ КОД: GUI для материалов
        // ==========================================================
        // Используем вложенную функцию, чтобы избежать рекурсивного вызова всей setupGUI
        const setupMaterialsControls = (parentGUI) => {
            const materialsFolder = parentGUI.addFolder('Материалы Кубиков');
            
            // Проверяем, что материалы были созданы
            if (this.redDiceMaterial && this.yellowDiceMaterial) {
                materialsFolder.add(this.redDiceMaterial, 'roughness')
                               .min(0).max(1).step(0.01)
                               .name('Шероховатость (Красный)');
        
                materialsFolder.add(this.yellowDiceMaterial, 'roughness')
                               .min(0).max(1).step(0.01)
                               .name('Шероховатость (Желтый)');
            } else {
                // Если материалы еще не созданы, добавляем "заглушку"
                const placeholder = { message: "Материалы загружаются..." };
                materialsFolder.add(placeholder, 'message').name('').disable();
                
                // Если модель еще не загружена, мы дождемся колбэка onLoad,
                // чтобы перестроить ТОЛЬКО ЭТУ часть GUI.
                if (!this.model) {
                     const originalOnLoad = this.onLoadedCallback;
                     this.onLoadedCallback = (manager, error) => {
                         if (originalOnLoad) originalOnLoad(manager, error);
                         if (!error) {
                             // Когда все загружено, удаляем старую папку и создаем новую
                             materialsFolder.destroy();
                             setupMaterialsControls(parentGUI); 
                         }
                     };
                }
            }
        }
        // Вызываем функцию для создания папки материалов
        setupMaterialsControls(gui);
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


function createDotsTexture(width = 769, height = 1024, dotRadius = 56) {
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    context.fillStyle = 'rgb(0, 0, 0)';
    context.fillRect(0, 0, width, height);

    context.fillStyle = 'rgb(255, 255, 255)';

    const dotRelativePositions = [
        { x: 384.5, y: 128 },
        { x: 57.5, y: 312.5 },
        { x: 200.4, y: 312.5 },
        { x: 312.9, y: 312.5 },
        { x: 569.5, y: 312.5 },
        { x: 712.4, y: 312.5 },
        { x: 129, y: 384 },
        { x: 569.5, y: 384 },
        { x: 712.5, y: 384 },
        { x: 57.5, y: 455.5 },
        { x: 200.5, y: 455.5 },
        { x: 456, y: 455.5 },
        { x: 569.5, y: 455.5 },
        { x: 712.5, y: 455.5 },
        { x: 313.5, y: 568.5 },
        { x: 385, y: 640 },
        { x: 456.5, y: 711.5 },
        { x: 313.5, y: 824.5 },
        { x: 456.4, y: 824.5 },
        { x: 313.5, y: 967.5 },
        { x: 456.5, y: 967.5 },
        
       
    ];

    
    dotRelativePositions.forEach(pos => {
        context.beginPath();
        context.arc(pos.x , pos.y , dotRadius, 0, Math.PI * 2);
        context.fill();
    });

    return canvas;
}
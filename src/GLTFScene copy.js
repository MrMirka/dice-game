import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
        this.animations = {}; // Хранилище для всех анимаций модели
        this.activeAction = null;
        this.clock = new THREE.Clock();

        // Свойства для отслеживания обертки
        this.wrapper = null;
        this.objectToFollow = null;

        this._init();
    }

    _init() {
        // Сцена
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x282c34); // Темный фон

        // Камера
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.camera.position.set(2, 3, 4); // Начальная позиция камеры (подберите под вашу модель)

        // Рендерер
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        // Освещение
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(5, 10, 7);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048; // Улучшаем качество теней
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        this.scene.add(directionalLight);

        // Контролы камеры
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 0.5, 0); // Настройте центр вращения под вашу модель

        // Загрузчик GLTF
        const loader = new GLTFLoader();
        loader.load(this.modelPath, (gltf) => {
            this.model = gltf.scene;
            this.model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            this.scene.add(this.model);
            this.controls.target.set(0, this.model.position.y + 0.5, 0);
            this.controls.update();


            // Настройка анимации
            if (gltf.animations && gltf.animations.length) {
                this.mixer = new THREE.AnimationMixer(this.model);
                gltf.animations.forEach((clip) => {
                    this.animations[clip.name] = this.mixer.clipAction(clip);
                });
                console.log("Доступные анимации:", Object.keys(this.animations));
            } else {
                console.warn("В GLTF файле не найдено анимаций.");
            }

            // Создаем обертку для отслеживания объекта
            //this.createWrapperToFollow('Dice_1');
            this.createWrapperToFollow('Dice_2');

            this._animate();

            if (this.onLoadedCallback) {
                this.onLoadedCallback(this, null);
            }

        }, undefined, (error) => {
            console.error('Ошибка загрузки GLTF модели:', error);
            if (this.onLoadedCallback) {
                this.onLoadedCallback(this, error);
            }
        });

        window.addEventListener('resize', this._onWindowResize.bind(this), false);
    }

    _onWindowResize() {
        if (!this.container) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    _animate() {
        requestAnimationFrame(this._animate.bind(this));
        const delta = this.clock.getDelta();

        // Сначала обновляем анимацию, чтобы получить новое положение объектов
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Затем вручную копируем трансформации
        if (this.wrapper && this.objectToFollow) {
            // ВАЖНО: Принудительно обновляем мировую матрицу цели ПОСЛЕ обновления анимации.
            // Это гарантирует, что мы копируем самые свежие данные о трансформации.
            this.objectToFollow.updateMatrixWorld(true);

            // Копируем мировую матрицу цели прямо в матрицу обертки.
            // Так как wrapper.matrixAutoUpdate = false, Three.js будет использовать
            // эту матрицу напрямую для рендеринга.
            this.wrapper.matrix.copy(this.objectToFollow.matrixWorld);
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Создает куб-обертку и настраивает ее для отслеживания объекта в каждом кадре.
     * @param {string} objectNameToFollow - Имя объекта, за которым нужно следовать.
     */
    createWrapperToFollow(objectNameToFollow) {
        if (!this.model) {
            console.error("Модель не загружена, невозможно создать обертку.");
            return;
        }

        const targetObject = this.model.getObjectByName(objectNameToFollow);

        if (!targetObject) {
            console.warn(`Объект для отслеживания "${objectNameToFollow}" не найден.`);
            return;
        }
        
        // Сохраняем ссылку на объект, за которым будем следить
        this.objectToFollow = targetObject;
        
        // Принудительно обновляем матрицы, чтобы получить корректный размер
        this.model.updateMatrixWorld(true);

        const aabb = new THREE.Box3().setFromObject(targetObject);
        if (aabb.isEmpty()) {
            console.warn(`Не удалось измерить "${objectNameToFollow}", bounding box пуст.`);
            return;
        }

        const size = new THREE.Vector3();
        aabb.getSize(size);

        // Создаем геометрию и материал для куба-обертки
        const wrapperGeo = new THREE.BoxGeometry(size.x * 1.1, size.y * 1.1, size.z * 1.1);
        const wrapperMat = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            wireframe: true
        });
        const wrapperBox = new THREE.Mesh(wrapperGeo, wrapperMat);

        // Отключаем автоматическое обновление матрицы для обертки
        wrapperBox.matrixAutoUpdate = false;

        // Добавляем обертку прямо в сцену, а не в другой объект
        this.scene.add(wrapperBox);

        // Сохраняем ссылку на саму обертку
        this.wrapper = wrapperBox;

        console.log(`Обертка создана и отслеживает объект "${objectNameToFollow}".`);
    }


    controlTargetAnimation(command, loop = true, loopMode = THREE.LoopRepeat, repetitions = Infinity) {
        const targetAction = this.animations[this.targetAnimationName];
        if (!targetAction) {
            console.warn(`Анимация "${this.targetAnimationName}" не готова или не существует.`);
            return;
        }

        switch (command) {
            case 'play':
                if (this.activeAction && this.activeAction !== targetAction) {
                    this.activeAction.fadeOut(0.3);
                }
                targetAction.reset();
                targetAction.setLoop(loopMode, loop ? repetitions : 1);
                targetAction.clampWhenFinished = !loop;
                targetAction.fadeIn(0.3).play();
                this.activeAction = targetAction;
                break;
            case 'pause':
                if (targetAction.isRunning()) {
                    targetAction.paused = !targetAction.paused;
                }
                break;
            case 'stop':
                targetAction.fadeOut(0.3).stop();
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

    playAnimationByName(name, loop = true, loopMode = THREE.LoopRepeat, repetitions = Infinity) {
        if (this.activeAction) {
            this.activeAction.fadeOut(0.3);
        }

        const newAction = this.animations[name];
        if (newAction) {
            newAction.reset()
                     .setLoop(loopMode, loop ? repetitions : 1)
                     .clampWhenFinished = !loop;
            newAction.fadeIn(0.3).play();
            this.activeAction = newAction;
        } else {
            console.warn(`Анимация "${name}" не найдена.`);
        }
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
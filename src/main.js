import { GLTFSceneManager } from './GLTFScene.js';
import * as THREE from 'three'; // Для доступа к THREE.LoopRepeat и т.д.



//const MODEL_PATH = '/model.gltf';     
const MODEL_PATH = '/Dices_Anim_2.gltf';     
const TARGET_ANIMATION_NAME = 'animation_0';  

// --- ИНИЦИАЛИЗАЦИЯ ---
const sceneManager = new GLTFSceneManager(
    'app',                  // ID контейнера в index.html
    MODEL_PATH,
    TARGET_ANIMATION_NAME,
    (managerInstance, error) => { // Callback после загрузки модели
        if (error) {
            console.error("Ошибка инициализации GLTFSceneManager:", error);
           
            const appContainer = document.getElementById('app');
            if (appContainer) {
                appContainer.innerHTML = `<div style="color: red; padding: 20px; text-align: center;">
                                            Не удалось загрузить 3D модель. Подробности в консоли.
                                          </div>`;
            }
            return;
        }

        console.log("GLTFSceneManager успешно инициализирован. Модель загружена.");

        // Проверяем, существует ли целевая анимация
        if (managerInstance.animations[TARGET_ANIMATION_NAME]) {
            console.log(`Начинаем воспроизведение анимации "${TARGET_ANIMATION_NAME}".`);
            managerInstance.controlTargetAnimation('stop', false, THREE.LoopRepeat, Infinity);
            
            // Воспроизводим целевую анимацию "dice"
            // Параметры: command, loop, loopMode, repetitions
            window.addEventListener('click', function(event) {
           
                console.log("sd")
                managerInstance.controlTargetAnimation('play', false, THREE.LoopOnce, Infinity);
            
            });

           // managerInstance.controlTargetAnimation('play', false, THREE.LoopOnce, Infinity);

            // Пример: остановить анимацию через 10 секунд
            // setTimeout(() => {
            //     console.log(`Останавливаем анимацию "${TARGET_ANIMATION_NAME}".`);
            //     managerInstance.controlTargetAnimation('stop');
            // }, 10000);

            // Пример: через 12 секунд запустить снова, но без зацикливания
            // setTimeout(() => {
            //     console.log(`Запускаем анимацию "${TARGET_ANIMATION_NAME}" один раз.`);
            //     managerInstance.controlTargetAnimation('play', false, THREE.LoopOnce);
            // }, 12000);

        } else {
            console.warn(`Анимация "${TARGET_ANIMATION_NAME}" не найдена в загруженной модели. ` +
                         `Доступные анимации: ${Object.keys(managerInstance.animations).join(', ') || 'нет'}`);
            
            const availableAnimations = Object.keys(managerInstance.animations);
            if (availableAnimations.length > 0) {
                const firstAnimation = availableAnimations[0];
                console.log(`Пробуем запустить первую доступную анимацию: "${firstAnimation}"`);
                //managerInstance.playAnimationByName(firstAnimation, true, THREE.LoopRepeat);
            }
        }
    }
);

// Для отладки можно сделать sceneManager доступным глобально
// window.sceneManager = sceneManager;

// Обработка выгрузки ресурсов при закрытии страницы или HMR в Vite
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (sceneManager) {
      sceneManager.destroy();
    }
  });
}
window.addEventListener('beforeunload', () => {
    if (sceneManager) {
        sceneManager.destroy();
    }
});
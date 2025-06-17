import { GLTFSceneManager } from './GLTFScene.js';
import * as THREE from 'three'; 


    
const MODEL_PATH = 'Dices_Anim_2.gltf';     
const TARGET_ANIMATION_NAME = 'animation_0';  


const sceneManager = new GLTFSceneManager(
    'app',                  
    MODEL_PATH,
    TARGET_ANIMATION_NAME,
    (managerInstance, error) => { // Callback после загрузки модели
        if (error) {
            console.error("Ошибка инициализации GLTFSceneManager:", error);
            return;
        }

        console.log("GLTFSceneManager успешно инициализирован. Модель загружена.");

        // Проверяем, существует ли целевая анимация
        if (managerInstance.animations[TARGET_ANIMATION_NAME]) {
            managerInstance.controlTargetAnimation('stop', false, THREE.LoopRepeat, Infinity);
        } else {
            console.warn(`Анимация "${TARGET_ANIMATION_NAME}" не найдена в загруженной модели. ` +
                         `Доступные анимации: ${Object.keys(managerInstance.animations).join(', ') || 'нет'}`);
        }
    }
);

// Тестовый кейс по клику (ИСПОЛЬЗОВАТЬ В СВОЕЙ ЛОГИКЕ), !!! managerInstance  для использования внутри калбека !!!
window.addEventListener('click', function(event) {
    sceneManager.setDice(1,4) // < params (желтый, красный)
    sceneManager.controlTargetAnimation('play', false, THREE.LoopOnce, Infinity);
            
 }); 


// Обработка выгрузки ресурсов при закрытии страницы
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
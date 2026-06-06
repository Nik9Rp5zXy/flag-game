import { Howl } from 'howler';

// Gerçek, ücretsiz CDN stok ses efektleri
export const sounds = {
  slam: new Howl({ src: ['https://actions.google.com/sounds/v1/impacts/crash.ogg'], volume: 0.8, preload: true }),
  correct: new Howl({ src: ['https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'], volume: 0.6, preload: true }),
  wrong: new Howl({ src: ['https://actions.google.com/sounds/v1/alarms/buzzer_alarm.ogg'], volume: 0.9, preload: true }),
  damage: new Howl({ src: ['https://actions.google.com/sounds/v1/impacts/wood_hit_metal.ogg'], volume: 0.7, preload: true }),
};

export const playSound = (soundName) => {
  if (sounds[soundName] && sounds[soundName].state() === 'loaded') {
    sounds[soundName].stop();
    sounds[soundName].play();
  }
};

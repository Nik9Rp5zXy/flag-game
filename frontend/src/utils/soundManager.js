import { Howl } from 'howler';

// Not: "/sounds/" dizinine oyun başlamadan mp3 dosyaları eklenmelidir (public/sounds/ altına).
// Yoksa konsolda 404 hatası verebilir, ancak oyun mantığı çalışmaya devam eder.
export const sounds = {
  slam: new Howl({ src: ['/sounds/slam.mp3'], volume: 0.8, preload: true }),
  correct: new Howl({ src: ['/sounds/correct.mp3'], volume: 0.6, preload: true }),
  wrong: new Howl({ src: ['/sounds/error.mp3'], volume: 0.9, preload: true }),
  damage: new Howl({ src: ['/sounds/hit.mp3'], volume: 0.7, preload: true }),
};

export const playSound = (soundName) => {
  if (sounds[soundName] && sounds[soundName].state() === 'loaded') {
    sounds[soundName].stop();
    sounds[soundName].play();
  }
};

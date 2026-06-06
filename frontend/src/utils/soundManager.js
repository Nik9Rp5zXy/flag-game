import { Howl } from 'howler';

class SoundManager {
  constructor() {
    this.sounds = {
      slam: new Howl({ src: ['https://actions.google.com/sounds/v1/impacts/crash.ogg'], volume: 0.8, preload: true }),
      correct: new Howl({ src: ['https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'], volume: 0.7, preload: true }),
      wrong: new Howl({ src: ['https://actions.google.com/sounds/v1/alarms/buzzer_alarm.ogg'], volume: 0.8, preload: true }),
      damage: new Howl({ src: ['https://actions.google.com/sounds/v1/impacts/wood_hit_metal.ogg'], volume: 0.7, preload: true }),
      levelup: new Howl({ src: ['https://actions.google.com/sounds/v1/cartoon/siren_whistle.ogg'], volume: 0.9, preload: true }),
      combo: new Howl({ src: ['https://actions.google.com/sounds/v1/cartoon/pop.ogg'], volume: 0.6, preload: true }),
      fire: new Howl({ src: ['https://actions.google.com/sounds/v1/science_fiction/robot_charge.ogg'], volume: 0.7, preload: true }),
      purchase: new Howl({ src: ['https://actions.google.com/sounds/v1/cartoon/concussive_hit_guitar_boing.ogg'], volume: 0.7, preload: true }),
      tick: new Howl({ src: ['https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg'], volume: 0.4, preload: true }),
      click: new Howl({ src: ['https://actions.google.com/sounds/v1/cartoon/pop.ogg'], volume: 0.3, preload: true }),
    };

    this.bgMusic = new Howl({
      src: ['https://actions.google.com/sounds/v1/ambiences/spaceship_ambience.ogg'],
      volume: 0.15,
      loop: true,
      preload: true
    });

    this.isMusicPlaying = false;
  }

  play(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      // Polyphonic: üstüne binme (stop etmeden play)
      sound.play();
    }
  }

  startBgMusic() {
    if (!this.isMusicPlaying && this.bgMusic.state() === 'loaded') {
      this.bgMusic.play();
      this.isMusicPlaying = true;
    }
  }

  stopBgMusic() {
    this.bgMusic.stop();
    this.isMusicPlaying = false;
  }

  setMusicVolume(vol) {
    this.bgMusic.volume(vol);
  }
}

// Singleton export
const soundManager = new SoundManager();

export const playSound = (name) => soundManager.play(name);
export const startBgMusic = () => soundManager.startBgMusic();
export const stopBgMusic = () => soundManager.stopBgMusic();

export default soundManager;

import { Howl } from 'howler';

class SoundManager {
  constructor() {
    this.sounds = {
      slam: null,
      correct: null,
      wrong: null,
      damage: null,
      levelup: null,
      combo: null,
      fire: null,
      purchase: null,
      tick: null,
      click: null,
    };

    this.bgMusic = null;

    this.isMusicPlaying = false;
  }

  play(soundName) {
    // const sound = this.sounds[soundName];
    // if (sound) {
    //   sound.play();
    // }
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

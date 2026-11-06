export type GameState = 'intro' | 'playing' | 'jumpscare' | 'slept' | 'victory';

export type GameMode = 'classic' | 'infinite';

export type MiniGameType = 'space';

export type SensorStatus = {
  hapticsSupported: boolean;
};

export interface OrientationData {
  alpha: number; // yaw
  beta: number;  // pitch
  gamma: number; // roll
}

export type MonsterLocation =
  | 'wardrobe'
  | 'flowerchest'
  | 'trainshelf'
  | 'ventriloquist'
  | 'beanbag'
  | 'arttable'
  | 'eyeballmobile'
  | 'shuttercloset'
  | 'toychair'
  | 'footbed'
  | 'underbed'
  | 'ceiling'
  | 'closet'
  | 'door'
  | 'window'
  | 'desk'
  | 'curtain'
  | 'bookshelf'
  | 'hallway';

export interface ActiveMonster {
  id: string;
  location: MonsterLocation;
  timer: number;       // time left before attack
  maxTimer: number;    // total time given to feign sleep
  spotted: boolean;    // whether player looked towards it
  isAttacking: boolean;
  attackProgress: number; // 0 to 1
}

export interface GameStats {
  score: number;
  level: number;
  monstersRepelled: number;
  timeSurvivedMinutes: number;
  currentHour: number; // 0 (12 AM) to 6 (6 AM) in classic, or ongoing in infinite
  gameTimeSeconds: number;
  mode: GameMode;
  highScore: number;
}


export type GameState = 'intro' | 'playing' | 'jumpscare' | 'slept' | 'victory';

export type MiniGameType = 'space';

export interface SensorStatus {
  gyroscopeAllowed: boolean;
  gyroscopeActive: boolean;
  cameraAllowed: boolean;
  cameraActive: boolean;
  hapticsSupported: boolean;
}

export interface OrientationData {
  alpha: number; // yaw
  beta: number;  // pitch
  gamma: number; // roll
}

export type MonsterLocation = 'closet' | 'door' | 'window' | 'footbed' | 'desk';

export interface MonsterState {
  active: boolean;
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
  currentHour: number; // 0 (12 AM) to 6 (6 AM)
  gameTimeSeconds: number;
}


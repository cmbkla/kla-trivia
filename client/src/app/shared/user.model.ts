
export interface User {
    id?: number;
    gameId?: number;
    name?: string;
    avatar?: string
    score?: number;
    roundScore?: Array<number>
    questionScoreOverride?: Array<number | string>
}

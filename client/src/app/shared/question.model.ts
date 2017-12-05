import { QuestionChoices } from './questionChoices.model';
export interface Question {
  id?: number;
  category?: string;
  title?: string;
  type?: string;
  choices?: Array<QuestionChoices>;
  picture?: string;
  answer: string;
  timeAllowed: number;

  categoryDisplayed: boolean,
  asked: boolean;
  started: boolean;
  timerDone: boolean;
  answerDisplayed: boolean;
  teamAnswers: Array<any>;
  round: number;
  questionNumber: number;
  isDoubler: boolean;
}

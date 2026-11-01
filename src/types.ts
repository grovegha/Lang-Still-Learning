export type Question={question:string;options:string[];answer:number;explanation:string};
export type Content={summary:string;chapters:{title:string;body:string}[];flashcards:{front:string;back:string}[];quiz:Question[];exam:Question[];mindmap:{topic:string;points:string[]}[]};
export type Review={interval:number;due:number;reviews:number;rating:string};
export type Lesson={id:string;title:string;folder:string;language:string;sourceText:string;content:Content|null;files:{name:string;size:number}[];kind:string;completed:number[];created:number;updated:number;isDemo:boolean;reviews:Record<number,Review>;chats:{role:'user'|'assistant';content:string}[]};
export type LessonCard=Omit<Lesson,'content'|'sourceText'|'reviews'|'chats'>&{ready:boolean;chapterCount:number;cardCount:number};
export type Dashboard={lessons:LessonCard[];folders:string[];stats:{xp:number;level:number;streak:number;due:number;activities:number};events:{id:string;day:string;xp:number;label:string;created:number}[];attempts:{id:string;mode:string;score:number;created:number;title:string}[]};
export type Result={score:number;correct:number;total:number;results:(Question&{correct:boolean;selected:number})[]};
